"""Create only the dedicated site's resources; keep generated credentials local."""
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
from cloud import PROJECT, ACCOUNT, REGION, api, cli

root = Path(__file__).resolve().parent.parent
local = root / '.local'
local.mkdir(exist_ok=True)
if os.name == 'nt':
    identity = subprocess.check_output(['whoami'], text=True).strip()
    subprocess.run(['icacls', str(local), '/inheritance:r', '/grant:r', identity + ':(OI)(CI)F', 'SYSTEM:(OI)(CI)F'], capture_output=True, check=True)
config_file = local / 'auth.json'
if not config_file.exists():
    password = secrets.token_urlsafe(18)
    salt = secrets.token_hex(16)
    config = {'salt': salt, 'passwordHash': hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=32).hex(), 'key': secrets.token_urlsafe(48), 'version': secrets.token_hex(8)}
    config_file.write_text(json.dumps(config), encoding='utf-8')
    (local / 'access.txt').write_text('Russian classroom\n\nWebsite: https://' + PROJECT + '.web.app\nCustom domain: https://anastasiay.ipv64.net (pending DNS)\n\nShared password: ' + password + '\n\nKeep this file private. Do not upload or commit it.\n', encoding='utf-8')
print('Local credentials prepared; secret values are not printed.', flush=True)
iam = 'https://iam.googleapis.com/v1/projects/' + PROJECT + '/serviceAccounts'
for name, title in [('reader-builder', 'Build Russian classroom'), ('reader-runtime', 'Run Russian classroom')]:
    address = name + '@' + PROJECT + '.iam.gserviceaccount.com'
    try:
        api('GET', iam + '/' + address)
    except RuntimeError as error:
        if 'HTTP 404' not in str(error): raise
        api('POST', iam, {'accountId': name, 'serviceAccount': {'displayName': title}})
    print('Service account ready: ' + name, flush=True)
crm = 'https://cloudresourcemanager.googleapis.com/v1/projects/' + PROJECT
policy = api('POST', crm + ':getIamPolicy', {})
bindings = policy.setdefault('bindings', [])
member = 'serviceAccount:reader-builder@' + PROJECT + '.iam.gserviceaccount.com'
for role in ['roles/artifactregistry.writer', 'roles/logging.logWriter', 'roles/storage.objectViewer', 'roles/serviceusage.serviceUsageConsumer']:
    binding = next((b for b in bindings if b['role'] == role and 'condition' not in b), None)
    if binding is None:
        binding = {'role': role, 'members': []}
        bindings.append(binding)
    if member not in binding['members']: binding['members'].append(member)
api('POST', crm + ':setIamPolicy', {'policy': policy})
print('Build account permissions configured.', flush=True)
parent = 'https://artifactregistry.googleapis.com/v1/projects/' + PROJECT + '/locations/' + REGION
try:
    api('GET', parent + '/repositories/russian-reader')
except RuntimeError as error:
    if 'HTTP 404' not in str(error): raise
    from cloud import wait_operation
    wait_operation('https://artifactregistry.googleapis.com/v1', api('POST', parent + '/repositories?repositoryId=russian-reader', {'format': 'DOCKER', 'description': 'Private Russian classroom images', 'cleanupPolicies': {'keep-recent': {'action': 'KEEP', 'mostRecentVersions': {'keepCount': 2}}, 'remove-old': {'action': 'DELETE', 'condition': {'olderThan': '604800s', 'tagState': 'ANY'}}}, 'cleanupPolicyDryRun': False}))
print('Image repository ready with old-image cleanup.', flush=True)
sm = 'https://secretmanager.googleapis.com/v1/projects/' + PROJECT + '/secrets'
try:
    api('GET', sm + '/reader-auth')
except RuntimeError as error:
    if 'HTTP 404' not in str(error): raise
    api('POST', sm + '?secretId=reader-auth', {'replication': {'userManaged': {'replicas': [{'location': REGION}]}}})
versions = api('GET', sm + '/reader-auth/versions').get('versions', [])
if not versions:
    api('POST', sm + '/reader-auth:addVersion', {'payload': {'data': base64.b64encode(config_file.read_bytes()).decode()}})
api('POST', sm + '/reader-auth:setIamPolicy', {'policy': {'bindings': [{'role': 'roles/secretmanager.secretAccessor', 'members': ['serviceAccount:reader-runtime@' + PROJECT + '.iam.gserviceaccount.com']}]}})
print('Authentication secret ready; access limited to the runtime account.', flush=True)
