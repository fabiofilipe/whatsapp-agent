/**
 * Tipos derivados da resposta REAL da BrasilAPI
 * Endpoint: https://brasilapi.com.br/api/cnpj/v1/{cnpj}
 * Validado em 2026-04-21 com CNPJ 47960950000121 (Magazine Luiza)
 */

export interface Socio {
  nome_socio: string;
  qualificacao_socio: string;
  data_entrada_sociedade: string;
  faixa_etaria: string | null;
  cnpj_cpf_do_socio: string;
  identificador_de_socio: number;
  pais: string | null;
  codigo_pais: number | null;
  codigo_faixa_etaria: number | null;
  codigo_qualificacao_socio: number;
  nome_representante_legal: string;
  cpf_representante_legal: string;
  qualificacao_representante_legal: string;
  codigo_qualificacao_representante_legal: number;
}

export interface CnaeSecundario {
  codigo: number;
  descricao: string;
}

export interface RegimeTributario {
  ano: number;
  cnpj_da_scp: string | null;
  forma_de_tributacao: string;
  quantidade_de_escrituracoes: number;
}

export interface CnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: number;
  descricao_situacao_cadastral: string;
  data_situacao_cadastral: string;
  motivo_situacao_cadastral: number;
  descricao_motivo_situacao_cadastral: string;
  porte: string;
  codigo_porte: number;
  natureza_juridica: string;
  codigo_natureza_juridica: number;
  capital_social: number;
  data_inicio_atividade: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  cnaes_secundarios: CnaeSecundario[];
  qsa: Socio[];
  opcao_pelo_simples: boolean | null;
  opcao_pelo_mei: boolean | null;
  data_opcao_pelo_simples: string | null;
  data_opcao_pelo_mei: string | null;
  data_exclusao_do_simples: string | null;
  data_exclusao_do_mei: string | null;
  regime_tributario: RegimeTributario[];
  identificador_matriz_filial: number;
  descricao_identificador_matriz_filial: string;
  uf: string;
  municipio: string;
  bairro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  cep: string;
  ddd_telefone_1: string;
  ddd_telefone_2: string;
  ddd_fax: string;
  email: string | null;
  pais: string | null;
  situacao_especial: string;
  data_situacao_especial: string | null;
  ente_federativo_responsavel: string;
  qualificacao_do_responsavel: number;
}

export interface RiskAnalysis {
  score: number;
  flags: string[];
}

export type StatusEmpresa = 'em_analise' | 'aprovada' | 'rejeitada';

export interface EmpresaRegistrada {
  chat_id: string;
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  situacao: string | null;
  porte: string | null;
  uf: string | null;
  municipio: string | null;
  risk_score: number | null;
  status: StatusEmpresa;
  observacoes: string | null;
  created_at: Date;
  updated_at: Date;
}
