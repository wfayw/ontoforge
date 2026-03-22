#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"
source "${SCRIPT_DIR}/remote_common.sh"

echo ">>> Syncing code to ${REMOTE_TARGET}:${REMOTE_DIR}"
remote_rsync

echo ">>> Rebuilding and restarting services"
remote_ssh "cd ${REMOTE_DIR} && docker compose up -d --build backend frontend"

echo ">>> Checking service health"
remote_ssh "cd ${REMOTE_DIR} && docker compose ps && curl -fsS http://localhost:8000/health && echo"

echo ">>> Remote deploy complete"
