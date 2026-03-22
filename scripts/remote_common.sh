#!/usr/bin/env bash

set -euo pipefail

REMOTE_HOST="${ONTOFORGE_REMOTE_HOST:-10.201.0.202}"
REMOTE_USER="${ONTOFORGE_REMOTE_USER:-root}"
REMOTE_PORT="${ONTOFORGE_REMOTE_PORT:-22}"
REMOTE_DIR="${ONTOFORGE_REMOTE_DIR:-/root/ontoforge}"
REMOTE_TARGET="${REMOTE_USER}@${REMOTE_HOST}"

SSH_OPTS=(
  -o StrictHostKeyChecking=no
  -p "${REMOTE_PORT}"
)

if [[ -n "${ONTOFORGE_SSH_PASSWORD:-}" ]]; then
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "sshpass is required when ONTOFORGE_SSH_PASSWORD is set." >&2
    exit 1
  fi
  SSH_PREFIX=(env "SSHPASS=${ONTOFORGE_SSH_PASSWORD}" sshpass -e)
else
  SSH_PREFIX=()
fi

remote_ssh() {
  "${SSH_PREFIX[@]}" ssh "${SSH_OPTS[@]}" "${REMOTE_TARGET}" "$@"
}

remote_rsync() {
  local ssh_cmd=("ssh" "${SSH_OPTS[@]}")
  if [[ ${#SSH_PREFIX[@]} -gt 0 ]]; then
    "${SSH_PREFIX[@]}" rsync -az --delete \
      --exclude='.git' \
      --exclude='node_modules' \
      --exclude='__pycache__' \
      --exclude='.venv' \
      --exclude='*.pyc' \
      --exclude='frontend/dist' \
      -e "${ssh_cmd[*]}" \
      ./ "${REMOTE_TARGET}:${REMOTE_DIR}/"
  else
    rsync -az --delete \
      --exclude='.git' \
      --exclude='node_modules' \
      --exclude='__pycache__' \
      --exclude='.venv' \
      --exclude='*.pyc' \
      --exclude='frontend/dist' \
      -e "${ssh_cmd[*]}" \
      ./ "${REMOTE_TARGET}:${REMOTE_DIR}/"
  fi
}
