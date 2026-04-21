FROM oven/bun:latest

# Instalacoes como root (evita SIGBUS do Docker Desktop/WSL2 em usuarios nao-root)
RUN apt-get update && apt-get install -y curl postgresql-client gosu && rm -rf /var/lib/apt/lists/*

# Instala Genie como root
RUN bun add -g @automagik/genie

# Cria usuario nao-root para o pgserve (initdb recusa root)
RUN useradd -m -u 1001 -s /bin/bash genie && \
    chmod o+rx /root && \
    chmod -R o+rx /root/.bun

# Copia workspace e tools como root, ajusta ownership para genie
COPY workspace/ /workspace/
COPY tools/ /tools/
RUN chown -R genie:genie /workspace /tools && \
    cd /tools && bun install --production

COPY docker/genie/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/entrypoint.sh"]
