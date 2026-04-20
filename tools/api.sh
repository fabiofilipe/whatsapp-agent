#!/bin/sh
# Wrapper para chamadas de API externas
# Uso: api.sh <endpoint_key> [param1] [param2]
#
# TODO: implementar os endpoints específicos do domínio
#
# Exemplo de uso pelo agente (via Bash tool):
#   /tools/api.sh exchange_rate USD BRL
#   /tools/api.sh crypto_price bitcoin

ENDPOINT="$1"

case "$ENDPOINT" in
  # TODO: adicionar casos específicos do domínio
  # exchange_rate)
  #   FROM="$2"
  #   TO="$3"
  #   curl -sf "https://api.exchangerate-api.com/v4/latest/$FROM" | jq -r ".rates.$TO"
  #   ;;

  *)
    echo "Endpoint desconhecido: $ENDPOINT"
    echo "Endpoints disponíveis: TODO"
    exit 1
    ;;
esac
