FROM oven/bun:1.1.42-slim

RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Clona Omni na versão estável
RUN git clone --depth 1 https://github.com/automagik-dev/omni.git .

RUN bun install --frozen-lockfile

EXPOSE 8882

CMD ["bun", "packages/api/src/index.ts"]
