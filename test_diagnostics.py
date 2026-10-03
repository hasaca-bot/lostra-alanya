"""Public, redacted and live diagnostics checks."""
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


class DiagnosticsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.DATA = Path(tempfile.mkdtemp(prefix="lostra-diagnostics-tests-", dir=app.ROOT))
        app.UPLOADS = app.DATA / "uploads"
        app.SITE_IMAGES = app.DATA / "site-images"
        app.DB = app.DATA / "lostra.sqlite3"
        app.initialize()
        cls.server = app.DiagnosticsHTTPServer(("127.0.0.1", 0), app.Handler)
        cls.server.daemon_threads = True
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        shutil.rmtree(app.DATA)

    def call(self, path, method="GET", payload=None):
        body = json.dumps(payload).encode() if payload is not None else None
        request = Request(self.url + path, data=body, headers={"Content-Type": "application/json"} if body else {}, method=method)
        try:
            with urlopen(request, timeout=5) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def test_public_snapshot_redacts_private_values_and_streams_errors(self):
        with urlopen(self.url + "/api/diagnostics/events", timeout=5) as stream:
            self.assertEqual(stream.readline(), b": connected\n")
            self.assertEqual(stream.readline(), b"\n")
            self.assertEqual(self.call("/api/track?code=LA-TEST-TEST")[0], 404)
            self.assertEqual(stream.readline(), b"event: diagnostic\n")
            event = json.loads(stream.readline().removeprefix(b"data: "))
            self.assertEqual((event["kind"], event["route"], event["status"]), ("http", "/api/track", 404))
            self.assertNotIn("LA-TEST-TEST", json.dumps(event))
        status, snapshot = self.call("/api/diagnostics")
        self.assertEqual((status, snapshot["database"]), (200, "Çalışıyor"))
        self.assertGreaterEqual(snapshot["counts"]["http_errors"], 1)
        self.assertNotIn("LA-TEST-TEST", json.dumps(snapshot))
        self.assertNotIn("api_key", json.dumps(snapshot))
        with patch.object(app, "db_connect", side_effect=AssertionError("Canlı akış veritabanını açmamalı")):
            live_status, live = self.call("/api/diagnostics/live")
        self.assertEqual(live_status, 200)
        self.assertNotIn("database", live)
        self.assertEqual(live["events"][0]["route"], "/api/track")

    def test_browser_report_is_fixed_schema_and_persisted_without_message(self):
        report = {"page": "site", "kind": "error", "source": "app.js", "line": 25, "column": 7}
        self.assertEqual(self.call("/api/diagnostics/client-error", "POST", report)[0], 202)
        status, snapshot = self.call("/api/diagnostics")
        self.assertEqual(status, 200)
        self.assertTrue(any(event["kind"] == "browser" and event["source"] == "app.js" for event in snapshot["events"]))
        self.assertEqual(self.call("/api/diagnostics/client-error", "POST", {**report, "message": "0555 private text"})[0], 400)
        log = app.diagnostic_file().read_text(encoding="utf-8")
        self.assertNotIn("0555 private text", log)
        self.assertIn('"source": "app.js"', log)
        self.assertEqual(app.safe_diagnostic_route("/api/requests/123/message-draft"), "/api/requests/:id/action")
        self.assertEqual(app.safe_diagnostic_route("/unknown/private-value"), "/unknown")


if __name__ == "__main__":
    unittest.main()
