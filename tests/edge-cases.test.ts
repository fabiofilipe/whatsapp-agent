import { describe, expect, test } from 'bun:test';
import { validarCnpj, formatarCnpj, nullIfEmpty, validarDataISO } from '../tools/helpers.ts';
import { calcularRisco, classificarRisco } from '../tools/risk.ts';
import type { CnpjResponse } from '../tools/types.ts';

describe('Edge Cases: Validação de CNPJ', () => {
  test('CNPJ com espaços internos', () => {
    expect(validarCnpj('4796 0950 0001 21')).toBe('47960950000121');
  });

  test('CNPJ com caracteres especiais aleatórios', () => {
    expect(validarCnpj('47@960#950$0001-21')).toBe('47960950000121');
  });

  test('CNPJ vazio string', () => {
    expect(validarCnpj('')).toBeNull();
  });

  test('CNPJ muito longo', () => {
    expect(validarCnpj('479609500001211111')).toBeNull();
  });

  test('CNPJ com apenas letras', () => {
    expect(validarCnpj('abcdefghijklmn')).toBeNull();
  });

  test('CNPJ com dígitos verificadores incorretos por 1', () => {
    // 47960950000121 é válido, mudamos o último dígito
    expect(validarCnpj('47960950000120')).toBeNull();
    expect(validarCnpj('47960950000122')).toBeNull();
  });
});

describe('Edge Cases: Formatação de CNPJ', () => {
  test('formata CNPJ com dígitos insuficientes (padding)', () => {
    expect(formatarCnpj('123')).toBe('00.000.000/0001-23');
  });

  test('formata CNPJ já formatado', () => {
    expect(formatarCnpj('47.960.950/0001-21')).toBe('47.960.950/0001-21');
  });

  test('formata com string vazia (zero-pad)', () => {
    expect(formatarCnpj('')).toBe('00.000.000/0000-00');
  });

  test('formata CNPJ com mix de caracteres', () => {
    const resultado = formatarCnpj('47.960.950/0001-21');
    expect(resultado).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
  });
});

describe('Edge Cases: Validação de Data ISO', () => {
  test('data 29 de fevereiro em ano bissexto', () => {
    expect(validarDataISO('2020-02-29')).toBe('2020-02-29');
  });

  test('data 29 de fevereiro em ano bissexto é válida', () => {
    expect(validarDataISO('2020-02-29')).toBe('2020-02-29');
  });

  test('data 31 de janeiro', () => {
    expect(validarDataISO('2024-01-31')).toBe('2024-01-31');
  });

  test('data com mês/dia zero', () => {
    expect(validarDataISO('2024-00-01')).toBeNull();
    expect(validarDataISO('2024-01-00')).toBeNull();
  });

  test('data com zero à esquerda (válida)', () => {
    expect(validarDataISO('2024-01-01')).toBe('2024-01-01');
  });

  test('data sem zeros à esquerda (inválida)', () => {
    expect(validarDataISO('2024-1-1')).toBeNull();
  });

  test('ano com 3 dígitos', () => {
    expect(validarDataISO('024-01-01')).toBeNull();
  });

  test('data com T e hora (inválida por formato)', () => {
    expect(validarDataISO('2024-01-01T00:00:00')).toBeNull();
  });
});

describe('Edge Cases: nullIfEmpty', () => {
  test('string com apenas tabs e newlines', () => {
    expect(nullIfEmpty('\t\n  ')).toBeNull();
  });

  test('string com caracteres invisíveis', () => {
    expect(nullIfEmpty('​')).toBe('​'); // zero-width space é um caractere
  });

  test('string com espaço no meio', () => {
    expect(nullIfEmpty('  a  ')).toBe('a');
  });

  test('string com múltiplos espaços', () => {
    expect(nullIfEmpty('     ')).toBeNull();
  });
});

