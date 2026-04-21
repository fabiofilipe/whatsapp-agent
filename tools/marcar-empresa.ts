#!/usr/bin/env bun
/**
 * Atualiza o status de uma empresa já consultada.
 *
 * Uso:
 *   bun tools/marcar-empresa.ts <chat_id> <cnpj> <status> [observacoes...]
 *
 * Status válidos: em_analise | aprovada | rejeitada
 *
 * Observações: se omitidas, preserva o valor anterior. Passe "-" para limpar.
 */

import { getDb, closeDb } from './db.ts';
import { emit, validarCnpj } from './helpers.ts';
import type { StatusEmpresa } from './types.ts';

const STATUS_VALIDOS: readonly StatusEmpresa[] = ['em_analise', 'aprovada', 'rejeitada'] as const;

function isStatusValido(s: string): s is StatusEmpresa {
  return (STATUS_VALIDOS as readonly string[]).includes(s);
}

async function main() {
  const [chatId, cnpjRaw, status, ...obsParts] = process.argv.slice(2);

  if (!chatId || !cnpjRaw || !status) {
    emit({ sucesso: false, erro: 'Uso: bun marcar-empresa.ts <chat_id> <cnpj> <status> [observacoes]' });
    process.exit(1);
  }

  if (!isStatusValido(status)) {
    emit({ sucesso: false, erro: `Status inválido. Use: ${STATUS_VALIDOS.join(', ')}` });
    process.exit(1);
  }

  const cnpj = validarCnpj(cnpjRaw);
  if (!cnpj) {
    emit({ sucesso: false, erro: 'CNPJ inválido.' });
    process.exit(1);
  }

  // Semântica das observações:
  //   - vazio (sem argumento) → preserva valor anterior
  //   - "-" → limpa (set null)
  //   - qualquer outra string → atualiza
  const obsTrim = obsParts.join(' ').trim();
  let obsValue: string | null | undefined;
  if (obsTrim === '') {
    obsValue = undefined; // preserva
  } else if (obsTrim === '-') {
    obsValue = null; // limpa
  } else {
    obsValue = obsTrim;
  }

  const sql = getDb();

  try {
    const result = obsValue === undefined
      ? await sql<{ razao_social: string | null; observacoes: string | null }[]>`
          UPDATE empresas
            SET status = ${status}
          WHERE chat_id = ${chatId} AND cnpj = ${cnpj}
          RETURNING razao_social, observacoes
        `
      : await sql<{ razao_social: string | null; observacoes: string | null }[]>`
          UPDATE empresas
            SET status = ${status},
                observacoes = ${obsValue}
          WHERE chat_id = ${chatId} AND cnpj = ${cnpj}
          RETURNING razao_social, observacoes
        `;

    if (result.length === 0) {
      emit({
        sucesso: false,
        erro: 'Empresa não encontrada. Consulte o CNPJ primeiro antes de marcar status.',
      });
      process.exit(1);
    }

    emit({
      sucesso: true,
      cnpj,
      razao_social: result[0].razao_social,
      status,
      observacoes: result[0].observacoes,
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
