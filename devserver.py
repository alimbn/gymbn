import functools
import http.server
import sys

port = int(sys.argv[1]) if len(sys.argv) > 1 else 5174
directory = sys.argv[2] if len(sys.argv) > 2 else '.'


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()


Handler = functools.partial(NoCacheHandler, directory=directory)

if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('', port), Handler) as httpd:
        print(f'Serving {directory} on port {port} (no-cache)')
        httpd.serve_forever()
