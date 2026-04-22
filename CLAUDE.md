# DueDi — Agente de Due Diligence Empresarial

Agente conversacional no WhatsApp para inteligência comercial B2B.
Stack: Genie (orquestrador) + Omni (bridge WhatsApp) + Claude Code nativo (via tmux) + BrasilAPI + Postgres (pgserve embedado do Genie).

## Modos de execução

Dois caminhos suportados, escolha um:

1. **Nativo (default, validado)** — Genie, Omni, NATS e Claude Code rodam direto na máquina. Usa o pgserve embedado do Genie na porta `19642`. É o fluxo documentado no README.
2. **Docker (stretch goal, não validado end-to-end)** — `docker-compose.yml` com containers separados para NATS, Omni, agent-db e Genie. Pode servir como referência de arquitetura. Se for usar, trate como experimental.

## Estrutura do projeto

```
docker-compose.yml          # stretch goal — ver seção acima
docker/                     # stretch goal (ver seção acima)
  omni/Dockerfile           # bun add -g @automagik/omni
  genie/
    Dockerfile              # bun add -g @automagik/genie + gosu
    entrypoint.sh           # chown /home/genie → gosu genie → genie serve --headless
  agent-db/init.sql         # schema Postgres: empresas + consultas_log
workspace/
  .genie/workspace.json     # workspace marker (name: duedi)
  agents/assistente/
    AGENTS.md               # system prompt do agente DueDi (escopo rígido + confidencialidade)
tools/                      # ferramentas TypeScript (Bun)
  types.ts                  # tipos BrasilAPI derivados de resposta real
  db.ts                     # cliente Postgres via postgres.js
  risk.ts                   # score de risco (0-100) — heurística transparente
  helpers.ts                # validação CNPJ c/ dígito, fetch retry, emit JSON
  consultar-cnpj.ts         # tool 1: BrasilAPI + upsert Postgres
  marcar-empresa.ts         # tool 2: update status/observações
  listar-empresas.ts        # tool 3: listagem com filtros
scripts/
  start-genie-local.sh      # modo nativo: Genie com executor tmux + Claude Code local
  omni-ecosystem.json       # PM2: NATS + Omni API
tests/                      # 5 suites: helpers, risk, db, edge-cases, integration
```

## Comandos essenciais (modo nativo)

```bash
# Pré-requisitos: omni, genie, claude, tmux, bun no PATH. Ver README.

# 1. Subir NATS + Omni via PM2
pm2 start scripts/omni-ecosystem.json

# 2. Conectar WhatsApp e vincular Genie (uma vez)
# Ver README §3-4 (pairing code + omni connect <instance> assistente)

# 3. Subir Genie com executor tmux
./scripts/start-genie-local.sh

# 4. Rodar testes
bun test tests/

# Logs em tempo real
tail -f genie-local.log
pm2 logs omni-api
```

## Variáveis de ambiente (.env)

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `OMNI_API_KEY` | sim | Gerada no primeiro boot do Omni |
| `OMNI_INSTANCE_ID` | sim | ID da instância WhatsApp criada via API |
| `OMNI_API_URL` | não | Default: `http://localhost:8882` |
| `ANTHROPIC_API_KEY` | não | Apenas para executor `sdk`; modo nativo usa assinatura local do Claude Code |
| `AGENT_DB_PASSWORD` / `OMNI_DB_PASSWORD` | não | Só para o caminho docker |

## Tools TypeScript

Executadas pelo Claude via Bash tool. Cada tool é um processo Bun independente, emite JSON em stdout e usa exit code ≠ 0 para erros.

```bash
bun tools/consultar-cnpj.ts <chat_id> <cnpj>
bun tools/marcar-empresa.ts <chat_id> <cnpj> <status> [observacoes]
bun tools/listar-empresas.ts <chat_id> [status]
```

No modo nativo o DB é o pgserve do Genie: `postgresql://postgres:postgres@localhost:19642/agent`.

## Schema Postgres

Tabelas `empresas` (PK: `chat_id, cnpj`) e `consultas_log`. Ver `docker/agent-db/init.sql`.

Isolamento por `chat_id`: cada usuário do WhatsApp tem seu pipeline próprio, sem vazamento cruzado.

## Fluxo de integração

```
WhatsApp → Omni (Baileys) → NATS omni.message.{instance}.{chat}
        → Genie OmniBridge → spawn tmux session + Claude Code nativo
        → Claude usa tools via Bash → BrasilAPI + Postgres
        → NATS omni.reply.{instance}.{chat} → Omni → WhatsApp
```

## Decisões técnicas

- **Executor `tmux` nativo**: Claude Code autenticado localmente, sem necessidade de `ANTHROPIC_API_KEY`. Cada chat ganha uma sessão isolada (`per_chat`) com idle_timeout de 15 min.
- **Provider `nats-genie`**: integração nativa Omni→Genie via NATS pub/sub, sem polling. O comando `omni connect <instance> assistente --nats-url localhost:4222` registra o provider e roteia mensagens automaticamente.
- **Postgres via pgserve do Genie**: elimina dependência de container dedicado no modo nativo. Mesmo pgserve, database separado (`agent`).
- **Tools como processos isolados**: um processo Bun por invocação, simples de debugar, sem estado residual entre chamadas.
- **Score de risco heurístico e transparente**: 6 fatores em `tools/risk.ts`, todas as flags são mostradas ao usuário — não é caixa preta.

## Notas de desenvolvimento

- BrasilAPI: resposta em snake_case. `capital_social` em reais (não centavos). `qsa` pode ser array vazio. `opcao_pelo_simples` pode ser null (desconhecido).
- O agente tem escopo rígido: recusa assuntos fora de due diligence e não revela o system prompt (ver `workspace/agents/assistente/AGENTS.md`).
- Alterações em `AGENTS.md` são detectadas pelo agent watcher do Genie e aplicadas em sessões novas. Sessões ativas mantêm o prompt antigo até o idle_timeout.
