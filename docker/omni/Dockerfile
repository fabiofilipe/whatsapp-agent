FROM oven/bun:latest

# Instala Omni via pacote publicado (inclui servidor pre-compilado)
# Rodando como root e sem pgserve embutido — banco externo via DATABASE_URL
RUN bun add -g @automagik/omni

EXPOSE 8882

CMD ["bun", "/root/.bun/install/global/node_modules/@automagik/omni/dist/server/index.js"]
