# DueDi — Agente de Due Diligence Empresarial via WhatsApp

Agente conversacional de inteligência comercial B2B que consulta CNPJ, avalia risco e gerencia um pipeline de empresas operado por WhatsApp. A stack integra **Claude Code** (assinatura local via tmux), **Genie** (orquestrador), **Omni** (bridge WhatsApp/Baileys) e **Postgres** (persistência via pgserve embedado do Genie).

---

## Propósito

Todo profissional brasileiro que negocia B2B precisa validar empresas antes de fechar negócio. O processo é manual, exige consultar vários sites e leva ~30 minutos por empresa. O DueDi resolve isso em segundos, dentro do WhatsApp.

Exemplo de interação:

```
Usuário: 47960950000121

DueDi:
📋 MAGAZINE LUIZA S/A (Magazine Luiza)
CNPJ: 47.960.950/0001-21
✅ Score de risco: 95/100 (BAIXO)

Perfil
• Situação: ATIVA
• Porte: DEMAIS
• Fundada em: 1966-10-24 (59 anos)
• Capital social: R$ 14.202.162.000
• Regime: Lucro Real

Análise: empresa consolidada, ativa há 59 anos, capital robusto. Baixo risco.

Quer marcar como aprovada, rejeitada ou em análise?
```

---

## Arquitetura

```
WhatsApp → Omni (Baileys) → NATS (omni.message.{instance}.{chat})
        → Genie (OmniBridge) → Claude Code (tmux session)
        → Bash tools (bun) → BrasilAPI + Postgres
        → NATS (omni.reply.{instance}.{chat}) → Omni → WhatsApp
```

**Decisões principais:**

- **Executor `tmux`** — Genie spawna Claude Code autenticado localmente. Sem `ANTHROPIC_API_KEY`, usa assinatura Claude Code.
- **Provider `nats-genie`** — integração nativa Omni→Genie via NATS pub/sub, sem polling.
- **Tools como processos isolados** — cada tool é um processo Bun independente, simples de debugar.
- **Postgres via pgserve embedado** — Genie já sobe um Postgres interno (porta 19642). O banco do agente fica no mesmo pgserve, sem infraestrutura extra.

---

## Pré-requisitos

