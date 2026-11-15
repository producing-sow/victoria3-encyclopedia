"""Loopback-only companion for the offline encyclopedia. No game files are written."""
import argparse
import json
import pathlib
import secrets
import threading
import webbrowser
import sys
import subprocess
import update_mods
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote
import version_history as history

HERE = pathlib.Path(__file__).resolve().parent


class Updater:
    def __init__(self):
        self.token = secrets.token_urlsafe(32)
        self.lock = threading.Lock()
        self.state = {'running': False, 'status': 'idle', 'logs': [], 'result': None}
        self.root = str(history.ROOT)
        self.mods = update_mods.discover(self.root)
        try:
            settings = json.loads((HERE/'updater-settings.json').read_text('utf-8'))
            self.root = settings['root']
            self.mods = settings.get('mods', update_mods.discover(self.root))
        except (OSError, ValueError, KeyError):
            pass

    def view(self):
        with self.lock:
            return {**self.state, 'logs': list(self.state['logs']), 'root': self.root, 'mods': self.mods, 'token': self.token}

    def log(self, message):
        with self.lock:
            self.state['logs'] = (self.state['logs'] + [message])[-300:]

    def start(self, root, mode='vanilla', mods=None):
        root = history.validate_root(root)
        if mode not in ['vanilla', 'mods', 'all']:raise ValueError('更新范围无效。')
        selected = update_mods.validate(mods or {}) if mode != 'vanilla' else {}
        if mode != 'vanilla' and not selected:raise ValueError('请勾选至少一个要更新的 MOD。')
        with self.lock:
            if self.state['running']:
                raise RuntimeError('正在更新，请等待当前任务完成。')
            self.mods = mods if mods is not None else self.mods
            history.atomic_json(HERE/'updater-settings.json', {'root': str(root), 'mods': self.mods})
            self.root = str(root)
            self.state = {'running': True, 'status': 'running', 'logs': [], 'result': None}
        threading.Thread(target=self.run, args=(root, mode, selected), daemon=False).start()

    def run(self, root, mode='vanilla', mods=None):
        try:
            result = {'mode': mode, 'snapshot': None}
            if mode != 'mods':result.update(history.update(root, force=True, log=self.log))
            if mode != 'vanilla':
                if mode == 'all':self.log('原版更新已保存；接下来独立更新 MOD。MOD 失败不会撤销已完成的原版更新。')
                result['mods'] = update_mods.update(root, mods, log=self.log)['mods']
            with self.lock:
                self.state.update(status='success', result=result)
        except Exception as exc:
            self.log(str(exc))
            with self.lock:
                self.state.update(status='error', error=str(exc))
        finally:
            with self.lock:
                self.state['running'] = False


class Handler(SimpleHTTPRequestHandler):
    def handle(self):
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass  # Navigating away may cancel an in-flight poll or asset request.

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(HERE), **kwargs)

    def allowed(self):
        expected = '127.0.0.1:' + str(self.server.server_port)
        origin = self.headers.get('Origin')
        return self.headers.get('Host') == expected and (not origin or origin == 'http://' + expected)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def reply(self, code, value):
        body = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if not self.allowed():
            return self.reply(403, {'error': 'Local access only'})
        path = unquote(urlsplit(self.path).path)
        if path == '/api/update':
            return self.reply(200, self.server.updater.view())
        target = pathlib.Path(self.translate_path(path)).resolve()
        if (not target.is_relative_to(HERE) or any(p.startswith('.') for p in pathlib.PurePosixPath(path).parts)
                or target.is_dir() and path != '/' or target.suffix.lower() not in {'.html','.css','.js','.png','.jpg','.jpeg','.svg','.webp','.ico','.cur','.woff','.woff2','.csv'} and path != '/'):
            return self.reply(404, {'error': 'Not found'})
        super().do_GET()

    def do_POST(self):
        if not self.allowed() or self.headers.get('X-Update-Token') != self.server.updater.token:
            return self.reply(403, {'error': '请刷新本地更新页面后重试。'})
        if self.path not in ['/api/update', '/api/discover-mods']:
            return self.reply(404, {'error': 'Not found'})
        try:
            length = int(self.headers.get('Content-Length', 0))
            if not 0 < length <= 8192:raise ValueError('请求大小无效。')
            data = json.loads(self.rfile.read(length))
            if not isinstance(data.get('root'), str) or not data['root'].strip():raise ValueError('请输入游戏根目录。')
            if self.path == '/api/discover-mods':
                root = history.validate_root(data['root'])
                return self.reply(200, {'mods': update_mods.discover(root)})
            self.server.updater.start(data['root'], data.get('mode','vanilla'), data.get('mods'))
            self.reply(202, {'started': True})
        except (ValueError, OSError) as exc:
            self.reply(400, {'error': str(exc)})
        except RuntimeError as exc:
            self.reply(409, {'error': str(exc)})

    def log_message(self, *_):
        pass


def register_protocol():
    """User-scoped association; invoked by the local launcher, never by a web request."""
    if sys.platform != 'win32':return
    import winreg
    command = subprocess.list2cmdline([sys.executable, '-B', str(HERE/'update_server.py'), '--protocol'])+' "%1"'
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r'Software\Classes\v3encyclopedia') as key:
        winreg.SetValueEx(key, '', 0, winreg.REG_SZ, 'URL:Victoria 3 Encyclopedia')
        winreg.SetValueEx(key, 'URL Protocol', 0, winreg.REG_SZ, '')
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r'Software\Classes\v3encyclopedia\shell\open\command') as key:
        winreg.SetValueEx(key, '', 0, winreg.REG_SZ, command)
    print('已启用百科内的“启动本地更新”入口。', flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=0)
    parser.add_argument('--page', choices=['index.html', 'update.html'], default='update.html')
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--register-protocol', action='store_true')
    parser.add_argument('--protocol')
    args = parser.parse_args()
    if args.protocol and args.protocol.rstrip('/') != 'v3encyclopedia://update':
        parser.error('Unsupported encyclopedia link')
    if args.register_protocol:
        try:register_protocol()
        except OSError as exc:print('本地启动入口注册失败，仍可使用当前更新页面：'+str(exc), flush=True)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    server.updater = Updater()
    url = f'http://127.0.0.1:{server.server_port}/{args.page}'
    print(url, flush=True)
    print('百科本地服务已启动。更新时请保留此窗口。按 Ctrl+C 关闭。', flush=True)
    if not args.no_browser:webbrowser.open(url)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()


if __name__ == '__main__':main()
