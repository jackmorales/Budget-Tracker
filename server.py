#!/usr/bin/env python3
"""Dev server with no-cache headers for ES modules."""
import http.server
import os
import sys

# Serve from the script's directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    server = http.server.HTTPServer(('', port), NoCacheHandler)
    print(f'Serving on http://localhost:{port}')
    server.serve_forever()
