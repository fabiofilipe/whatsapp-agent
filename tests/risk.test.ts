import { describe, expect, test } from 'bun:test';
import { calcularRisco, classificarRisco } from '../tools/risk.ts';
import type { CnpjResponse } from '../tools/types.ts';

const mockCnpjResponse = (overrides?: Partial<CnpjResponse>): CnpjResponse => ({
  cnpj: '47960950000121',
  razao_social: 'MAGAZINE LUIZA S/A',
  nome_fantasia: 'Magazine Luiza',
  situacao_cadastral: 1,
  descricao_situacao_cadastral: 'ATIVA',
  data_situacao_cadastral: '2022-01-01',
  motivo_situacao_cadastral: 0,
  descricao_motivo_situacao_cadastral: 'SEM MOTIVO',
  porte: 'GRANDE',
  codigo_porte: 4,
  natureza_juridica: 'Sociedade Anônima',
  codigo_natureza_juridica: 2011,
  capital_social: 500000000,
  data_inicio_atividade: '2000-01-01',
  cnae_fiscal: 4711301,
  cnae_fiscal_descricao: 'Comércio varejista',
  cnaes_secundarios: [],
  qsa: [
    {
      nome_socio: 'LUIZA TRAJANO',
      qualificacao_socio: 'Diretora',
      data_entrada_sociedade: '2000-01-01',
      faixa_etaria: '45-49',
      cnpj_cpf_do_socio: '11111111111111',
      identificador_de_socio: 1,
      pais: 'BRASIL',
      codigo_pais: 1058,
      codigo_faixa_etaria: 3,
      codigo_qualificacao_socio: 10,
      nome_representante_legal: '',
      cpf_representante_legal: '',
      qualificacao_representante_legal: '',
      codigo_qualificacao_representante_legal: 0,
    },
  ],
  opcao_pelo_simples: false,
  opcao_pelo_mei: false,
  data_opcao_pelo_simples: null,
  data_opcao_pelo_mei: null,
  data_exclusao_do_simples: null,
  data_exclusao_do_mei: null,
  regime_tributario: [
    {
      ano: 2024,
      cnpj_da_scp: null,
      forma_de_tributacao: 'Lucro Real',
      quantidade_de_escrituracoes: 1,
    },
  ],
  identificador_matriz_filial: 1,
  descricao_identificador_matriz_filial: 'Matriz',
  uf: 'SP',
  municipio: 'São Paulo',
  bairro: 'Centro',
  logradouro: 'Avenida Paulista',
  numero: '1000',
  complemento: '',
  cep: '01311100',
  ddd_telefone_1: '1133334444',
  ddd_telefone_2: '',
  ddd_fax: '',
  email: 'contato@magazineluiza.com.br',
  pais: 'Brasil',
  situacao_especial: '',
  data_situacao_especial: null,
  ente_federativo_responsavel: 'SP',
  qualificacao_do_responsavel: 10,
  ...overrides,
});

describe('calcularRisco', () => {
  test('empresa ativa com dados sólidos tem score alto', () => {
    const data = mockCnpjResponse({
      descricao_situacao_cadastral: 'ATIVA',
      capital_social: 1000000,
      data_inicio_atividade: '1990-01-01',
    });
    const result = calcularRisco(data);
    expect(result.score).toBeGreaterThan(70);
  });

  test('empresa inativa tem score reduzido', () => {
    const data = mockCnpjResponse({
      descricao_situacao_cadastral: 'INATIVA',
    });
    const result = calcularRisco(data);
    expect(result.score).toBeLessThan(50);
    expect(result.flags.length).toBeGreaterThan(0);
  });

  test('empresa muito nova gera penalidade', () => {
    const data = mockCnpjResponse({
      data_inicio_atividade: new Date(Date.now() - 6 * 30 * 24 * 3600 * 1000)
        .toISOString()
        .split('T')[0],
    });
    const result = calcularRisco(data);
    expect(result.score).toBeLessThan(50);
  });

  test('capital social baixo gera flag', () => {
    const data = mockCnpjResponse({ capital_social: 500 });
    const result = calcularRisco(data);
    expect(result.flags.some((f) => f.includes('Capital social'))).toBe(true);
  });

  test('sem sócios gera flag e reduz score', () => {
    const data = mockCnpjResponse({ qsa: [] });
    const result = calcularRisco(data);
    expect(result.flags.some((f) => f.includes('Nenhum sócio'))).toBe(true);
  });

  test('score normaliza para 0-100', () => {
    const data = mockCnpjResponse();
    const result = calcularRisco(data);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('classificarRisco', () => {
  test('score >= 75 é BAIXO', () => {
    const result = classificarRisco(75);
    expect(result.label).toBe('BAIXO');
    expect(result.emoji).toBe('🟢');
  });

  test('score 50-74 é MÉDIO', () => {
    const result = classificarRisco(60);
    expect(result.label).toBe('MÉDIO');
    expect(result.emoji).toBe('🟡');
  });

  test('score 30-49 é ALTO', () => {
    const result = classificarRisco(40);
    expect(result.label).toBe('ALTO');
    expect(result.emoji).toBe('🟠');
  });

  test('score < 30 é CRÍTICO', () => {
    const result = classificarRisco(20);
    expect(result.label).toBe('CRÍTICO');
    expect(result.emoji).toBe('🔴');
  });
});
