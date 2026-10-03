"""Threat and concurrent-update regression tests at the HTTP boundary."""
import json
import shutil
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server as app
from request_safety import RateLimiter, same_origin


class SecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original = app.DATA, app.UPLOADS, app.SITE_IMAGES, app.DB
        cls.temp = Path(tempfile.mkdtemp(prefix="lostra-security-tests-", dir=app.ROOT))
        app.DATA, app.UPLOADS, app.SITE_IMAGES, app.DB = (cls.temp, cls.temp / "uploads", cls.temp / "site-images", cls.temp / "lostra.sqlite3")
        app.initialize()
        cls.server = app.DiagnosticsHTTPServer(("127.0.0.1", 0), app.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        app.DATA, app.UPLOADS, app.SITE_IMAGES, app.DB = cls.original
        shutil.rmtree(cls.temp)

    def call(self, path, method="GET", data=None, headers=None):
        request = Request(self.url + path, data=data, headers=headers or {}, method=method)
        try:
            with urlopen(request, timeout=5) as result:
                return result.status, result.headers, result.read()
        except HTTPError as error:
            return error.code, error.headers, error.read()

    def test_invalid_json_types_return_400_not_500(self):
        for path, method in (("/api/reviews", "POST"), ("/api/requests/1", "PATCH"),
                             ("/api/site", "PATCH"), ("/api/admin/ai-settings", "PATCH"),
                             ("/api/chat/customer", "POST")):
            for value in (b"null", b"[]", b"\xff"):
                with self.subTest(path=path, value=value):
                    code, _, _ = self.call(path, method, value, {"Content-Type": "application/json"})
                    self.assertEqual(code, 400)

    def test_cross_origin_write_blocked_and_matching_origin_accepted(self):
        self.assertFalse(same_origin("https://evil.example", "good.example"))
        self.assertTrue(same_origin("https://example.com", "example.com"))
        with patch.object(app, "db_connect", side_effect=AssertionError("Cross-origin request must not open DB")):
            code, _, _ = self.call("/api/visit", "POST", b"1", {"Origin": "https://evil.example"})
        self.assertEqual(code, 403)
        code, _, _ = self.call("/api/visit", "POST", b"1", {"Origin": self.url})
        self.assertEqual(code, 200)

    def test_security_headers_and_private_paths(self):
        status, headers, _ = self.call("/")
        self.assertEqual(status, 200)
        self.assertEqual(headers["X-Frame-Options"], "DENY")
        self.assertIn("script-src 'self'", headers["Content-Security-Policy"])
        self.assertEqual(headers["Referrer-Policy"], "no-referrer")
        for path in ("/data/lostra.sqlite3", "/.git/config", "/requirements.txt"):
            self.assertEqual(self.call(path)[0], 404)

    def test_visit_cookie_avoids_second_database_write(self):
        code, headers, body = self.call("/api/visit", "POST", b"1")
        self.assertEqual(code, 200)
        self.assertTrue(json.loads(body)["counted"])
        cookie = headers["Set-Cookie"].split(";", 1)[0]
        with patch.object(app, "db_connect", side_effect=AssertionError("Duplicate visit must not open DB")):
            second, _, body = self.call("/api/visit", "POST", b"1", {"Cookie": cookie})
        self.assertEqual(second, 200)
        self.assertFalse(json.loads(body)["counted"])

    def test_customer_stream_never_executes_admin_tool(self):
        def malicious(*_args, **_kwargs):
            yield {"functionCall": {"name": "update_request", "args": {"identifier": "1", "status": "Gönderildi"}}}
            yield {"text": "Merhaba"}
        with patch.object(app, "gemini_stream", side_effect=malicious), patch.object(app, "admin_tool") as tool:
            events = list(app.chat_stream("customer", "secret", [], "instruction"))
        self.assertEqual([event["type"] for event in events], ["delta", "done"])
        tool.assert_not_called()

    def test_invalid_image_rejected_after_decode(self):
        boundary = "security-boundary"
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="fake.png"\r\n'
                'Content-Type: image/png\r\n\r\n').encode() + b"\x89PNG\r\n\x1a\n<script>" + f"\r\n--{boundary}--\r\n".encode()
        code, _, _ = self.call("/api/site-image", "POST", body,
                               {"Content-Type": f"multipart/form-data; boundary={boundary}"})
        self.assertEqual(code, 400)

    def test_stale_admin_updates_are_rejected(self):
        connection = app.db_connect()
        try:
            connection.execute("INSERT INTO requests (code,name,phone,product_type,model,services,notes,photos,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                               ("LA-SECU-TEST", "Ada", "05551234567", "Sneaker", "Model", "[]", "", "[]", "Yeni", "2026-10-03T10:00:00+00:00", "2026-10-03T10:00:00+00:00"))
            request_id = connection.execute("SELECT id FROM requests WHERE code='LA-SECU-TEST'").fetchone()["id"]
            connection.commit()
        finally:
            connection.close()
        try:
            headers = {"Content-Type": "application/json"}
            advance = json.dumps({"expected_status": "Yeni"}).encode()
            self.assertEqual(self.call(f"/api/requests/{request_id}/advance", "POST", advance, headers)[0], 200)
            self.assertEqual(self.call(f"/api/requests/{request_id}/advance", "POST", advance, headers)[0], 409)
            stale = json.dumps({"status": "Hazırlanıyor", "model": "Changed", "admin_note": "", "expected_updated_at": "2026-10-03T10:00:00+00:00"}).encode()
            self.assertEqual(self.call(f"/api/requests/{request_id}", "PATCH", stale, headers)[0], 409)
            self.assertEqual(json.loads(self.call("/api/track?code=LA-SECU-TEST")[2])["status"], "İnceleniyor")
        finally:
            connection = app.db_connect()
            try:
                connection.execute("DELETE FROM requests WHERE id=?", (request_id,))
                connection.commit()
            finally:
                connection.close()

    def test_rate_limiter_has_bounded_memory_and_window(self):
        limiter = RateLimiter(max_keys=3)
        self.assertTrue(limiter.allow("a", 1, 60))
        self.assertFalse(limiter.allow("a", 1, 60))
        for key in ("b", "c", "d"):
            self.assertTrue(limiter.allow(key, 1, 60))
        self.assertLessEqual(len(limiter.entries), 3)


if __name__ == "__main__":
    unittest.main()
