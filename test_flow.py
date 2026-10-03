"""End-to-end checks for upload, tracking, admin update, and event notification."""
import json
import os
import random
from io import BytesIO
from PIL import Image
import shutil
import tempfile
import threading
import unittest
from unittest.mock import patch
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server as app


_png = BytesIO()
Image.new('RGB', (2, 2), 'white').save(_png, format='PNG')
PNG = _png.getvalue()


class FlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.auth_env = patch.dict(os.environ, {"LOSTRA_ADMIN_PASSWORD": "test-admin-password-2026-only"})
        cls.auth_env.start()
        app.DATA = Path(tempfile.mkdtemp(prefix="lostra-tests-", dir=app.ROOT))
        app.UPLOADS = app.DATA / "uploads"
        app.SITE_IMAGES = app.DATA / "site-images"
        app.DB = app.DATA / "lostra.sqlite3"
        app.initialize()
        cls.server = app.ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
        cls.server.daemon_threads = True
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"
        login = Request(cls.url + "/api/admin/login", data=json.dumps({"password": "test-admin-password-2026-only"}).encode(), headers={"Content-Type": "application/json"}, method="POST")
        with urlopen(login, timeout=5) as response:
            cls.cookie = response.headers["Set-Cookie"].split(";", 1)[0]

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        shutil.rmtree(app.DATA)
        cls.auth_env.stop()

    def call(self, path, method="GET", data=None, content_type=None):
        headers = {"Content-Type": content_type} if content_type else {}
        headers["Cookie"] = self.cookie
        request = Request(self.url + path, data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=5) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def test_ai_key_is_private_and_admin_tool_updates_request(self):
        json_body = lambda value: json.dumps(value, ensure_ascii=False).encode()
        self.assertEqual(self.call("/api/chat/customer", "POST", json_body({"messages": [{"role": "user", "text": "Merhaba"}]}), "application/json")[0], 400)
        self.assertNotIn("api_key", self.call("/api/site")[1])
        status, setting = self.call("/api/admin/ai-settings", "PATCH", json_body({"api_key": "temporary-test-key"}), "application/json")
        self.assertEqual((status, setting["configured"]), (200, True))
        self.assertNotIn("api_key", self.call("/api/admin/ai-settings")[1])
        connection = app.db_connect()
        try:
            connection.execute("INSERT INTO requests (code,name,phone,product_type,model,services,notes,photos,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", ("LA-AIXX-TEST", "Deneme Kişi", "05550000000", "Sneaker", "Deneme Model", "[]", "", "[]", "Yeni", "2026-10-02T10:00:00+00:00", "2026-10-02T10:00:00+00:00"))
            connection.commit()
        finally:
            connection.close()
        try:
            with patch.object(app, "gemini_generate", return_value=[{"text": "Formu doldurabilirsiniz."}]) as model:
                status, reply = self.call("/api/chat/customer", "POST", json_body({"messages": [{"role": "user", "text": "Nasıl başvururum?"}]}), "application/json")
                self.assertEqual((status, reply["reply"]), (200, "Formu doldurabilirsiniz."))
                self.assertIn("Site içeriği", model.call_args.args[2])
                self.assertNotIn("Deneme Kişi", model.call_args.args[2])
            calls = [[{"functionCall": {"name": "update_request", "args": {"identifier": "LA-AIXX-TEST", "status": "Hazırlanıyor", "admin_note": "Temizlik başladı"}}}], [{"text": "Talep hazırlanıyor aşamasına alındı."}]]
            with patch.object(app, "gemini_generate", side_effect=calls):
                status, reply = self.call("/api/chat/admin", "POST", json_body({"messages": [{"role": "user", "text": "Deneme talebini hazırla"}]}), "application/json")
            self.assertEqual(status, 200)
            self.assertEqual(reply["actions"][0]["status"], "Hazırlanıyor")
            self.assertEqual(self.call("/api/track?code=LA-AIXX-TEST")[1]["status"], "Hazırlanıyor")
            self.assertIn("error", app.admin_tool("update_request", {"identifier": "LA-AIXX-TEST", "review_allowed": True}))
        finally:
            self.call("/api/admin/ai-settings", "PATCH", json_body({"api_key": ""}), "application/json")
            connection = app.db_connect()
            try:
                connection.execute("DELETE FROM requests WHERE code='LA-AIXX-TEST'")
                connection.commit()
            finally:
                connection.close()
        self.assertFalse(self.call("/api/admin/ai-settings")[1]["configured"])

    def test_complete_request_flow(self):
        boundary = "lostra-test-boundary"
        parts = []
        fields = {"name": "Ayşe Test", "phone": "0555 123 45 67", "model": "Nike Air Force 1", "product_type": app.DEFAULT_SITE["product_types"][0], "services": app.DEFAULT_SITE["services"][0], "notes": "Burun kısmı lekeli"}
        for name, value in fields.items():
            parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode())
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"photos\"; filename=\"shoe.png\"\r\nContent-Type: image/png\r\n\r\n".encode() + PNG + b"\r\n")
        body = b"".join(parts) + f"--{boundary}--\r\n".encode()

        with patch.object(app, "db_connect", side_effect=AssertionError("Değişiklik kontrolü veritabanını açmamalı")):
            before_revision = self.call("/api/revision")[1]["revision"]
        events = urlopen(Request(self.url + "/api/events", headers={"Cookie": self.cookie}), timeout=5)
        self.assertEqual(events.readline(), b": connected\n")
        status, result = self.call("/api/requests", "POST", body, f"multipart/form-data; boundary={boundary}")
        self.assertEqual(status, 201)
        code = result["code"]
        self.assertEqual(events.readline(), b"\n")
        self.assertEqual(events.readline(), b"event: change\n")
        self.assertEqual(events.readline(), f"data: {before_revision + 1}\n".encode())
        events.close()

        self.assertEqual(self.call("/api/revision")[1]["revision"], before_revision + 1)

        status, listing = self.call("/api/requests")
        self.assertEqual(status, 200)
        self.assertEqual(listing["revision"], before_revision + 1)
        self.assertEqual(len(listing["requests"]), 1)
        item = listing["requests"][0]
        self.assertEqual(item["name"], "Ayşe Test")
        self.assertEqual(len(item["photos"]), 1)
        with urlopen(Request(self.url + item["photos"][0], headers={"Cookie": self.cookie}), timeout=5) as image:
            with Image.open(BytesIO(image.read())) as decoded:
                self.assertEqual(decoded.size, (2, 2))
        status, tracked = self.call("/api/track?code=" + code)
        self.assertEqual((status, tracked["status"]), (200, "Yeni"))
        self.assertNotIn("phone", tracked)

        update = json.dumps({"status": "Hazırlanıyor", "model": "Nike Air Force 1", "admin_note": "Taban kontrolü"}).encode()
        status, result = self.call(f"/api/requests/{item['id']}", "PATCH", update, "application/json")
        self.assertEqual((status, result["ok"]), (200, True))
        status, tracked = self.call("/api/track?code=" + code)
        self.assertEqual(tracked["status"], "Hazırlanıyor")
        for expected in ("Tamamlandı", "Gönderildi", "Teslim Edildi"):
            status, advanced = self.call(f"/api/requests/{item['id']}/advance", "POST", json.dumps({"expected_status": app.STATUSES[app.STATUSES.index(expected)-1]}).encode(), "application/json")
            self.assertEqual((status, advanced["status"]), (200, expected))
            self.assertEqual(self.call("/api/track?code=" + code)[1]["status"], expected)
        self.assertEqual(self.call(f"/api/requests/{item['id']}/advance", "POST", json.dumps({"expected_status": "Teslim Edildi"}).encode(), "application/json")[0], 409)
        saved = next(request for request in self.call("/api/requests")[1]["requests"] if request["id"] == item["id"])
        self.assertEqual((saved["model"], saved["admin_note"]), ("Nike Air Force 1", "Taban kontrolü"))
        self.assertEqual(self.call("/api/track?code=LA-AAAA-AAAA")[0], 404)
        self.assertEqual(self.call("/api/requests", "POST", b"{}", "application/json")[0], 400)

    def test_customer_upload_over_five_megabytes(self):
        boundary = "lostra-large-photo-test"
        width, height = 1800, 1200
        image = Image.frombytes("RGB", (width, height), random.Random(731).randbytes(width * height * 3))
        encoded = BytesIO()
        image.save(encoded, format="PNG")
        photo = encoded.getvalue()
        self.assertGreater(len(photo), 5 * 1024 * 1024)
        fields = {"name": "Büyük Fotoğraf", "phone": "0555 123 45 67", "model": "Nike Test", "product_type": app.DEFAULT_SITE["product_types"][0], "services": app.DEFAULT_SITE["services"][0]}
        parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode() for name, value in fields.items()]
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="photos"; filename="large.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + photo + b'\r\n')
        body = b''.join(parts) + f'--{boundary}--\r\n'.encode()
        request = Request(self.url + "/api/requests", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}, method="POST")
        with urlopen(request, timeout=30) as response:
            self.assertEqual(response.status, 201)
            code = json.load(response)["code"]
        connection = app.db_connect()
        try:
            row = connection.execute("SELECT photos FROM requests WHERE code=?", (code,)).fetchone()
            image_path = app.DATA / json.loads(row["photos"])[0].lstrip("/")
            self.assertGreater(image_path.stat().st_size, 5 * 1024 * 1024)
            connection.execute("DELETE FROM requests WHERE code=?", (code,))
            connection.commit()
        finally:
            connection.close()
        image_path.unlink()

    def test_completed_request_opens_personalized_draft_without_sharing_customer_data_with_ai(self):
        code = "LA-MSGG-TEST"
        connection = app.db_connect()
        try:
            connection.execute("INSERT INTO requests (code,name,phone,product_type,model,services,notes,photos,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", (code, "Ayşe Örnek", "0555 123 45 67", "Sneaker", "Nike Air Force 1", "[]", "", "[]", "Yeni", "2026-10-02T10:00:00+00:00", "2026-10-02T10:00:00+00:00"))
            request_id = connection.execute("SELECT id FROM requests WHERE code=?", (code,)).fetchone()["id"]
            connection.execute("UPDATE ai_settings SET api_key='test-only-key' WHERE id=1")
            connection.commit()
        finally:
            connection.close()
        try:
            self.assertEqual(self.call(f"/api/requests/{request_id}/message-draft", "POST")[0], 409)
            connection = app.db_connect()
            try:
                connection.execute("UPDATE requests SET status='Tamamlandı' WHERE id=?", (request_id,))
                connection.commit()
            finally:
                connection.close()
            with patch.object(app, "gemini_generate", return_value=[{"text": "Ayakkabınızın bakım işlemi tamamlandı. Teslimatı görüşmek için yanıt verebilirsiniz."}]) as model:
                status, draft = self.call(f"/api/requests/{request_id}/message-draft", "POST")
            self.assertEqual((status, draft["phone"], draft["source"]), (200, "905551234567", "gemini"))
            self.assertIn("Ayşe Örnek", draft["message"])
            self.assertIn("Nike Air Force 1", draft["message"])
            self.assertIn(code, draft["message"])
            model_input = json.dumps(model.call_args.args[1:3], ensure_ascii=False)
            for private_value in ("Ayşe", "Nike", "0555", code):
                self.assertNotIn(private_value, model_input)
            connection = app.db_connect()
            try:
                connection.execute("UPDATE ai_settings SET api_key='' WHERE id=1")
                connection.commit()
            finally:
                connection.close()
            status, draft = self.call(f"/api/requests/{request_id}/message-draft", "POST")
            self.assertEqual((status, draft["source"]), (200, "template"))
            self.assertIn("işlem tamamlandı", draft["message"])
        finally:
            connection = app.db_connect()
            try:
                connection.execute("DELETE FROM requests WHERE id=?", (request_id,))
                connection.execute("UPDATE ai_settings SET api_key='' WHERE id=1")
                connection.commit()
            finally:
                connection.close()

    def test_site_settings_are_saved_and_validated(self):
        status, config = self.call("/api/site")
        self.assertEqual(status, 200)
        config["content"]["hero_subtitle"] = "Yeni atölye açıklaması"
        config["product_types"] = ["Sneaker", "Klasik Deri"]
        boundary = "gallery-test-boundary"
        image_body = f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"sample.png\"\r\nContent-Type: image/png\r\n\r\n".encode() + PNG + f"\r\n--{boundary}--\r\n".encode()
        image_status, uploaded = self.call("/api/site-image", "POST", image_body, f"multipart/form-data; boundary={boundary}")
        self.assertEqual(image_status, 201)
        with urlopen(self.url + uploaded["url"], timeout=5) as image:
            self.assertEqual(image.read(), PNG)
        config["content"]["gallery_1_image"] = uploaded["url"]
        body = json.dumps(config, ensure_ascii=False).encode("utf-8")
        status, result = self.call("/api/site", "PATCH", body, "application/json")
        self.assertEqual((status, result["ok"]), (200, True))
        self.assertEqual(self.call("/api/site")[1]["content"]["hero_subtitle"], "Yeni atölye açıklaması")
        self.assertEqual(self.call("/api/site")[1]["content"]["gallery_1_image"], uploaded["url"])
        config["product_types"] = []
        self.assertEqual(self.call("/api/site", "PATCH", json.dumps(config).encode(), "application/json")[0], 400)

    def test_review_permission_gallery_and_visits(self):
        code = "LA-TEST-TEST"
        connection = app.db_connect()
        try:
            connection.execute("INSERT INTO requests (code,name,phone,product_type,model,services,notes,photos,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", (code, "Deniz Örnek", "05551234567", "Sneaker", "Test ayakkabı", "[]", "", "[]", "Gönderildi", "2026-10-02T10:00:00+00:00", "2026-10-02T10:00:00+00:00"))
            request_id = connection.execute("SELECT id FROM requests WHERE code=?", (code,)).fetchone()["id"]
            connection.commit()
        finally:
            connection.close()
        review = json.dumps({"code": code, "rating": 5, "comment": "Çok iyi yenilendi.", "anonymous": True}).encode()
        self.assertEqual(self.call("/api/reviews", "POST", review, "application/json")[0], 403)
        update = lambda status, allowed: json.dumps({"status": status, "model": "Test ayakkabı", "admin_note": "", "review_allowed": allowed}).encode()
        self.assertEqual(self.call(f"/api/requests/{request_id}", "PATCH", update("Gönderildi", True), "application/json")[0], 400)
        self.assertEqual(self.call(f"/api/requests/{request_id}", "PATCH", update("Teslim Edildi", True), "application/json")[0], 200)
        self.assertTrue(self.call("/api/track?code=" + code)[1]["review_allowed"])
        self.assertEqual(self.call("/api/reviews", "POST", review, "application/json")[0], 201)
        self.assertEqual(self.call("/api/reviews", "POST", review, "application/json")[0], 409)
        self.assertTrue(self.call("/api/track?code=" + code)[1]["review_submitted"])
        public_review = self.call("/api/reviews")[1]["reviews"][0]
        self.assertEqual(public_review["name"], "İsmini gizleyen müşteri")
        self.assertNotIn("phone", public_review)
        self.assertEqual(self.call("/api/visit", "POST", b"1")[0], 200)
        self.assertGreaterEqual(sum(day["count"] for day in self.call("/api/analytics")[1]["days"]), 1)
        config = self.call("/api/site")[1]
        config["gallery"].append({"label": "Yeni", "title": "Yeni çalışma", "intro": "Yeni görsel", "image": config["gallery"][0]["image"]})
        self.assertEqual(self.call("/api/site", "PATCH", json.dumps(config, ensure_ascii=False).encode(), "application/json")[0], 200)
        self.assertEqual(len(self.call("/api/site")[1]["gallery"]), 4)
        config["content"]["step_1_title"] = "Değiştirilen ad"
        self.assertEqual(self.call("/api/site", "PATCH", json.dumps(config, ensure_ascii=False).encode(), "application/json")[0], 400)
        config["content"]["step_1_title"] = "Fotoğraf Gönder"
        config["gallery"][3]["image"] = "https://example.com/new-image.jpg"
        self.assertEqual(self.call("/api/site", "PATCH", json.dumps(config, ensure_ascii=False).encode(), "application/json")[0], 400)


if __name__ == "__main__":
    unittest.main()
