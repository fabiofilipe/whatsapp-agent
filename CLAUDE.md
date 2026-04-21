# DueDi — Agente de Due Diligence Empresarial

Agente conversacional no WhatsApp para inteligência comercial B2B.
Stack: Genie (orquestrador) + Omni (bridge WhatsApp) + BrasilAPI + Postgres.

## Estrutura do projeto

```
docker-compose.yml          # nats + omni-db + omni + agent-db + genie
docker/
  omni/Dockerfile           # bun add -g @automagik/omni + servidor pre-compilado
  genie/
    Dockerfile              # bun add -g @automagik/genie + gosu para usuario nao-root
    entrypoint.sh           # chown /home/genie → gosu genie → genie serve --headless
  agent-db/init.sql         # schema Postgres: tabelas empresas + consultas_log
workspace/
  .genie/workspace.json     # workspace marker (name: duedi)
  agents/assistente/
    AGENTS.md               # system prompt do agente DueDi
tools/                      # ferramentas TypeScript (Bun)
  types.ts                  # tipos BrasilAPI derivados de resposta real
  db.ts                     # cliente Postgres via postgres.js
  risk.ts                   # algoritmo de score de risco (0-100)
  helpers.ts                # validacao CNPJ, fetch retry, emit JSON
  consultar-cnpj.ts         # tool 1: BrasilAPI + upsert Postgres
  marcar-empresa.ts         # tool 2: update status/observacoes
  listar-empresas.ts        # tool 3: listagem com filtros
  package.json / tsconfig.json
scripts/
  setup-omni.sh             # cria instancia WhatsApp + provider nats-genie
```

## Comandos essenciais

```bash
# Build completo
docker compose build

# Subir infraestrutura (primeira vez)
docker compose up nats omni-db omni agent-db -d

# Pegar OMNI_API_KEY do log e colocar no .env
docker compose logs omni | grep "API Key"

# Configurar WhatsApp (QR code)
./scripts/setup-omni.sh

# Subir agente
docker compose up genie -d

# Logs em tempo real
docker compose logs -f genie
docker compose logs -f omni
```

## Variaveis de ambiente (.env)

| Variavel | Descricao |
|----------|-----------|
| `ANTHROPIC_API_KEY` | API key da Anthropic (obrigatorio) |
| `OMNI_API_KEY` | Gerada no primeiro boot do Omni |
| `AGENT_DB_PASSWORD` | Senha do Postgres do agente (default: agent) |
| `OMNI_DB_PASSWORD` | Senha do Postgres do Omni (default: omni) |

## Tools TypeScript

Executadas pelo Claude via Bash tool. Cada tool e um processo Bun independente.

```bash
# Dentro do container genie ou com DATABASE_URL setado:
bun /tools/consultar-cnpj.ts <chat_id> <cnpj>
bun /tools/marcar-empresa.ts <chat_id> <cnpj> <status> [observacoes]
bun /tools/listar-empresas.ts <chat_id> [status]
```

## Schema Postgres (agent-db)

```sql
-- empresas: pipeline de due diligence por usuario (chat_id)
-- consultas_log: historico de chamadas a BrasilAPI
```

Ver `docker/agent-db/init.sql` para schema completo.

## Fluxo de integracao

```
WhatsApp → Omni (Baileys) → NATS omni.message.{instance}.{chat}
        → Genie OmniBridge → Claude SDK session
        → Claude usa tools via Bash
        → NATS omni.reply.{instance}.{chat} → Omni → WhatsApp
```

## Decisoes tecnicas

- `GENIE_EXECUTOR=sdk`: sem tmux, funciona em container
- `PGSERVE_EMBEDDED=false` no Omni: usa Postgres externo (omni-db)
- Provider `nats-genie`: integracao nativa Omni→Genie via NATS pub/sub
- Genie roda como usuario `genie` (uid 1001) via gosu: pgserve (initdb) nao aceita root
- Tools com validacao de CNPJ (digitos verificadores) e fetch com retry

## Notas de desenvolvimento

- BrasilAPI: resposta em snake_case (razao_social, cnae_fiscal, etc.)
- `capital_social` vem em reais (nao centavos)
- `qsa` (socios) pode ser array vazio
- `opcao_pelo_simples` pode ser null (desconhecido), nao apenas true/false
- O score de risco e heuristico e transparente — veja `tools/risk.ts`
