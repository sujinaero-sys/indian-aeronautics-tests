import os
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

GATE_API = "https://script.google.com/macros/s/AKfycbwUEposqR4_Abmv30Uuf_VByO3O8eHNIUB0TY3LpTdlh95h11kyjljY5akIvj1_AsZY/exec"

class GateProxyHandler(SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        if self.path.startswith("/api/gate"):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            return

        self.send_error(404)

    def do_POST(self):
        if not self.path.startswith("/api/gate"):
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length)

            content_type = self.headers.get(
                "Content-Type",
                "application/x-www-form-urlencoded"
            )

            request = urllib.request.Request(
                GATE_API,
                data=body,
                method="POST",
                headers={
                    "Content-Type": content_type,
                    "Accept": "application/json, text/plain, */*"
                }
            )

            with urllib.request.urlopen(request, timeout=60) as response:
                response_body = response.read()
                response_type = response.headers.get(
                    "Content-Type",
                    "application/json"
                )

            self.send_response(200)
            self.send_header("Content-Type", response_type)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Content-Length", str(len(response_body)))
            self.end_headers()

            self.wfile.write(response_body)

            print(
                "[GATE PROXY] POST /api/gate -> Google Apps Script -> 200"
            )

        except Exception as e:

            error_text = (
                '{"success":false,"error":"Local GATE proxy error: '
                + str(e).replace('"', '\\"')
                + '"}'
            ).encode("utf-8")

            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(error_text)))
            self.end_headers()

            self.wfile.write(error_text)

            print("[GATE PROXY ERROR]", e)

    def do_GET(self):
        if self.path.startswith("/api/gate"):
            try:
                request = urllib.request.Request(
                    GATE_API,
                    method="GET",
                    headers={
                        "Accept": "application/json, text/plain, */*"
                    }
                )

                with urllib.request.urlopen(request, timeout=60) as response:
                    response_body = response.read()
                    response_type = response.headers.get(
                        "Content-Type",
                        "application/json"
                    )

                self.send_response(200)
                self.send_header("Content-Type", response_type)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(response_body)))
                self.end_headers()

                self.wfile.write(response_body)

                print(
                    "[GATE PROXY] GET /api/gate -> Google Apps Script -> 200"
                )

            except Exception as e:

                error_text = (
                    '{"success":false,"error":"Local GATE proxy error: '
                    + str(e).replace('"', '\\"')
                    + '"}'
                ).encode("utf-8")

                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(error_text)))
                self.end_headers()

                self.wfile.write(error_text)

            return

        super().do_GET()


if __name__ == "__main__":

    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    server = ThreadingHTTPServer(
        ("127.0.0.1", 8080),
        GateProxyHandler
    )

    print("")
    print("============================================================")
    print(" INDIAN AERONAUTICS - GATE LOCAL SERVER")
    print("============================================================")
    print("")
    print("Website:")
    print("  http://localhost:8080")
    print("")
    print("GATE Login:")
    print("  http://localhost:8080/gate-login.html")
    print("")
    print("GATE API:")
    print("  /api/gate")
    print("")
    print("Proxy target:")
    print("  " + GATE_API)
    print("")
    print("KEEP THIS WINDOW OPEN.")
    print("Press Ctrl+C to stop.")
    print("")
    print("============================================================")
    print("")

    server.serve_forever()


