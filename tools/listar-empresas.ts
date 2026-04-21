#!/usr/bin/env bun
/**
 * Lista empresas consultadas por um chat_id, com filtro opcional de status.
 *
 * Uso:
 *   bun tools/listar-empresas.ts <chat_id> [status]
 *
 * Status: em_analise | aprovada | rejeitada | todas (default)
 */

import { getDb, closeDb } from './db.ts';
import { emit } from './helpers.ts';
import type { StatusEmpresa } from './types.ts';

const STATUS_VALIDOS: readonly StatusEmpresa[] = ['em_analise', 'aprovada', 'rejeitada'] as const;

function isStatusValido(s: string): s is StatusEmpresa {
  return (STATUS_VALIDOS as readonly string[]).includes(s);
}

interface LinhaEmpresa {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  situacao: string | null;
  porte: string | null;
  uf: string | null;
  municipio: string | null;
  risk_score: number | null;
  status: string;
  observacoes: string | null;
  updated_at: Date;
}

async function main() {
  const [chatId, filtroStatus] = process.argv.slice(2);

  if (!chatId) {
    emit({ sucesso: false, erro: 'Uso: bun listar-empresas.ts <chat_id> [status]' });
    process.exit(1);
  }

  const filtro = filtroStatus && isStatusValido(filtroStatus) ? filtroStatus : null;
  const sql = getDb();

  try {
    const rows = await sql<LinhaEmpresa[]>`
      SELECT cnpj, razao_social, nome_fantasia, situacao, porte, uf, municipio,
             risk_score, status, observacoes, updated_at
      FROM empresas
      WHERE chat_id = ${chatId}
        ${filtro ? sql`AND status = ${filtro}` : sql``}
      ORDER BY updated_at DESC
      LIMIT 50
    `;

    const [counters] = await sql<[{
      em_analise: number; aprovada: number; rejeitada: number; total: number;
    }]>`
      SELECT
        COUNT(*) FILTER (WHERE status = 'em_analise')::int AS em_analise,
        COUNT(*) FILTER (WHERE status = 'aprovada')::int   AS aprovada,
        COUNT(*) FILTER (WHERE status = 'rejeitada')::int  AS rejeitada,
        COUNT(*)::int                                       AS total
      FROM empresas
      WHERE chat_id = ${chatId}
    `;

    emit({
      sucesso: true,
      filtro: filtro ?? 'todas',
      resumo: {
        total: counters.total,
        em_analise: counters.em_analise,
        aprovada: counters.aprovada,
        rejeitada: counters.rejeitada,
      },
      empresas: rows.map((r) => ({
        cnpj: r.cnpj,
        razao_social: r.razao_social,
        nome_fantasia: r.nome_fantasia,
        situacao: r.situacao,
        porte: r.porte,
        localizacao: r.uf && r.municipio ? `${r.municipio}/${r.uf}` : null,
        risk_score: r.risk_score,
        status: r.status,
        observacoes: r.observacoes,
        ultima_atualizacao: r.updated_at.toISOString(),
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit({ sucesso: false, erro: msg });
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
