/**
 * Helpers compartilhados entre as tools.
 */

/**
 * Valida CNPJ com cálculo de dígitos verificadores.
 * Retorna o CNPJ normalizado (só dígitos) ou null se inválido.
 */
export function validarCnpj(input: string): string | null {
  const cnpj = input.replace(/\D/g, '');

  if (cnpj.length !== 14) return null;
  if (/^(\d)\1{13}$/.test(cnpj)) return null; // todos dígitos iguais

  const calcDigito = (base: string, pesos: number[]): number => {
    const soma = base
      .split('')
      .reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos12 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos13 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigito(cnpj.slice(0, 12), pesos12);
  const d2 = calcDigito(cnpj.slice(0, 12) + d1, pesos13);

  if (d1 !== Number(cnpj[12]) || d2 !== Number(cnpj[13])) return null;
  return cnpj;
}

/** Formata CNPJ no padrão XX.XXX.XXX/XXXX-XX. */
export function formatarCnpj(cnpj: string): string {
  const c = cnpj.replace(/\D/g, '').padStart(14, '0');
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12, 14)}`;
}

/**
 * Valida string de data no formato YYYY-MM-DD e retorna a mesma string
 * se válida, ou null caso contrário.
 */
export function validarDataISO(s: string | null | undefined): string | null {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return s;
}

/**
 * Normaliza string vazia para null. Útil para não gravar "" em colunas TEXT.
 */
export function nullIfEmpty(s: string | null | undefined): string | null {
  if (s == null) return null;
  const trimmed = s.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Emite JSON estruturado no stdout.
 * Por convenção, todas as tools emitem stdout JSON e usam exit code para sinalizar erro.
 */
export function emit(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

/**
 * Fetch com retry em 5xx (backoff exponencial curto).
 */
export async function fetchComRetry(
  url: string,
  opts: RequestInit = {},
  tentativas = 2,
): Promise<Response> {
  let ultimoErro: unknown;

  for (let i = 0; i <= tentativas; i++) {
    try {
      const res = await fetch(url, {
        ...opts,
        signal: AbortSignal.timeout(10_000),
      });
      // Retry só em 5xx
      if (res.status >= 500 && i < tentativas) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
        continue;
      }
      return res;
    } catch (err) {
      ultimoErro = err;
      if (i < tentativas) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      }
    }
  }

  throw ultimoErro ?? new Error('Falha desconhecida na requisição');
}
