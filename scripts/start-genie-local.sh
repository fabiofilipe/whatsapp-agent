#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="$PROJECT_ROOT/workspace"
GENIE_HOME_DIR="${GENIE_HOME:-$PROJECT_ROOT/.genie-home}"
LOG_FILE="${GENIE_LOG_FILE:-$PROJECT_ROOT/genie-local.log}"

export PATH="$HOME/.bun/bin:$PATH"

for node_bin in "$HOME"/.nvm/versions/node/*/bin; do
  if [ -d "$node_bin" ]; then
    export PATH="$node_bin:$PATH"
  fi
done

if [ -f "$PROJECT_ROOT/.env" ]; then
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env"
fi

require_bin() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "[start-genie-local] binario ausente: $name" >&2
    exit 1
  fi
}

require_bin genie
require_bin claude

if ! command -v tmux >/dev/null 2>&1; then
  echo "[start-genie-local] tmux nao encontrado no PATH" >&2
  exit 1
fi

if ! command -v nc >/dev/null 2>&1; then
  echo "[start-genie-local] nc nao encontrado; ignorando check de NATS"
elif ! nc -z localhost 4222 >/dev/null 2>&1; then
  echo "[start-genie-local] NATS nao esta ouvindo em localhost:4222" >&2
  exit 1
fi

mkdir -p "$GENIE_HOME_DIR"

export GENIE_HOME="$GENIE_HOME_DIR"
export GENIE_EXECUTOR="${GENIE_EXECUTOR:-tmux}"
export GENIE_NATS_URL="${GENIE_NATS_URL:-localhost:4222}"
export OMNI_API_URL="${OMNI_API_URL:-http://localhost:8882}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:19642/agent}"

cd "$WORKSPACE_DIR"

echo "[start-genie-local] workspace: $WORKSPACE_DIR"
echo "[start-genie-local] genie_home: $GENIE_HOME"
echo "[start-genie-local] executor: $GENIE_EXECUTOR"
echo "[start-genie-local] log: $LOG_FILE"
echo "[start-genie-local] claude: $(command -v claude)"
echo "[start-genie-local] genie: $(command -v genie)"
echo "[start-genie-local] iniciando genie serve --headless"

exec genie serve --headless 2>&1 | tee "$LOG_FILE"
