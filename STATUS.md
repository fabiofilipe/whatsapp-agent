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

### Bloqueios ativos

- [ ] **Docker Desktop com SIGBUS** — `docker compose build omni` crasha com `panic during panic / SIGBUS: bus error`. Causa: problema de montagem do VHDX no WSL2. Tentativas feitas: `wsl --shutdown`, `bun install --backend=copyfile`, `oven/bun:latest`. Nao resolvido.
- [ ] **ANTHROPIC_API_KEY** — necessaria para o executor SDK do Genie. Sem ela o agente nao processa mensagens. Opcao gratuita identificada: executor `tmux` usa Claude Code CLI ja autenticado, mas requer Docker funcionando ou setup nativo.

### Implementacao pendente

- [ ] **Build dos containers** — bloqueado pelo Docker Desktop
- [ ] **Conexao WhatsApp via QR** — depende do build do Omni
- [ ] **Teste end-to-end** — depende dos dois itens acima
- [ ] **Dois modos de execucao (dev/prod)** — plano definido, nao implementado:
  - `docker-compose.infra.yml` para desenvolvimento (sem genie, agent-db com porta 5432 exposta)
  - `scripts/start-dev.sh` para rodar Genie nativo no WSL2 com executor tmux
  - Secao no README documentando ambos os modos
- [ ] **Testes automatizados** — nao implementado

### Melhorias identificadas mas nao prioritarias

- [ ] Rate limiting por chat_id nas tools
- [ ] Watch list (monitoramento periodico de empresas)
- [ ] Analise de rede societaria
- [ ] Exportacao do pipeline para CSV

---

## Bloqueios e decisoes pendentes

| Item | Situacao | Acao necessaria |
|------|----------|-----------------|
| Docker SIGBUS | Ativo | Reinstalar Docker Desktop ou usar maquina Linux pura |
| ANTHROPIC_API_KEY | Pendente | Criar conta em console.anthropic.com (creditos gratuitos em contas novas) ou usar executor tmux |
| WhatsApp para testes | Pendente | Numero disponivel, aguarda Docker funcionar |
| Dois modos de execucao | Planejado | Implementar apos Docker resolver |
| Testes automatizados | Nao iniciado | Implementar se sobrar tempo |

---

## Proximos passos em ordem de prioridade

1. Resolver Docker Desktop (SIGBUS/VHDX)
2. Obter ANTHROPIC_API_KEY
3. `docker compose build` completo
4. `docker compose up nats omni agent-db`
5. `./scripts/setup-omni.sh` — conectar WhatsApp
6. `docker compose up genie`
7. Teste end-to-end com mensagem real
8. Implementar dois modos (dev/prod)
9. Testes automatizados
10. Commit final

---

## Links uteis

- Repositorio: https://github.com/fabiofilipe/whatsapp-agent
- BrasilAPI docs: https://brasilapi.com.br/docs
- Genie: https://github.com/automagik-dev/genie
- Omni: https://github.com/automagik-dev/omni
- Anthropic console: https://console.anthropic.com/settings/keys
