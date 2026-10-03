"""Gemini and browser-facing chat stream checks."""
import io
import json
import threading
import unittest
from unittest.mock import patch
from urllib.request import Request, urlopen

import server as app


class ChatStreamTests(unittest.TestCase):
    def test_gemini_sse_chunks_arrive_separately_without_key_in_url(self):
        response = io.BytesIO(
            b'data: {"candidates":[{"content":{"parts":[{"text":"Mer"}]}}]}\n\n'
            b'data: {"candidates":[{"content":{"parts":[{"text":"haba"}]}}]}\n\n'
        )
        with patch.object(app, "urlopen", return_value=response) as open_mock:
            parts = list(app.gemini_stream("secret", [{"role": "user", "parts": [{"text": "Selam"}]}], "Yanıt ver"))
        self.assertEqual(parts, [{"text": "Mer"}, {"text": "haba"}])
        request = open_mock.call_args.args[0]
        self.assertIn("streamGenerateContent?alt=sse", request.full_url)
        self.assertNotIn("secret", request.full_url)
        self.assertEqual(request.get_header("X-goog-api-key"), "secret")

    def test_admin_stream_executes_allowlisted_tool_then_streams_final_reply(self):
        calls = [
            iter([{"functionCall": {"name": "update_request", "args": {"identifier": "LA-TEST-TEST", "status": "Hazırlanıyor"}}}]),
            iter([{"text": "Talep "}, {"text": "güncellendi."}]),
        ]
        action = {"ok": True, "code": "LA-TEST-TEST", "status": "Hazırlanıyor"}
        with patch.object(app, "gemini_stream", side_effect=calls), patch.object(app, "admin_tool", return_value=action) as tool:
            events = list(app.chat_stream("admin", "secret", [{"role": "user", "parts": [{"text": "Güncelle"}]}], "Talimat"))
        self.assertEqual([event["type"] for event in events], ["action", "delta", "delta", "done"])
        self.assertEqual(events[-1]["actions"], [action])
        tool.assert_called_once_with("update_request", {"identifier": "LA-TEST-TEST", "status": "Hazırlanıyor"})

    def test_http_stream_sends_text_before_completion(self):
        server = app.ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
        server.daemon_threads = True
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f"http://127.0.0.1:{server.server_port}/api/chat/customer"
        data = json.dumps({"messages": [{"role": "user", "text": "Merhaba"}]}).encode()
        request = Request(url, data=data, headers={"Content-Type": "application/json", "Accept": "text/event-stream"}, method="POST")
        try:
            with patch.object(app, "chat_context", return_value=("secret", [{"role": "user", "parts": [{"text": "Merhaba"}]}], "Talimat")), patch.object(app, "gemini_stream", return_value=iter([{"text": "Mer"}, {"text": "haba"}])):
                with urlopen(request, timeout=5) as response:
                    self.assertEqual(response.status, 200)
                    self.assertTrue(response.headers["Content-Type"].startswith("text/event-stream"))
                    first = json.loads(response.readline().removeprefix(b"data: "))
                    self.assertEqual(first, {"type": "delta", "text": "Mer"})
                    response.readline()
                    second = json.loads(response.readline().removeprefix(b"data: "))
                    self.assertEqual(second, {"type": "delta", "text": "haba"})
                    response.readline()
                    done = json.loads(response.readline().removeprefix(b"data: "))
                    self.assertEqual(done["type"], "done")
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
