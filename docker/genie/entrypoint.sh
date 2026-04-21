#!/bin/sh
set -e

# Aguarda Postgres ficar pronto
echo "[genie] Aguardando Postgres em $DATABASE_URL..."
until psql "$DATABASE_URL" -c 'SELECT 1' > /dev/null 2>&1; do
  echo "[genie] Postgres ainda não está pronto, aguardando..."
  sleep 2
done
echo "[genie] Postgres conectado."

echo "[genie] Iniciando em modo headless (SDK executor)..."
exec genie serve --headless
