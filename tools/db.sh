#!/bin/sh
# Executa uma query SQL no banco do agente
# Uso: db.sh "SELECT * FROM user_context WHERE chat_id = '5511999999999@s.whatsapp.net'"
DB_PATH="${AGENT_DB_PATH:-/data/agent.db}"
sqlite3 "$DB_PATH" "$1"
