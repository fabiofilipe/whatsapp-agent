FROM oven/bun:1.1.42-slim

RUN apt-get update && apt-get install -y \
    git curl jq postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Genie globally from npm
RUN bun add -g @automagik/genie

WORKDIR /workspace

# Copy workspace (agents + .genie config)
COPY workspace/ /workspace/

# Copy tool sources + install dependencies
COPY tools/ /tools/
WORKDIR /tools
RUN bun install --production --frozen-lockfile 2>/dev/null || bun install --production
WORKDIR /workspace

COPY docker/genie/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