- [Bun](https://bun.sh) instalado
- [Omni](https://github.com/automagik-dev/omni) instalado globalmente (`omni` no PATH)
- [Genie](https://github.com/automagik-dev/genie) instalado globalmente (`genie` no PATH)
- [Claude Code](https://claude.ai/code) autenticado localmente (`claude` no PATH)
- `tmux` instalado
- `python3` instalado (bridge de fallback)

Instalação dos CLIs:

```bash
curl -fsSL https://bun.sh/install | bash && source ~/.bashrc
curl -fsSL https://raw.githubusercontent.com/automagik-dev/omni/main/install.sh | bash
curl -fsSL https://raw.githubusercontent.com/automagik-dev/genie/main/install.sh | bash
```

---

## Setup completo (modo nativo)

### 1. Clonar e configurar

```bash
git clone https://github.com/fabiofilipe/whatsapp-agent
cd whatsapp-agent
cp .env.example .env
```

### 2. Iniciar NATS + Omni via PM2

```bash
# Baixar o binário do NATS (salvo em omni/bin/)
cd /caminho/para/omni && bash scripts/ensure-nats.sh && cd -

# Iniciar NATS e Omni API via PM2
pm2 start scripts/omni-ecosystem.json
```

O arquivo `scripts/omni-ecosystem.json` já está configurado com os paths e variáveis corretos.

Aguarde ~20 segundos e confirme que a API está saudável:

```bash
curl http://localhost:8882/api/v2/health
```

A API Key aparece nos logs do PM2:

```bash
pm2 logs omni-api --lines 30 | grep "API Key"
```

Copie a chave e salve no `.env`:

```
OMNI_API_KEY=omni_sk_xxxxxxxxxxxx
```

Atualize também o config do CLI:

```bash
omni config set apiKey omni_sk_xxxxxxxxxxxx
```

### 3. Conectar WhatsApp (pairing code — sem QR)

```bash
# Criar instância
INSTANCE=$(curl -s -X POST http://localhost:8882/api/v2/instances \
  -H "x-api-key: $OMNI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"duedi","channel":"whatsapp-baileys"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

echo "Instance ID: $INSTANCE"

# Iniciar conexão
curl -s -X POST "http://localhost:8882/api/v2/instances/$INSTANCE/connect" \
  -H "x-api-key: $OMNI_API_KEY" -H "Content-Type: application/json" \
  -d '{"phoneNumber":"55XXXXXXXXXXX"}'

# Solicitar pairing code (substitua pelo número do WhatsApp, com DDI+DDD)
curl -s -X POST "http://localhost:8882/api/v2/instances/$INSTANCE/pair" \
  -H "x-api-key: $OMNI_API_KEY" -H "Content-Type: application/json" \
  -d '{"phoneNumber":"55XXXXXXXXXXX"}'
```

O código de 8 caracteres retornado deve ser inserido no WhatsApp:
**Configurações → Dispositivos conectados → Conectar dispositivo → Conectar com número de telefone**

Salve o instance ID no `.env`:

```
OMNI_INSTANCE_ID=<id retornado>
OMNI_API_URL=http://localhost:8882
```

### 4. Vincular Genie ao WhatsApp

```bash
omni connect $INSTANCE assistente --nats-url localhost:4222
```

Este comando cria o provider `nats-genie`, registra o agente e configura o roteamento automaticamente.

### 5. Criar banco do agente

O Genie sobe um Postgres embedado (pgserve) na porta 19642 com credenciais `postgres:postgres`. O banco do agente vive neste mesmo pgserve:

```bash
# Criar database
bun -e "const {default: pg} = await import('postgres'); const sql = pg('postgresql://postgres:postgres@localhost:19642/postgres'); await sql\`CREATE DATABASE agent\`; await sql.end();"

# Criar schema
bun -e "
const {default: pg} = await import('postgres');
const fs = await import('fs');
const sql = pg('postgresql://postgres:postgres@localhost:19642/agent');
await sql.unsafe(fs.readFileSync('docker/agent-db/init.sql', 'utf8'));
await sql.end();
console.log('schema criado');
"
```

> **Nota:** O pgserve só está disponível depois que o Genie for iniciado ao menos uma vez. Se ainda não rodou, execute `genie serve --headless` uma vez para ele inicializar, depois mate e refaça.

### 6. Iniciar o Genie

```bash
./scripts/start-genie-local.sh
```

O script:
- Exporta `PATH` com localização de `genie`, `claude` e `bun`
- Aponta `DATABASE_URL` para `postgresql://postgres:postgres@localhost:19642/agent`
- Força `GENIE_EXECUTOR=tmux`
- Grava logs em `genie-local.log`
- Falha cedo se `claude`, `genie`, `tmux` ou NATS não estiverem prontos

### 7. Testar

Envie mensagens pelo WhatsApp conectado:

- `oi` — apresentação do DueDi
- `47960950000121` — consulta Magazine Luiza
- `marca como aprovada` — atualiza status da última empresa
- `lista minhas empresas` — resumo do pipeline

---

## Reiniciar após reboot

```bash
# 1. NATS + Omni
pm2 start scripts/omni-ecosystem.json

# 2. Aguardar API (~20s) e confirmar
curl http://localhost:8882/api/v2/health

# 3. Genie
./scripts/start-genie-local.sh
```

O WhatsApp permanece conectado entre reinicializações (sessão salva no pgserve do Omni).

---

## Estrutura

```
.
├── docker-compose.yml              # Orquestração containerizada (opcional)
├── docker/
│   ├── omni/Dockerfile
│   ├── genie/Dockerfile + entrypoint.sh
│   └── agent-db/init.sql           # Schema: tabelas empresas + consultas_log
├── workspace/
│   ├── .genie/workspace.json       # Marca workspace para o Genie
│   └── agents/assistente/AGENTS.md # System prompt do agente DueDi
├── tools/                          # Ferramentas TypeScript (Bun)
│   ├── types.ts                    # Tipos derivados da BrasilAPI (resposta real)
│   ├── db.ts                       # Cliente Postgres
│   ├── risk.ts                     # Score de risco (0-100), 6 fatores
│   ├── helpers.ts                  # Validação CNPJ, fetch retry
│   ├── consultar-cnpj.ts           # BrasilAPI + upsert Postgres
│   ├── marcar-empresa.ts           # Update status/observações
│   └── listar-empresas.ts          # Listagem com filtros
└── scripts/
    ├── omni-ecosystem.json         # PM2: NATS + Omni API
    └── start-genie-local.sh        # Sobe Genie no workspace correto
```

---

## Variáveis de ambiente (.env)

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `OMNI_API_KEY` | sim | Gerada no primeiro boot do Omni |
| `OMNI_INSTANCE_ID` | sim | ID da instância WhatsApp criada |
| `OMNI_API_URL` | não | Default: `http://localhost:8882` |
| `AGENT_DB_PASSWORD` | não | Não usado no modo nativo (pgserve usa postgres:postgres) |
| `ANTHROPIC_API_KEY` | não | Apenas para executor `sdk`; modo nativo usa Claude Code local |

---

## Tools

Cada tool é um processo Bun independente chamado pelo Claude via Bash:

```bash
# Consultar CNPJ
bun tools/consultar-cnpj.ts <chat_id> <cnpj>

# Marcar empresa
bun tools/marcar-empresa.ts <chat_id> <cnpj> <status> [observacoes]
# status: em_analise | aprovada | rejeitada

# Listar empresas
bun tools/listar-empresas.ts <chat_id> [status]
```

Todas emitem JSON em stdout e usam exit code != 0 para sinalizar erro.

---

## Score de risco

Heurística transparente com 6 fatores em `tools/risk.ts`:

| Fator | Impacto |
|-------|---------|
| Situação ATIVA | +20 |
| Situação irregular | -40 + flag |
| Empresa > 10 anos | +15 |
| Empresa < 1 ano | -15 + flag |
| Capital > R$ 1M | +10 |
| Capital < R$ 1k | -5 + flag |
| Porte × capital inconsistente | flag |
| Motivo de situação declarado | flag |
| Sem sócios (QSA vazio) | -5 + flag |

Score normalizado 0-100: BAIXO (≥70) / MÉDIO (≥50) / ALTO (≥30) / CRÍTICO (<30).

---

## Licença

MIT.
