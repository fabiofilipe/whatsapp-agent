FROM oven/bun:latest

# Instala o Omni CLI que inclui o servidor pre-compilado (dist/server/index.js)
# Evita buildar o monorepo completo — o pacote publicado ja vem com tudo bundlado
RUN bun add -g @automagik/omni

EXPOSE 8882

CMD ["bun", "/root/.bun/install/global/node_modules/@automagik/omni/dist/server/index.js"]
