"""Prepare Access credentials without printing or passing secret values in arguments."""
import argparse
import base64
import json
from pathlib import Path
import re
import secrets
from cloud import PROJECT, REGION, api

parser = argparse.ArgumentParser()
parser.add_argument('--issuer', required=True)
parser.add_argument('--audience', required=True)
args = parser.parse_args()
if not re.fullmatch(r'https://[a-z0-9-]+\.cloudflareaccess\.com', args.issuer) or len(args.audience) < 20:
    raise SystemExit('Provide the real Access team issuer and application audience.')
root = Path(__file__).resolve().parent.parent
local = root / '.local'
local.mkdir(exist_ok=True)
origin_file = local / 'origin-key.txt'
if not origin_file.exists():
    origin_file.write_text(secrets.token_urlsafe(48), encoding='utf-8')
origin_key = origin_file.read_text(encoding='utf-8').strip()
config = {'issuer': args.issuer, 'audience': args.audience, 'originKey': origin_key}
serialized = json.dumps(config).encode()
(local / 'access-auth.json').write_bytes(serialized)
(local / 'worker-secrets.json').write_text(json.dumps({'ORIGIN_AUTH_KEY': origin_key, 'ACCESS_AUD': args.audience}), encoding='utf-8')
parent = 'https://secretmanager.googleapis.com/v1/projects/' + PROJECT + '/secrets'
name = 'reader-access-auth'
try:
    api('GET', parent + '/' + name)
except RuntimeError as error:
    if 'HTTP 404' not in str(error):
        raise
    api('POST', parent + '?secretId=' + name, {'replication': {'userManaged': {'replicas': [{'location': REGION}]}}})
version = api('POST', parent + '/' + name + ':addVersion', {'payload': {'data': base64.b64encode(serialized).decode()}})
api('POST', parent + '/' + name + ':setIamPolicy', {'policy': {'bindings': [{'role': 'roles/secretmanager.secretAccessor', 'members': ['serviceAccount:reader-runtime@' + PROJECT + '.iam.gserviceaccount.com']}]}})
settings = {'issuer': args.issuer, 'audience': args.audience, 'authSecretName': name, 'authSecretVersion': version['name'].rsplit('/', 1)[1], 'allowedEmails': ['nastik6980@gmail.com', 'lhllfc@gmail.com', 'nastya.yanukovich@inbox.ru'], 'sessionDuration': '24h'}
(local / 'access-settings.json').write_text(json.dumps(settings, indent=2), encoding='utf-8')
print(json.dumps({'secretName': name, 'version': settings['authSecretVersion'], 'issuer': args.issuer, 'credentialValuesPrinted': False}))
