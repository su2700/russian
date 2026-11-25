"""Google API helper. OAuth tokens remain in process memory and are never logged."""
import json
import shutil
import subprocess
import time
import urllib.error
import urllib.request

PROJECT = 'russian-anastasiay-20261123'
ACCOUNT = 'liuhaolingtitan@gmail.com'
REGION = 'europe-west1'
GCLOUD = shutil.which('gcloud.cmd') or shutil.which('gcloud')
_token_cache = None
_token_time = 0

def cli(*args):
    result = subprocess.run([GCLOUD, *args, '--account=' + ACCOUNT, '--quiet'], capture_output=True, text=True, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

def token():
    global _token_cache, _token_time
    if _token_cache is None or time.time() - _token_time > 2400:
        _token_cache = cli('auth', 'print-access-token')
        _token_time = time.time()
    return _token_cache

def api(method, url, data=None, access_token=None):
    content = json.dumps(data).encode() if data is not None else None
    request = urllib.request.Request(url, data=content, headers={'Authorization': 'Bearer ' + (access_token or token()), 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT}, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as err:
        # API errors contain no request Authorization header or local secret values.
        detail = err.read().decode('utf-8')
        raise RuntimeError(f'{method} {url}: HTTP {err.code}: {detail}') from None

def wait_operation(host, operation):
    while not operation.get('done', False):
        time.sleep(3)
        operation = api('GET', host + '/' + operation['name'])
    if operation.get('error'):
        raise RuntimeError(json.dumps(operation['error']))
    return operation.get('response', {})

if __name__ == '__main__':
    import sys
    if sys.argv[1] == 'firebase':
        endpoint = 'https://firebase.googleapis.com/v1beta1'
        try:
            result = api('GET', endpoint + '/projects/' + PROJECT)
        except RuntimeError as error:
            if 'HTTP 404' not in str(error):
                raise
            result = wait_operation(endpoint, api('POST', endpoint + '/projects/' + PROJECT + ':addFirebase', {}))
        print(json.dumps({'projectId': result.get('projectId'), 'state': result.get('state')}))
        print(json.dumps(api('GET', 'https://firebasehosting.googleapis.com/v1beta1/projects/' + PROJECT + '/sites')))
    elif sys.argv[1] == 'budget':
        number = cli('projects', 'describe', PROJECT, '--format=value(projectNumber)')
        parent = 'https://billingbudgets.googleapis.com/v1/billingAccounts/01CCDE-CB12FE-5FA6D5/budgets'
        existing = api('GET', parent).get('budgets', [])
        name = 'Russian learning - SEK 50 monthly'
        budget = next((item for item in existing if item['displayName'] == name), None)
        if not budget:
            budget = api('POST', parent, {'displayName': name, 'budgetFilter': {'projects': ['projects/' + number], 'calendarPeriod': 'MONTH'}, 'amount': {'specifiedAmount': {'currencyCode': 'SEK', 'units': '50'}}, 'thresholdRules': [{'thresholdPercent': value} for value in [0.5, 0.9, 1.0]], 'notificationsRule': {'disableDefaultIamRecipients': False}})
        print(json.dumps({'budget': budget['name'], 'amount': budget.get('amount'), 'thresholdRules': budget.get('thresholdRules')}))
