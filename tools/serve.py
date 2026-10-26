#!/usr/bin/env python3
"""Dev server: http.server with caching disabled (vendor JS changes often).

Binds to localhost only: the repo root (including .git/ and library/) is served.
Pass a host as the second argument to share on a LAN deliberately.
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    host = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"
    print(f"serving on http://{host}:{port}/", flush=True)
    http.server.ThreadingHTTPServer((host, port), NoCacheHandler).serve_forever()
