# [NOME DO AGENTE] — Agente WhatsApp com Genie + Omni

> Agente conversacional no WhatsApp usando Claude como IA, Genie como orquestrador e Omni como bridge de canal.

## Arquitetura

```
WhatsApp (usuário)
    ↓
Omni — bridge de canal (Baileys)
    ↓  publica via NATS: omni.message.{instance}.{chat}
Genie — orquestrador de agente
    ↓  spawna sessão Claude SDK
Claude — processa + usa ferramentas
    ↓  publica via NATS: omni.reply.{instance}.{chat}
Omni — entrega resposta
    ↓
WhatsApp (usuário recebe)
```

## O que o agente faz

[TODO: descrever o domínio e propósito do agente]

### Ferramentas

| Ferramenta | O que faz |
|---|---|
| TODO | TODO |

## Setup

### Pré-requisitos

- Docker + Docker Compose
- Número de WhatsApp para conectar
- Chave da API Anthropic

### 1. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Edite .env e preencha ANTHROPIC_API_KEY
```

### 2. Subir infraestrutura base

```bash
docker compose up nats omni --build
```

Aguarde o Omni iniciar (~30s). A `OMNI_API_KEY` será exibida no log:
```
[omni] API Key: omni_xxxxxxxxxxxx
```
Copie e adicione ao `.env`: `OMNI_API_KEY=omni_xxxxxxxxxxxx`

### 3. Configurar WhatsApp + provider Genie

```bash
./scripts/setup-omni.sh
```

O script vai:
1. Criar a instância WhatsApp no Omni
2. Exibir instruções para escanear o QR code
3. Criar o provider `nats-genie` (ponte Omni → Genie)
4. Vincular o provider à instância

### 4. Subir o agente

```bash
docker compose up genie --build
```

### 5. Testar

Mande uma mensagem para o número conectado no WhatsApp. O agente deve responder em ~5-10 segundos.

## Estrutura do projeto

```
.
├── docker-compose.yml          # Orquestração: nats + omni + genie
├── docker/
│   ├── omni/Dockerfile         # Omni (clona automagik-dev/omni)
│   └── genie/
│       ├── Dockerfile          # Genie (instala @automagik/genie)
│       └── entrypoint.sh       # Init DB + genie serve --headless
├── workspace/
│   └── agents/assistente/
│       └── AGENTS.md           # Definição do agente (system prompt + tools)
├── tools/
│   ├── schema.sql              # Schema SQLite inicializado no startup
│   ├── db.sh                   # Wrapper para queries SQLite
│   └── api.sh                  # Wrapper para APIs externas
├── scripts/
│   └── setup-omni.sh           # Configura Omni (instância + provider)
└── .env.example
```

## Decisões técnicas

- **Executor SDK** (`GENIE_EXECUTOR=sdk`): sem tmux, funciona em container Docker
- **NATS compartilhado**: Omni e Genie usam o mesmo NATS como message bus
- **Provider `nats-genie`**: integração nativa Omni → Genie via NATS pub/sub
- **Ferramentas via shell**: Claude usa o `Bash` tool para chamar scripts, sem MCP
- **SQLite local**: persistência simples para contexto entre conversas

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `ANTHROPIC_API_KEY` | Chave da API Anthropic (obrigatório) |
| `OMNI_API_KEY` | Chave do Omni (gerada no primeiro boot) |
| `OMNI_INSTANCE_ID` | ID da instância WhatsApp (gerado pelo setup) |
| `OMNI_PROVIDER_ID` | ID do provider Genie (gerado pelo setup) |
