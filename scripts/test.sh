#!/bin/bash
set -e

echo "🧪 Executando testes automatizados..."
echo ""

cd "$(dirname "$0")/.."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Array para rastrear falhas
FAILED_TESTS=()

# Função para rodar teste
run_test() {
  local test_file=$1
  local test_name=$(basename "$test_file" .ts)

  echo -n "📋 Rodando $test_name... "

  if bun test "$test_file" 2>&1; then
    echo -e "${GREEN}✓ PASSOU${NC}"
    return 0
  else
    echo -e "${RED}✗ FALHOU${NC}"
    FAILED_TESTS+=("$test_name")
    return 1
  fi
}

# Rodar todos os testes
echo "📂 Testes disponíveis:"
ls -1 tests/*.test.ts 2>/dev/null | sed 's/^/   /'
echo ""

for test_file in tests/*.test.ts; do
  if [ -f "$test_file" ]; then
    run_test "$test_file" || true
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Resumo dos testes:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ Todos os testes passaram!${NC}"
  exit 0
else
  echo -e "${RED}✗ ${#FAILED_TESTS[@]} teste(s) falharam:${NC}"
  for test in "${FAILED_TESTS[@]}"; do
    echo -e "  ${RED}•${NC} $test"
  done
  exit 1
fi
