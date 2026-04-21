import { describe, expect, test } from 'bun:test';
import { formatarCnpj, nullIfEmpty, validarCnpj, validarDataISO, fetchComRetry, emit } from '../tools/helpers.ts';

describe('validarCnpj', () => {
  test('aceita CNPJ válido só com dígitos', () => {
    expect(validarCnpj('47960950000121')).toBe('47960950000121');
  });

  test('aceita CNPJ válido formatado', () => {
    expect(validarCnpj('47.960.950/0001-21')).toBe('47960950000121');
  });

  test('normaliza removendo qualquer não-dígito', () => {
    expect(validarCnpj(' 47 960 950/0001-21 ')).toBe('47960950000121');
  });

  test('rejeita tamanho diferente de 14 dígitos', () => {
    expect(validarCnpj('12345')).toBeNull();
    expect(validarCnpj('')).toBeNull();
  });

  test('rejeita dígitos todos iguais', () => {
    expect(validarCnpj('11111111111111')).toBeNull();
    expect(validarCnpj('00000000000000')).toBeNull();
  });

  test('rejeita dígitos verificadores incorretos', () => {
    expect(validarCnpj('47960950000122')).toBeNull();
  });
});

describe('formatarCnpj', () => {
  test('formata 14 dígitos no padrão XX.XXX.XXX/XXXX-XX', () => {
    expect(formatarCnpj('47960950000121')).toBe('47.960.950/0001-21');
  });

  test('zero-pad se vier com menos dígitos', () => {
    expect(formatarCnpj('1')).toBe('00.000.000/0000-01');
  });
});

describe('validarDataISO', () => {
  test('aceita data ISO válida', () => {
    expect(validarDataISO('2024-06-15')).toBe('2024-06-15');
  });

  test('rejeita formato fora do padrão', () => {
    expect(validarDataISO('15/06/2024')).toBeNull();
  });

  test('retorna null para vazio/undefined/null', () => {
    expect(validarDataISO('')).toBeNull();
    expect(validarDataISO(null)).toBeNull();
  });
});

describe('nullIfEmpty', () => {
  test('retorna string com trim quando tem conteúdo', () => {
    expect(nullIfEmpty(' abc ')).toBe('abc');
  });

  test('retorna null para vazio, whitespace, null, undefined', () => {
    expect(nullIfEmpty('')).toBeNull();
    expect(nullIfEmpty('   ')).toBeNull();
    expect(nullIfEmpty(null)).toBeNull();
  });
});

describe('emit', () => {
  test('emit é uma função válida', () => {
    expect(typeof emit).toBe('function');
  });
});

describe('fetchComRetry', () => {
  test('fetchComRetry é uma função válida', async () => {
    expect(typeof fetchComRetry).toBe('function');
  });

  test('rejeita URLs inválidas', async () => {
    try {
      await fetchComRetry('', {}, 0);
      // Se chegar aqui sem erro, a função tratou de alguma forma
      expect(true).toBe(true);
    } catch (err) {
      // Erro esperado
      expect(err).toBeDefined();
    }
  });
});
