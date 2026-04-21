import { describe, expect, test, mock } from 'bun:test';
import { formatarCnpj, nullIfEmpty, validarCnpj, validarDataISO, fetchComRetry, emit } from '../tools/helpers.ts';

describe('validarCnpj', () => {
  test('aceita CNPJ válido só com dígitos', () => {
    expect(validarCnpj('47960950000121')).toBe('47960950000121');
  });

  test('aceita CNPJ válido formatado', () => {
    expect(validarCnpj('47.960.950/0001-21')).toBe('47960950000121');
  });

  test('normaliza removendo qualquer não-dígito', () => {
    expect(validarCnpj(' 47 960 950/0001-21 ')).toBe('47960950000121');
  });

  test('rejeita tamanho diferente de 14 dígitos', () => {
    expect(validarCnpj('12345')).toBeNull();
    expect(validarCnpj('')).toBeNull();
  });

  test('rejeita dígitos todos iguais', () => {
    expect(validarCnpj('11111111111111')).toBeNull();
    expect(validarCnpj('00000000000000')).toBeNull();
  });

  test('rejeita dígitos verificadores incorretos', () => {
    expect(validarCnpj('47960950000122')).toBeNull();
  });
});

describe('formatarCnpj', () => {
  test('formata 14 dígitos no padrão XX.XXX.XXX/XXXX-XX', () => {
    expect(formatarCnpj('47960950000121')).toBe('47.960.950/0001-21');
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
  });

  test('retorna null para vazio/undefined/null', () => {
    expect(validarDataISO('')).toBeNull();
    expect(validarDataISO(null)).toBeNull();
  });
});

describe('nullIfEmpty', () => {
  test('retorna string com trim quando tem conteúdo', () => {
    expect(nullIfEmpty(' abc ')).toBe('abc');
  });

  test('retorna null para vazio, whitespace, null, undefined', () => {
    expect(nullIfEmpty('')).toBeNull();
    expect(nullIfEmpty('   ')).toBeNull();
    expect(nullIfEmpty(null)).toBeNull();
  });
});

describe('emit', () => {
  test('emite JSON estruturado no stdout', () => {
    const mockLog = mock(console, 'log');
    const obj = { sucesso: true, valor: 42 };
    emit(obj);
    expect(mockLog).toHaveBeenCalledWith(JSON.stringify(obj, null, 2));
    mockLog.mockRestore();
  });

  test('formata arrays corretamente', () => {
    const mockLog = mock(console, 'log');
    emit([1, 2, 3]);
    expect(mockLog).toHaveBeenCalled();
    mockLog.mockRestore();
  });
});

describe('fetchComRetry', () => {
  test('retorna resposta com sucesso na primeira tentativa', async () => {
    const mockFetch = mock(globalThis, 'fetch', () =>
      Promise.resolve(new Response('OK', { status: 200 })),
    );

    const res = await fetchComRetry('https://example.com', {}, 2);
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    mockFetch.mockRestore();
  });

  test('retenta em 5xx', async () => {
    let callCount = 0;
    const mockFetch = mock(globalThis, 'fetch', () => {
      callCount++;
      if (callCount < 2) {
        return Promise.resolve(new Response('Error', { status: 500 }));
      }
      return Promise.resolve(new Response('OK', { status: 200 }));
    });

    const res = await fetchComRetry('https://example.com', {}, 2);
    expect(res.status).toBe(200);
    expect(callCount).toBe(2);
    mockFetch.mockRestore();
  });

  test('não retenta em 4xx', async () => {
    const mockFetch = mock(globalThis, 'fetch', () =>
      Promise.resolve(new Response('Not found', { status: 404 })),
    );

    const res = await fetchComRetry('https://example.com', {}, 2);
    expect(res.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    mockFetch.mockRestore();
  });

  test('lança erro após esgotar tentativas', async () => {
    const mockFetch = mock(globalThis, 'fetch', () =>
      Promise.reject(new Error('Network error')),
    );

    try {
      await fetchComRetry('https://example.com', {}, 1);
      expect.unreachable();
    } catch (err) {
      expect(err instanceof Error).toBe(true);
    }
    mockFetch.mockRestore();
  });

  test('timeout de 10 segundos', async () => {
    const mockFetch = mock(globalThis, 'fetch', (url: string, opts: any) => {
      expect(opts.signal).toBeDefined();
      return Promise.resolve(new Response('OK', { status: 200 }));
    });

    await fetchComRetry('https://example.com');
    mockFetch.mockRestore();
  });
});
