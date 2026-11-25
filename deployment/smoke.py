"""Verify Access edge protection and reject direct origin / legacy-password bypasses.

A real OTP login is checked separately in the browser; no session cookie is
exported from the browser or saved by this script.
"""
import base64
import hashlib
import hmac
import ipaddress
import json
import os
from pathlib import Path
import socket
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
BASE = os.environ.get('SMOKE_BASE_URL', 'https://anastasiay.ipv64.net').rstrip('/')
ORIGIN = 'https://russian-reader-103843597903.europe-west1.run.app'
RESOLVE_IP = os.environ.get('SMOKE_RESOLVE_IP')
if RESOLVE_IP:
    ipaddress.ip_address(RESOLVE_IP)
    resolve = socket.getaddrinfo
    hostname = urllib.parse.urlparse(BASE).hostname
    def smoke_resolve(host, *args, **kwargs):
        return resolve(RESOLVE_IP if host == hostname else host, *args, **kwargs)
    socket.getaddrinfo = smoke_resolve

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None

def request(opener, url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers={'User-Agent': 'RussianClassroomDeploymentCheck/1.0', **(headers or {})})
    try:
        with opener.open(req, timeout=45) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.headers, error.read()

def main():
    settings = json.loads((ROOT / '.local/access-settings.json').read_text(encoding='utf-8'))
    manifest = json.loads((ROOT / '.deploy/manifest.json').read_text(encoding='utf-8'))
    opener = urllib.request.build_opener(NoRedirect)
    code, headers, body = request(opener, ORIGIN + '/public/teacher-cartoon-v1.png')
    assert code == 200 and headers.get('Content-Type') == 'image/png'
    assert hashlib.sha256(body).digest() == hashlib.sha256((ROOT / 'assets/teacher-cartoon.png').read_bytes()).digest()
    print('PASS: only the intended cartoon avatar is available for the pre-login page.', flush=True)
    for route in ['/', '/login', *manifest, '/.local/access-auth.json', '/public/', '/assets/teacher-cartoon.png', '/public/teacher-reference.jpg']:
        code, _, body = request(opener, ORIGIN + urllib.parse.quote(route), headers={'If-None-Match': '*'})
        assert code == 403, ('Origin bypass', route, code)
    print('PASS: every protected origin route rejects direct access, including cache requests.', flush=True)
    if (ROOT / '.local/auth.json').exists():
        old = json.loads((ROOT / '.local/auth.json').read_text(encoding='utf-8'))
        payload = base64.urlsafe_b64encode(json.dumps({'exp': int(time.time()) + 86400, 'version': old['version'], 'nonce': 'legacy-test'}).encode()).decode().rstrip('=')
        signature = base64.urlsafe_b64encode(hmac.new(old['key'].encode(), payload.encode(), hashlib.sha256).digest()).decode().rstrip('=')
        assert request(opener, ORIGIN + '/', headers={'Cookie': '__session=' + payload + '.' + signature})[0] == 403
    assert request(opener, ORIGIN + '/login', data=b'password=old-password', headers={'Content-Type': 'application/x-www-form-urlencoded'})[0] == 403
    assert request(opener, ORIGIN + '/', headers={'Cf-Access-Authenticated-User-Email': 'lhllfc@gmail.com', 'Cf-Access-Jwt-Assertion': 'forged', 'X-Reader-Origin-Key': 'forged'})[0] == 403
    print('PASS: old password sessions, password POSTs and forged identity headers are denied.', flush=True)
    for route in ['/', *manifest]:
        code, headers, _ = request(opener, BASE + urllib.parse.quote(route))
        assert code in [302, 303] and headers.get('Location', '').startswith(settings['issuer'] + '/'), ('Access edge not enforced', route, code)
    print('PASS: the public website and all four course routes require Cloudflare Access login.', flush=True)
    worker = 'https://russian-reader-domain.noah-h-liu.workers.dev'
    code, headers, _ = request(opener, worker + '/')
    assert code in [403, 404] or (code in [302, 303] and headers.get('Location', '').startswith(settings['issuer'] + '/')), ('Worker bypass', code)
    print('PASS: alternate Worker hostname cannot bypass Access.', flush=True)
    result = {'url': BASE, 'anonymousChecksPassed': True, 'identityLoginVerified': False, 'dnsOverride': RESOLVE_IP}
    (ROOT / '.local/access-smoke-result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result), flush=True)

if __name__ == '__main__':
    main()
