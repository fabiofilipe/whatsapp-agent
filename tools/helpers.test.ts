import { describe, expect, test } from 'bun:test';
import { formatarCnpj, nullIfEmpty, validarCnpj, validarDataISO } from './helpers.ts';

describe('validarCnpj', () => {
  test('aceita CNPJ válido só com dígitos', () => {
    expect(validarCnpj('47960950000121')).toBe('47960950000121'); // Magazine Luiza
  });

  test('aceita CNPJ válido formatado', () => {
    expect(validarCnpj('47.960.950/0001-21')).toBe('47960950000121');
    expect(validarCnpj('11.222.333/0001-81')).toBe('11222333000181');
  });

  test('normaliza removendo qualquer não-dígito', () => {
    expect(validarCnpj(' 47 960 950/0001-21 ')).toBe('47960950000121');
  });

  test('rejeita tamanho diferente de 14 dígitos', () => {
    expect(validarCnpj('12345')).toBeNull();
    expect(validarCnpj('123456789012345')).toBeNull();
    expect(validarCnpj('')).toBeNull();
  });

  test('rejeita dígitos todos iguais', () => {
    expect(validarCnpj('11111111111111')).toBeNull();
    expect(validarCnpj('00000000000000')).toBeNull();
    expect(validarCnpj('99999999999999')).toBeNull();
  });

  test('rejeita dígitos verificadores incorretos', () => {
    expect(validarCnpj('47960950000122')).toBeNull(); // último dígito errado
    expect(validarCnpj('11222333000182')).toBeNull();
    expect(validarCnpj('12345678000100')).toBeNull();
  });

  test('rejeita entrada sem dígitos', () => {
    expect(validarCnpj('abc.def.ghi/jklm-no')).toBeNull();
  });
});

describe('formatarCnpj', () => {
  test('formata 14 dígitos no padrão XX.XXX.XXX/XXXX-XX', () => {
    expect(formatarCnpj('47960950000121')).toBe('47.960.950/0001-21');
  });

  test('remove caracteres não-numéricos antes de formatar', () => {
    expect(formatarCnpj('47.960.950/0001-21')).toBe('47.960.950/0001-21');
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
    expect(validarDataISO('2024-6-15')).toBeNull();
    expect(validarDataISO('2024-06-15T00:00:00')).toBeNull();
  });

  test('rejeita data malformada que bate o regex mas falha no parse', () => {
    expect(validarDataISO('2024-13-40')).toBeNull();
  });

  test('retorna null para vazio/undefined/null', () => {
    expect(validarDataISO('')).toBeNull();
    expect(validarDataISO(null)).toBeNull();
    expect(validarDataISO(undefined)).toBeNull();
  });
});

describe('nullIfEmpty', () => {
  test('retorna string com trim quando tem conteúdo', () => {
    expect(nullIfEmpty(' abc ')).toBe('abc');
    expect(nullIfEmpty('hello')).toBe('hello');
  });

  test('retorna null para vazio, whitespace, null, undefined', () => {
    expect(nullIfEmpty('')).toBeNull();
    expect(nullIfEmpty('   ')).toBeNull();
    expect(nullIfEmpty(null)).toBeNull();
    expect(nullIfEmpty(undefined)).toBeNull();
  });
});
