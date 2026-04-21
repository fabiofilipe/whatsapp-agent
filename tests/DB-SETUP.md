# Setup para Testes de DB

Os testes em `db.test.ts` precisam de um banco Postgres acessível.

## Opção 1: Usar o banco existente (desenvolvimento)

Simplesmente rode com a variável de ambiente atual:

```bash
bun test tests/db.test.ts
```

Usa `DATABASE_URL` automaticamente. **Cuidado**: limpa dados de teste com padrão `test-chat-%`.

## Opção 2: Banco de testes separado (recomendado)

Crie um banco separado e use `TEST_DATABASE_URL`:

```bash
# Criar banco de testes no Postgres local
createdb agent_test

# Rodar schema inicial
psql agent_test < docker/agent-db/init.sql

# Rodar testes com DB separado
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/agent_test" bun test tests/db.test.ts
```

## Opção 3: Via Docker Compose

Se estiver usando Docker:

```bash
# Subir banco de testes em container separado
docker compose up agent-db -d

# Esperar ficar pronto (5-10 segundos)
sleep 10

# Rodar testes
TEST_DATABASE_URL="postgresql://postgres:postgres@agent-db:5432/agent?sslmode=disable" \
  bun test tests/db.test.ts
```

## O que é testado

- ✅ Inserção de empresas com dados completos
- ✅ Upsert mantém status/observações existentes
- ✅ JSON storage (risk_flags, raw_data)
- ✅ Campos null são gravados corretamente
- ✅ Log de consultas (sucessos e erros)
- ✅ Timestamps automáticos
- ✅ Múltiplas empresas por chat_id
- ✅ Histórico de consultas
- ✅ updated_at atualiza em upsert

## Cleanup automático

Cada teste:
1. Roda sua operação
2. Limpa dados com padrão `test-chat-%` após fim
3. Não interfere com dados reais

## Troubleshooting

### Erro: "DATABASE_URL não definida"
```bash
# Set a variável antes de rodar
export DATABASE_URL="postgresql://user:pass@localhost:5432/agent"
bun test tests/db.test.ts
```

### Erro: "relação empresas não existe"
O banco precisa ter o schema. Rode:
```bash
psql $DATABASE_URL < docker/agent-db/init.sql
```

### Testes ficam lentos
Aumente `idle_timeout` em `db.test.ts` ou use pool de conexões menor.
