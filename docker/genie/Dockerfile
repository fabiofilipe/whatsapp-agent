FROM oven/bun:1.1.42-slim

RUN apt-get update && apt-get install -y \
    git curl jq sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Genie globally from npm
RUN bun add -g @automagik/genie

WORKDIR /workspace

# Copy workspace (agents + .genie config)
COPY workspace/ /workspace/

# Copy tool scripts
COPY tools/ /tools/
RUN chmod +x /tools/*.sh

# Data volume para SQLite e estado persistido
RUN mkdir -p /data

COPY docker/genie/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
