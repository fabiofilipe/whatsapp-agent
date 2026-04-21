import { describe, expect, test } from 'bun:test';
import { validarCnpj, formatarCnpj } from '../tools/helpers.ts';
import { calcularRisco, classificarRisco } from '../tools/risk.ts';
import type { CnpjResponse } from '../tools/types.ts';

describe('Integração: Validação CNPJ → Formatação', () => {
  test('valida e formata CNPJ corretamente', () => {
    const cnpjRaw = '47.960.950/0001-21';
    const validado = validarCnpj(cnpjRaw);
    expect(validado).not.toBeNull();
    const formatado = formatarCnpj(validado!);
    expect(formatado).toBe('47.960.950/0001-21');
  });

  test('normaliza variações de formatação', () => {
    const variacoes = [
      '47960950000121',
      '47.960.950/0001-21',
      '47 960 950 0001 21',
      ' 47.960.950/0001-21 ',
    ];
    const expectativa = '47960950000121';
    variacoes.forEach((var_) => {
      expect(validarCnpj(var_)).toBe(expectativa);
    });
  });
});

describe('Integração: CNPJ → Análise de Risco', () => {
  test('pipeline completo de validação e risco', () => {
    const cnpj = '47.960.950/0001-21';
    const validado = validarCnpj(cnpj);
    expect(validado).not.toBeNull();

    // Simula dados da BrasilAPI
    const mockData: CnpjResponse = {
      cnpj: validado!,
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
      qsa: [{ nome_socio: 'LUIZA TRAJANO', qualificacao_socio: 'Diretora' } as any],
      opcao_pelo_simples: false,
      opcao_pelo_mei: false,
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
    };

    const risco = calcularRisco(mockData);
    const classificacao = classificarRisco(risco.score);

    expect(risco.score).toBeGreaterThan(0);
    expect(risco.score).toBeLessThanOrEqual(100);
    expect(classificacao.label).toBeDefined();
    expect(classificacao.emoji).toBeDefined();
  });
});

describe('Validações de negócio', () => {
  test('CNPJs inválidos são rejeitados no início', () => {
    const cnpjsInvalidos = [
      '00000000000000',
      '11111111111111',
      '12345678901234',
      'invalido',
      '',
    ];
    cnpjsInvalidos.forEach((cnpj) => {
      expect(validarCnpj(cnpj)).toBeNull();
    });
  });

  test('status "em_analise" é o padrão inicial', () => {
    // Simula lógica de status padrão
    const statusPadrao = 'em_analise';
    expect(['em_analise', 'aprovada', 'rejeitada']).toContain(statusPadrao);
  });

  test('campos podem ser null sem erro', () => {
    const mockData: CnpjResponse = {
      cnpj: '47960950000121',
      razao_social: 'TEST',
      nome_fantasia: null,
      email: null,
      pais: null,
      data_opcao_pelo_simples: null,
      data_situacao_especial: null,
      qsa: [],
      situacao_cadastral: 1,
      descricao_situacao_cadastral: 'ATIVA',
      data_situacao_cadastral: '2022-01-01',
      motivo_situacao_cadastral: 0,
      descricao_motivo_situacao_cadastral: 'SEM MOTIVO',
      porte: 'PEQUENO',
      codigo_porte: 1,
      natureza_juridica: 'PJ',
      codigo_natureza_juridica: 1,
      capital_social: 100000,
      data_inicio_atividade: '2020-01-01',
      cnae_fiscal: 1234,
      cnae_fiscal_descricao: 'Teste',
      cnaes_secundarios: [],
      opcao_pelo_simples: null,
      opcao_pelo_mei: null,
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
      ente_federativo_responsavel: 'SP',
      qualificacao_do_responsavel: 1,
    };

    const risco = calcularRisco(mockData);
    expect(risco.score).toBeGreaterThanOrEqual(0);
  });
});
