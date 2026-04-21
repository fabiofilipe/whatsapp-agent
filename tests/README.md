# Testes Automatizados — DueDi Agent

Suite de testes para validação das ferramentas e lógica de negócio do agente de due diligence.

## Estrutura

```
tests/
  helpers.test.ts       # Testes para funções auxiliares (validação, fetch, emit)
  risk.test.ts          # Testes para algoritmo de análise de risco
  integration.test.ts   # Testes de integração entre componentes
```

## Cobertura

- **helpers.test.ts**: validação de CNPJ, formatação, data ISO, tratamento de nulos, fetch com retry
- **risk.test.ts**: cálculo de score de risco, classificação de risco, tratamento de edge cases
- **integration.test.ts**: fluxos completos, validações de negócio, campos opcionais

## Como rodar

### Opção 1: Script bash
```bash
bash scripts/test.sh
```

### Opção 2: bun direto (um teste)
```bash
bun test tests/helpers.test.ts
bun test tests/risk.test.ts
bun test tests/integration.test.ts
```

### Opção 3: bun direto (todos)
```bash
bun test tests/
```

### Opção 4: watch mode (monitorar mudanças)
```bash
bun test --watch tests/
```

## Estrutura de um teste

```typescript
import { describe, expect, test } from 'bun:test';

describe('Feature', () => {
  test('caso de uso específico', () => {
    const resultado = funcao(entrada);
    expect(resultado).toBe(esperado);
  });
});
```

## Adicionando novos testes

1. Crie um arquivo `novo.test.ts` em `tests/`
2. Importe as funções do `tools/`
3. Use `describe()` para agrupar, `test()` para casos
4. Use assertions: `expect().toBe()`, `expect().toBeNull()`, `expect().toContain()`, etc
5. Rode com `bun test tests/novo.test.ts`

## Mocking

Para testes de `fetchComRetry` e `emit`, usamos `mock()` do bun:

```typescript
import { mock } from 'bun:test';

const mockFetch = mock(globalThis, 'fetch', () => {
  return Promise.resolve(new Response('OK', { status: 200 }));
});

// Depois de usar:
mockFetch.mockRestore();
```

## Saída esperada

Cada teste mostra:
- ✓ para sucesso
- ✗ para falha
- Contagem total de testes passados/falhados
- Mensagens de erro detalhadas em caso de falha
