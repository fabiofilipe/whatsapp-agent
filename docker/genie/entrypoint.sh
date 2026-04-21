#!/bin/sh
set -e

# Corrige permissoes do diretorio de dados do Genie (volume montado como root)
mkdir -p /home/genie/.genie
chown -R genie:genie /home/genie

echo "[genie] Aguardando Postgres em $DATABASE_URL..."
until psql "$DATABASE_URL" -c 'SELECT 1' > /dev/null 2>&1; do
  echo "[genie] Postgres ainda nao esta pronto, aguardando..."
  sleep 2
done
echo "[genie] Postgres conectado."

echo "[genie] Iniciando como usuario genie (SDK executor, sem tmux)..."
exec gosu genie /root/.bun/install/global/bin/genie serve --headless
