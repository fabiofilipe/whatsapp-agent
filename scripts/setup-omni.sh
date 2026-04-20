#!/bin/bash
# setup-omni.sh — Configura o Omni após o primeiro boot
# Executa uma única vez para criar instância WhatsApp + provider Genie
#
# Uso: ./scripts/setup-omni.sh
# Pré-requisitos: containers nats e omni rodando, OMNI_API_KEY no .env

set -e

source .env 2>/dev/null || true

OMNI_URL="${OMNI_API_URL:-http://localhost:8882}"
API_KEY="${OMNI_API_KEY}"
AGENT_NAME="${AGENT_NAME:-assistente}"
NATS_URL="${NATS_INTERNAL_URL:-nats://nats:4222}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[setup]${NC} $1"; }
warn()  { echo -e "${YELLOW}[setup]${NC} $1"; }
error() { echo -e "${RED}[setup]${NC} $1"; exit 1; }

[ -z "$API_KEY" ] && error "OMNI_API_KEY não definida no .env"

# ── 1. Health check ──────────────────────────────────────────────────────────
info "Verificando Omni em $OMNI_URL..."
until curl -sf "$OMNI_URL/api/v2/health" > /dev/null; do
  warn "Omni ainda não está pronto, aguardando..."
  sleep 3
done
info "Omni está saudável."

AUTH_HEADER="x-api-key: $API_KEY"

# ── 2. Criar instância WhatsApp ───────────────────────────────────────────────
info "Criando instância WhatsApp (Baileys)..."
INSTANCE=$(curl -sf -X POST "$OMNI_URL/api/v2/instances" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"name":"whatsapp-agent","channelType":"whatsapp-baileys"}')

INSTANCE_ID=$(echo "$INSTANCE" | jq -r '.data.id')
[ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "null" ] && error "Falha ao criar instância: $INSTANCE"
info "Instância criada: $INSTANCE_ID"

# ── 3. QR Code — passo manual ────────────────────────────────────────────────
echo ""
warn "═══════════════════════════════════════════════════════"
warn "  PASSO MANUAL: Escaneie o QR code com o WhatsApp"
warn "  Acesse: http://localhost:8882/api/v2/docs"
warn "  ou execute: docker compose exec omni bun packages/cli/src/index.ts instances qr $INSTANCE_ID --watch"
warn "═══════════════════════════════════════════════════════"
echo ""
read -p "Pressione ENTER após escanear o QR code e conectar o WhatsApp..."

# ── 4. Criar provider nats-genie ─────────────────────────────────────────────
info "Criando provider nats-genie (Omni → Genie)..."
PROVIDER=$(curl -sf -X POST "$OMNI_URL/api/v2/providers" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"genie-provider\",
    \"schema\": \"nats-genie\",
    \"schemaConfig\": {
      \"agentName\": \"$AGENT_NAME\",
      \"natsUrl\": \"$NATS_URL\"
    }
  }")

PROVIDER_ID=$(echo "$PROVIDER" | jq -r '.data.id')
[ -z "$PROVIDER_ID" ] || [ "$PROVIDER_ID" = "null" ] && error "Falha ao criar provider: $PROVIDER"
info "Provider criado: $PROVIDER_ID"

# ── 5. Vincular provider à instância ─────────────────────────────────────────
info "Vinculando provider à instância WhatsApp..."
curl -sf -X PATCH "$OMNI_URL/api/v2/instances/$INSTANCE_ID" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"agentProviderId\": \"$PROVIDER_ID\"}" > /dev/null

info "Provider vinculado à instância."

# ── 6. Salvar IDs no .env ────────────────────────────────────────────────────
echo "" >> .env
echo "# Gerado pelo setup-omni.sh" >> .env
echo "OMNI_INSTANCE_ID=$INSTANCE_ID" >> .env
echo "OMNI_PROVIDER_ID=$PROVIDER_ID" >> .env

echo ""
info "✅ Setup concluído!"
info "   Instância: $INSTANCE_ID"
info "   Provider:  $PROVIDER_ID"
info "   Agente:    $AGENT_NAME"
echo ""
info "Próximo passo: docker compose up genie"
