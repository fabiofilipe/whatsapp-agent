#!/usr/bin/env bun
/**
 * Consulta um CNPJ na BrasilAPI, calcula risco e persiste no banco.
 *
 * Uso:
 *   bun tools/consultar-cnpj.ts <chat_id> <cnpj>
 *
 * Saída: JSON em stdout. Exit code != 0 em caso de erro.
 */

import { getDb, closeDb } from './db.ts';
import { calcularRisco, classificarRisco } from './risk.ts';
import { emit, fetchComRetry, nullIfEmpty, validarCnpj, validarDataISO } from './helpers.ts';
import type { CnpjResponse } from './types.ts';

const BRASIL_API = 'https://brasilapi.com.br/api/cnpj/v1';

async function consultarBrasilApi(cnpj: string): Promise<CnpjResponse> {
  const res = await fetchComRetry(`${BRASIL_API}/${cnpj}`);

  if (res.status === 404) {
    throw new Error(`CNPJ ${cnpj} não encontrado na Receita Federal.`);
  }
  if (res.status === 429) {
    throw new Error('Limite de requisições atingido. Aguarde alguns segundos e tente novamente.');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`BrasilAPI respondeu ${res.status}: ${body.slice(0, 200)}`);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error('BrasilAPI retornou resposta em formato inesperado (não-JSON).');
  }

  return data as CnpjResponse;
}

function inferirRegimeTributario(data: CnpjResponse): string {
  if (data.opcao_pelo_simples === true) return 'Simples Nacional';
  if (data.opcao_pelo_mei === true) return 'MEI';
  if (data.opcao_pelo_simples === false) return 'Lucro Presumido/Real';
  return 'Não informado';
}

async function main() {
  const [chatId, cnpjRaw] = process.argv.slice(2);

  if (!chatId || !cnpjRaw) {
    emit({ sucesso: false, erro: 'Uso: bun consultar-cnpj.ts <chat_id> <cnpj>' });
    process.exit(1);
  }

  const cnpj = validarCnpj(cnpjRaw);
  if (!cnpj) {
    emit({ sucesso: false, erro: 'CNPJ inválido. Verifique o número e tente novamente.' });
    process.exit(1);
  }

  const sql = getDb();

  try {
    const data = await consultarBrasilApi(cnpj);
    const risco = calcularRisco(data);
    const classificacao = classificarRisco(risco.score);

    // Normaliza valores antes de gravar
    const cnaePrincipal = data.cnae_fiscal != null ? String(data.cnae_fiscal) : null;
    const dataInicio = validarDataISO(data.data_inicio_atividade);
    const capitalSocial = Number.isFinite(data.capital_social) ? data.capital_social : null;

    // Upsert por (chat_id, cnpj). NÃO sobrescreve status/observacoes existentes.
    await sql`
      INSERT INTO empresas (
        chat_id, cnpj, razao_social, nome_fantasia, situacao, porte,
        natureza_juridica, capital_social, data_inicio,
        cnae_principal, cnae_descricao,
        uf, municipio, email, telefone,
        opcao_simples, socios, risk_score, risk_flags, raw_data
      ) VALUES (
        ${chatId}, ${cnpj},
        ${nullIfEmpty(data.razao_social)},
        ${nullIfEmpty(data.nome_fantasia)},
        ${nullIfEmpty(data.descricao_situacao_cadastral)},
        ${nullIfEmpty(data.porte)},
        ${nullIfEmpty(data.natureza_juridica)},
        ${capitalSocial},
        ${dataInicio},
        ${cnaePrincipal},
        ${nullIfEmpty(data.cnae_fiscal_descricao)},
        ${nullIfEmpty(data.uf)},
        ${nullIfEmpty(data.municipio)},
        ${nullIfEmpty(data.email)},
        ${nullIfEmpty(data.ddd_telefone_1)},
        ${data.opcao_pelo_simples ?? null},
        ${sql.json(data.qsa ?? [])},
        ${risco.score},
        ${sql.json(risco.flags)},
        ${sql.json(data)}
      )
      ON CONFLICT (chat_id, cnpj) DO UPDATE SET
        razao_social     = EXCLUDED.razao_social,
        nome_fantasia    = EXCLUDED.nome_fantasia,
        situacao         = EXCLUDED.situacao,
        porte            = EXCLUDED.porte,
        natureza_juridica = EXCLUDED.natureza_juridica,
        capital_social   = EXCLUDED.capital_social,
        data_inicio      = EXCLUDED.data_inicio,
        cnae_principal   = EXCLUDED.cnae_principal,
        cnae_descricao   = EXCLUDED.cnae_descricao,
        uf               = EXCLUDED.uf,
        municipio        = EXCLUDED.municipio,
        email            = EXCLUDED.email,
        telefone         = EXCLUDED.telefone,
        opcao_simples    = EXCLUDED.opcao_simples,
        socios           = EXCLUDED.socios,
        risk_score       = EXCLUDED.risk_score,
        risk_flags       = EXCLUDED.risk_flags,
        raw_data         = EXCLUDED.raw_data
    `;

    await sql`
      INSERT INTO consultas_log (chat_id, cnpj, sucesso)
      VALUES (${chatId}, ${cnpj}, true)
    `;

    // Status/observacoes atuais (podem vir de consulta anterior)
    const [linha] = await sql<{ status: string; observacoes: string | null }[]>`
      SELECT status, observacoes FROM empresas
      WHERE chat_id = ${chatId} AND cnpj = ${cnpj}
    `;

    const socios_resumo = (data.qsa ?? []).map((s) => ({
      nome: s.nome_socio,
      qualificacao: s.qualificacao_socio,
    }));

    emit({
      sucesso: true,
      cnpj: data.cnpj,
      razao_social: data.razao_social,
      nome_fantasia: nullIfEmpty(data.nome_fantasia),
      situacao: data.descricao_situacao_cadastral,
      porte: data.porte,
      natureza_juridica: data.natureza_juridica,
      capital_social: capitalSocial,
      data_inicio: dataInicio,
      cnae: cnaePrincipal ? `${cnaePrincipal} - ${data.cnae_fiscal_descricao}` : null,
      cnaes_secundarios: (data.cnaes_secundarios ?? []).slice(0, 5).map((c) => c.descricao),
      endereco: data.municipio && data.uf ? `${data.municipio}/${data.uf}` : null,
      email: nullIfEmpty(data.email),
      telefone: nullIfEmpty(data.ddd_telefone_1),
      socios: socios_resumo,
      regime_tributario: inferirRegimeTributario(data),
      risco: {
        score: risco.score,
        classificacao: `${classificacao.emoji} ${classificacao.label}`,
        flags: risco.flags,
      },
      status_atual: linha?.status ?? 'em_analise',
      observacoes: linha?.observacoes ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    try {
      await sql`
        INSERT INTO consultas_log (chat_id, cnpj, sucesso, erro_msg)
        VALUES (${chatId}, ${cnpj}, false, ${msg})
      `;
    } catch (logErr) {
      console.error('[consultar-cnpj] falha ao gravar log:', logErr instanceof Error ? logErr.message : logErr);
    }

    emit({ sucesso: false, erro: msg });
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
