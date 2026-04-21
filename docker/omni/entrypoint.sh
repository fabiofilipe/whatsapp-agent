#!/bin/sh
set -e

# Garante permissoes corretas no diretorio de dados do Postgres
# (o volume Docker e montado como root; pgserve precisa rodar como nao-root)
mkdir -p /omni-data/pgserve
chown -R omni:omni /omni-data

# Troca para usuario omni e inicia o servidor
exec gosu omni bun /root/.bun/install/global/node_modules/@automagik/omni/dist/server/index.js
