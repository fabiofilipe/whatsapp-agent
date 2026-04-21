import type { CnpjResponse, RiskAnalysis } from './types.ts';

/**
 * Calcula score de risco (0-100) baseado nos dados cadastrais.
 * Heurística simples, transparente e explicável.
 */
export function calcularRisco(data: CnpjResponse): RiskAnalysis {
  let score = 50;
  const flags: string[] = [];

  // 1. Situação cadastral (peso alto)
  const situacao = (data.descricao_situacao_cadastral || '').toUpperCase();
  if (situacao === 'ATIVA') {
    score += 20;
  } else {
    score -= 40;
    flags.push(`🚩 Situação cadastral: ${situacao}`);
  }

  // 2. Idade da empresa
  const inicioAtividade = new Date(data.data_inicio_atividade);
  if (!Number.isNaN(inicioAtividade.getTime())) {
    const anos = (Date.now() - inicioAtividade.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (anos < 0) {
      // Data futura — dado sujo, ignorar
      flags.push('⚠️ Data de início de atividade inconsistente');
    } else if (anos >= 10) {
      score += 15;
    } else if (anos >= 5) {
      score += 8;
    } else if (anos < 1) {
      score -= 15;
      flags.push('⚠️ Empresa com menos de 1 ano de atividade');
    } else if (anos < 2) {
      score -= 5;
      flags.push('⚠️ Empresa com menos de 2 anos');
    }
  }

  // 3. Capital social (proxy de solidez)
  const capital = data.capital_social ?? 0;
  if (capital >= 1_000_000) {
    score += 10;
  } else if (capital >= 100_000) {
    score += 5;
  } else if (capital > 0 && capital < 1_000) {
    score -= 5;
    flags.push('⚠️ Capital social muito baixo (< R$ 1.000)');
  }

  // 4. Porte (coerência)
  const porte = (data.porte || '').toUpperCase();
  if (porte === 'DEMAIS' && capital < 100_000) {
    flags.push('⚠️ Porte "DEMAIS" com capital social baixo — inconsistência');
  }

  // 5. Motivo de situação diferente de "SEM MOTIVO"
  if (data.motivo_situacao_cadastral !== 0 && data.descricao_motivo_situacao_cadastral) {
    const motivo = data.descricao_motivo_situacao_cadastral.toUpperCase();
    if (motivo !== 'SEM MOTIVO') {
      flags.push(`🚩 Motivo cadastral: ${motivo}`);
    }
  }

  // 6. Sem sócios declarados
  if (!data.qsa || data.qsa.length === 0) {
    flags.push('⚠️ Nenhum sócio declarado no QSA');
    score -= 5;
  }

  // Normaliza para 0-100
  score = Math.max(0, Math.min(100, score));

  return { score, flags };
}

/** Retorna label textual e emoji baseado no score. */
export function classificarRisco(score: number): { label: string; emoji: string } {
  if (score >= 75) return { label: 'BAIXO', emoji: '🟢' };
  if (score >= 50) return { label: 'MÉDIO', emoji: '🟡' };
  if (score >= 30) return { label: 'ALTO', emoji: '🟠' };
  return { label: 'CRÍTICO', emoji: '🔴' };
}
