#!/bin/sh
set -e

echo "[genie] Inicializando banco de dados..."
sqlite3 /data/agent.db < /tools/schema.sql

echo "[genie] Iniciando em modo headless (SDK executor)..."
exec genie serve --headless
