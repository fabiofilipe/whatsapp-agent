# Status do Projeto — DueDi

Documento de controle interno. Registra o que foi implementado, o que ainda falta e os bloqueios ativos.

---

## O que foi feito

### Infraestrutura Docker

- [x] `docker-compose.yml` com quatro servicos: `nats`, `omni`, `agent-db`, `genie`
- [x] `docker/omni/Dockerfile` — clona `automagik-dev/omni`, instala dependencias com `bun install --backend=copyfile`, usa `oven/bun:latest`
- [x] `docker/genie/Dockerfile` — instala `@automagik/genie` globalmente, copia workspace e tools, instala `postgresql-client`
- [x] `docker/genie/entrypoint.sh` — aguarda Postgres via `psql` antes de rodar `genie serve --headless`
- [x] `docker/agent-db/init.sql` — schema Postgres com tabelas `empresas` e `consultas_log`, indices e trigger de `updated_at`

### Tools TypeScript

- [x] `tools/types.ts` — tipos derivados da resposta real da BrasilAPI (validados com `curl` direto)
- [x] `tools/db.ts` — cliente Postgres singleton via `postgres.js`
- [x] `tools/risk.ts` — algoritmo de score de risco (0-100) com 6 fatores e classificacao textual
- [x] `tools/helpers.ts` — validacao de CNPJ com digitos verificadores, `fetchComRetry`, `emit` JSON, `validarDataISO`, `nullIfEmpty`
- [x] `tools/consultar-cnpj.ts` — consulta BrasilAPI, calcula risco, upsert em Postgres, loga consulta
- [x] `tools/marcar-empresa.ts` — atualiza status e observacoes com sentinela `-` para limpeza
- [x] `tools/listar-empresas.ts` — listagem com filtro por status e contadores agregados
- [x] `tools/package.json` e `tools/tsconfig.json`

### Definicao do agente

- [x] `workspace/.genie/workspace.json` — marca workspace para o Genie
- [x] `workspace/agents/assistente/AGENTS.md` — system prompt completo (persona DueDi, instrucoes das tools, formato WhatsApp, edge cases, primeiro contato)

### Automacao

- [x] `scripts/setup-omni.sh` — cria instancia WhatsApp, aguarda QR, cria provider `nats-genie`, vincula provider, salva IDs no `.env`

### Documentacao e repositorio

- [x] `README.md` — arquitetura, proposito, decisoes tecnicas, setup em 5 passos, estrutura, variaveis, roadmap
- [x] `.env.example` — documentado com todos os campos
- [x] `.gitignore` — `.env` ignorado
- [x] Repositorio publico: `github.com/fabiofilipe/whatsapp-agent`
- [x] Commits em conventional commits, agrupados por contexto logico

### Qualidade

- [x] Code review automatizado por agente especialista — 20 problemas identificados, criticos e altos corrigidos
- [x] Tipos derivados de resposta real (nao de documentacao)
- [x] SQL parametrizado via tagged templates (sem risco de injection)
- [x] Fetch com retry em 5xx
- [x] Validacao de CNPJ com digitos verificadores

---

## O que falta

### Implementacao pendente

- [x] **Modo nativo com executor tmux** — configurado em `workspace/` e documentado em `scripts/start-genie-local.sh`
- [x] **Testes automatizados** — 5 suites em `tests/` (helpers, risk, db, edge-cases, integration)
- [x] **Teste end-to-end** — agente respondendo no WhatsApp via instancia `duedi` (provider `nats-genie`)

### Melhorias identificadas mas nao prioritarias

- [ ] Rate limiting por chat_id nas tools
- [ ] Watch list (monitoramento periodico de empresas)
- [ ] Analise de rede societaria
- [ ] Exportacao do pipeline para CSV
- [ ] Reconciliar docker-compose (entrypoint morto em `docker/omni/`, comando de QR desatualizado em `setup-omni.sh`) — modo nativo e o suportado; docker virou stretch goal

---

## Proximos passos em ordem de prioridade

1. Validar conversa real de ponta a ponta no WhatsApp (CNPJ → marcar → listar)
2. Capturar transcript real no README substituindo o exemplo ficticio
3. Limpar ou anotar caminho docker como experimental
4. Considerar melhorias nao prioritarias caso sobre tempo

---

## Links uteis

- Repositorio: https://github.com/fabiofilipe/whatsapp-agent
- BrasilAPI docs: https://brasilapi.com.br/docs
- Genie: https://github.com/automagik-dev/genie
- Omni: https://github.com/automagik-dev/omni
- Anthropic console: https://console.anthropic.com/settings/keys
