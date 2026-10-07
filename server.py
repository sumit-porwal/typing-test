import http.server
import socketserver
import json
import os
import sys

PORT = 3000

class KeyVibeServer(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent aggressive browser caching during development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/save-calibration':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)
                payload = json.loads(post_data.decode('utf-8'))
                
                content = payload.get('content', '')
                if not content:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'error', 'message': 'No content provided'}).encode('utf-8'))
                    return

                target_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'depricated', 'js', 'fingerCalibration.js')
                with open(target_file, 'w', encoding='utf-8') as f:
                    f.write(content)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'ok', 'message': 'Successfully saved depricated/js/fingerCalibration.js'}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        else:
            self.send_error(404, 'Endpoint not found')

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    try:
        with socketserver.ThreadingTCPServer(('0.0.0.0', port), KeyVibeServer) as httpd:
            print(f"KeyVibe Studio running at http://localhost:{port}/")
            print(f"Calibration API enabled at http://localhost:{port}/api/save-calibration")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