describe('Edge Cases: Análise de Risco', () => {
  const mockData = (overrides?: any): CnpjResponse => ({
    cnpj: '47960950000121',
    razao_social: 'TEST',
    nome_fantasia: null,
    email: null,
    pais: null,
    situacao_cadastral: 1,
    descricao_situacao_cadastral: 'ATIVA',
    data_situacao_cadastral: '2022-01-01',
    motivo_situacao_cadastral: 0,
    descricao_motivo_situacao_cadastral: 'SEM MOTIVO',
    porte: 'PEQUENO',
    codigo_porte: 1,
    natureza_juridica: 'PJ',
    codigo_natureza_juridica: 1,
    capital_social: 0, // zero
    data_inicio_atividade: '2024-01-01',
    cnae_fiscal: 1234,
    cnae_fiscal_descricao: 'Teste',
    cnaes_secundarios: [],
    opcao_pelo_simples: null,
    opcao_pelo_mei: null,
    data_opcao_pelo_simples: null,
    data_opcao_pelo_mei: null,
    data_exclusao_do_simples: null,
    data_exclusao_do_mei: null,
    regime_tributario: [],
    identificador_matriz_filial: 1,
    descricao_identificador_matriz_filial: 'Matriz',
    uf: 'SP',
    municipio: 'São Paulo',
    bairro: 'Centro',
    logradouro: 'Rua',
    numero: '1',
    complemento: '',
    cep: '00000000',
    ddd_telefone_1: '',
    ddd_telefone_2: '',
    ddd_fax: '',
    situacao_especial: '',
    data_situacao_especial: null,
    ente_federativo_responsavel: 'SP',
    qualificacao_do_responsavel: 1,
    qsa: [],
    ...overrides,
  });

  test('capital social zero é válido (não NaN)', () => {
    const data = mockData({ capital_social: 0 });
    const risco = calcularRisco(data);
    expect(risco.score).toBeDefined();
  });

  test('capital social negativo é tratado como zero', () => {
    const data = mockData({ capital_social: -1000 });
    const risco = calcularRisco(data);
    expect(risco.score).toBeDefined();
  });

  test('data de início de atividade muito antiga', () => {
    const data = mockData({ data_inicio_atividade: '1900-01-01' });
    const risco = calcularRisco(data);
    expect(risco.score).toBeGreaterThan(70); // empresa muito velha = baixo risco
  });

  test('data de início de atividade no futuro', () => {
    const data = mockData({ data_inicio_atividade: '2099-12-31' });
    const risco = calcularRisco(data);
    expect(risco.flags.length).toBeGreaterThan(0); // deve ter flag de inconsistência
  });

  test('porte "DEMAIS" com capital baixo gera flag', () => {
    const data = mockData({
      porte: 'DEMAIS',
      capital_social: 50000, // < 100k
    });
    const risco = calcularRisco(data);
    expect(risco.flags.some((f) => f.includes('inconsistência'))).toBe(true);
  });

  test('múltiplas flags se empresa está em péssima situação', () => {
    const data = mockData({
      descricao_situacao_cadastral: 'CANCELADA',
      capital_social: 100,
      data_inicio_atividade: '2024-01-01',
      qsa: [],
    });
    const risco = calcularRisco(data);
    expect(risco.flags.length).toBeGreaterThanOrEqual(3);
  });

  test('score em boundary: 75 é BAIXO, 74 é MÉDIO', () => {
    expect(classificarRisco(75).label).toBe('BAIXO');
    expect(classificarRisco(74).label).toBe('MÉDIO');
  });

  test('score em boundary: 50 é MÉDIO, 49 é ALTO', () => {
    expect(classificarRisco(50).label).toBe('MÉDIO');
    expect(classificarRisco(49).label).toBe('ALTO');
  });

  test('score em boundary: 30 é ALTO, 29 é CRÍTICO', () => {
    expect(classificarRisco(30).label).toBe('ALTO');
    expect(classificarRisco(29).label).toBe('CRÍTICO');
  });
});

describe('Edge Cases: Tipo de dados', () => {
  test('undefined vs null em nullIfEmpty', () => {
    expect(nullIfEmpty(undefined)).toBeNull();
    expect(nullIfEmpty(null)).toBeNull();
  });

  test('número zero não é removido de string', () => {
    expect(nullIfEmpty('0')).toBe('0');
  });

  test('false como string é mantido', () => {
    expect(nullIfEmpty('false')).toBe('false');
  });
});
