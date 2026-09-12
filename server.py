import http.server
import socketserver
import webbrowser
import os
import sys
import socket

PORT = 8888

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    local_ip = get_local_ip()
    handler = CustomHTTPRequestHandler
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        url_local = f"http://localhost:{PORT}"
        url_network = f"http://{local_ip}:{PORT}"
        print("==========================================================================")
        print("  AGRIBANK CHI NHANH PHU THO - PORTAL SERVER")
        print(f"  Truy cap tren may nay: {url_local}")
        print(f"  Truy cap tu DI DONG / MAY TINH KHAC cung Wi-Fi: {url_network}")
        print("==========================================================================")
        try:
            webbrowser.open(url_local)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
