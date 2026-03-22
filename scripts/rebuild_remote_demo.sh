#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"
source "${SCRIPT_DIR}/remote_common.sh"

echo ">>> Syncing code to ${REMOTE_TARGET}:${REMOTE_DIR}"
remote_rsync

echo ">>> Running remote demo rebuild"
remote_ssh "cd ${REMOTE_DIR}/demo && bash setup_demo.sh"

echo ">>> Verifying core demo counts"
remote_ssh "python3 - <<'PY'
import json
import urllib.request

base = 'http://localhost:8000/api/v1'

def req(method, path, data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    body = None if data is None else json.dumps(data, ensure_ascii=False).encode('utf-8')
    request = urllib.request.Request(base + path, data=body, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=60) as resp:
        raw = resp.read().decode('utf-8') if resp.status != 204 else ''
        return None if not raw else json.loads(raw)

token = req('POST', '/auth/login', {'username': 'admin', 'password': 'admin123'})['access_token']
summary = {
    'agents': len(req('GET', '/aip/agents', token=token)),
    'documents': len(req('GET', '/documents/', token=token)),
    'objects': req('GET', '/instances/objects?page_size=1', token=token)['total'],
    'links': len(req('GET', '/instances/links', token=token)),
}
print(json.dumps(summary, ensure_ascii=False))
PY"

echo ">>> Remote demo rebuild complete"
