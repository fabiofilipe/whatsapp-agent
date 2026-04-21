import { describe, expect, test, beforeAll, afterAll, afterEach } from 'bun:test';
import postgres from 'postgres';

// Usa DB de testes ou a principal
const getTestDb = () => {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL ou TEST_DATABASE_URL não definida');
  }
  return postgres(url, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
};

let sql: ReturnType<typeof postgres>;

beforeAll(async () => {
  sql = getTestDb();
  console.log('📦 Conectado ao banco de testes');
});

afterAll(async () => {
  if (sql) {
    await sql.end({ timeout: 5 });
  }
  console.log('🔌 Desconectado do banco');
});

afterEach(async () => {
  // Limpa dados de teste após cada teste
  try {
    const chatIdTeste = 'test-chat-id-' + Date.now();
    await sql`DELETE FROM empresas WHERE chat_id LIKE ${'test-chat-%'}`;
    await sql`DELETE FROM consultas_log WHERE chat_id LIKE ${'test-chat-%'}`;
  } catch (err) {
    // Ignorar se tabelas não existem
  }
});

describe('DB: Operações com empresas', () => {
  test('insere empresa com dados completos', async () => {
    const chatId = 'test-chat-' + Date.now();
    const cnpj = '47960950000121';

    await sql`
      INSERT INTO empresas (
        chat_id, cnpj, razao_social, nome_fantasia,
        situacao, porte, uf, municipio
      ) VALUES (
        ${chatId}, ${cnpj}, ${'Test Corp'}, ${'Test'},
        ${'ATIVA'}, ${'GRANDE'}, ${'SP'}, ${'São Paulo'}
      )
    `;

    const [empresa] = await sql<any>`
      SELECT * FROM empresas WHERE chat_id = ${chatId} AND cnpj = ${cnpj}
    `;

    expect(empresa).toBeDefined();
    expect(empresa.razao_social).toBe('Test Corp');
    expect(empresa.cnpj).toBe(cnpj);
  });

  test('upsert mantém status e observações existentes', async () => {
    const chatId = 'test-chat-' + Date.now();
    const cnpj = '11222333000181';

    // Insert inicial com status
    await sql`
      INSERT INTO empresas (
        chat_id, cnpj, razao_social, status, observacoes
      ) VALUES (
        ${chatId}, ${cnpj}, ${'Company A'}, ${'aprovada'}, ${'Verificado'}
      )
    `;

    // Upsert novo com dados diferentes, mas sem status/observacoes
    await sql`
      INSERT INTO empresas (
        chat_id, cnpj, razao_social, nome_fantasia, risk_score
      ) VALUES (
        ${chatId}, ${cnpj}, ${'Company A Updated'}, ${'Updated'}, ${45}
      )
      ON CONFLICT (chat_id, cnpj) DO UPDATE SET
        razao_social = EXCLUDED.razao_social,
        nome_fantasia = EXCLUDED.nome_fantasia,
        risk_score = EXCLUDED.risk_score
    `;

    const [empresa] = await sql<any>`
      SELECT * FROM empresas WHERE chat_id = ${chatId} AND cnpj = ${cnpj}
    `;

    // Deve manter status e observações originais
    expect(empresa.status).toBe('aprovada');
    expect(empresa.observacoes).toBe('Verificado');
    // Mas atualizar os outros campos
    expect(empresa.nome_fantasia).toBe('Updated');
    expect(empresa.risk_score).toBe(45);
  });

  test('grava risk_score e risk_flags como JSON', async () => {
    const chatId = 'test-chat-' + Date.now();
    const cnpj = '12345678000100';
    const riskFlags = ['⚠️ Flag 1', '🚩 Flag 2'];

    await sql`
      INSERT INTO empresas (
        chat_id, cnpj, razao_social, risk_score, risk_flags
      ) VALUES (
        ${chatId}, ${cnpj}, ${'Test'}, ${65},
        ${sql.json(riskFlags)}
      )
    `;

    const [empresa] = await sql<any>`
      SELECT * FROM empresas WHERE chat_id = ${chatId}
    `;

    expect(empresa.risk_score).toBe(65);
    expect(Array.isArray(empresa.risk_flags)).toBe(true);
    expect(empresa.risk_flags).toEqual(riskFlags);
  });

  test('grava raw_data da BrasilAPI como JSON', async () => {
    const chatId = 'test-chat-' + Date.now();
    const cnpj = '47960950000121';
    const rawData = {
      cnpj,
      razao_social: 'Magazine',
      qsa: [{ nome_socio: 'John' }],
      cnaes_secundarios: [],
    };

    await sql`
      INSERT INTO empresas (
        chat_id, cnpj, razao_social, raw_data
      ) VALUES (
        ${chatId}, ${cnpj}, ${'Magazine'}, ${sql.json(rawData)}
      )
    `;

    const [empresa] = await sql<any>`
      SELECT * FROM empresas WHERE chat_id = ${chatId}
    `;

    expect(empresa.raw_data).toEqual(rawData);
    expect(empresa.raw_data.qsa).toEqual([{ nome_socio: 'John' }]);
  });

  test('campos null são gravados corretamente', async () => {
    const chatId = 'test-chat-' + Date.now();
    const cnpj = '99999999999999';

    await sql`
      INSERT INTO empresas (
        chat_id, cnpj, razao_social,
        nome_fantasia, email, telefone, observacoes
      ) VALUES (
        ${chatId}, ${cnpj}, ${'Test'},
        ${null}, ${null}, ${null}, ${null}
      )
    `;

    const [empresa] = await sql<any>`
      SELECT * FROM empresas WHERE chat_id = ${chatId}
    `;

    expect(empresa.nome_fantasia).toBeNull();
    expect(empresa.email).toBeNull();
    expect(empresa.telefone).toBeNull();
    expect(empresa.observacoes).toBeNull();
  });
});

describe('DB: Log de consultas', () => {
  test('registra consulta bem-sucedida', async () => {
    const chatId = 'test-chat-' + Date.now();
    const cnpj = '47960950000121';

    await sql`
      INSERT INTO consultas_log (chat_id, cnpj, sucesso)
      VALUES (${chatId}, ${cnpj}, true)
    `;

    const [log] = await sql<any>`
      SELECT * FROM consultas_log
      WHERE chat_id = ${chatId} AND cnpj = ${cnpj}
    `;

    expect(log).toBeDefined();
    expect(log.sucesso).toBe(true);
    expect(log.erro_msg).toBeNull();
  });

  test('registra consulta com erro', async () => {
    const chatId = 'test-chat-' + Date.now();
    const cnpj = '11111111111111';
    const erro = 'CNPJ inválido';

    await sql`
      INSERT INTO consultas_log (chat_id, cnpj, sucesso, erro_msg)
      VALUES (${chatId}, ${cnpj}, false, ${erro})
    `;

    const [log] = await sql<any>`
      SELECT * FROM consultas_log
      WHERE chat_id = ${chatId}
    `;

    expect(log.sucesso).toBe(false);
    expect(log.erro_msg).toBe(erro);
  });

  test('timestamps são criados automaticamente', async () => {
    const chatId = 'test-chat-' + Date.now();

    await sql`
      INSERT INTO consultas_log (chat_id, cnpj, sucesso)
      VALUES (${chatId}, ${'12345678000100'}, true)
    `;

    const [log] = await sql<any>`
      SELECT * FROM consultas_log WHERE chat_id = ${chatId}
    `;

    expect(log.created_at).toBeDefined();
    expect(log.created_at instanceof Date || typeof log.created_at === 'string').toBe(true);
  });
});

describe('DB: Validações de integridade', () => {
  test('múltiplas empresas por chat_id', async () => {
    const chatId = 'test-chat-' + Date.now();
    const cnpj1 = '47960950000121';
    const cnpj2 = '11222333000181';

    await sql`
      INSERT INTO empresas (chat_id, cnpj, razao_social)
      VALUES
        (${chatId}, ${cnpj1}, ${'Company 1'}),
        (${chatId}, ${cnpj2}, ${'Company 2'})
    `;

    const empresas = await sql<any>`
      SELECT * FROM empresas WHERE chat_id = ${chatId}
      ORDER BY cnpj
    `;

    expect(empresas.length).toBe(2);
    expect(empresas[0].cnpj).toBe(cnpj2); // cnpj2 vem primeiro ordenado por CNPJ
    expect(empresas[1].cnpj).toBe(cnpj1);
  });

  test('histórico de consultas por empresa', async () => {
    const chatId = 'test-chat-' + Date.now();
    const cnpj = '47960950000121';

    // 3 consultas do mesmo CNPJ
    for (let i = 0; i < 3; i++) {
      await sql`
        INSERT INTO consultas_log (chat_id, cnpj, sucesso)
        VALUES (${chatId}, ${cnpj}, ${i < 2}) -- 2 sucessos, 1 erro
      `;
    }

    const logs = await sql<any>`
      SELECT * FROM consultas_log
      WHERE chat_id = ${chatId} AND cnpj = ${cnpj}
    `;

    expect(logs.length).toBe(3);
    const sucessos = logs.filter((l: any) => l.sucesso);
    expect(sucessos.length).toBe(2);
  });

  test('atualiza updated_at em upsert', async () => {
    const chatId = 'test-chat-' + Date.now();
    const cnpj = '47960950000121';

    // Insert
    await sql`
      INSERT INTO empresas (chat_id, cnpj, razao_social)
      VALUES (${chatId}, ${cnpj}, ${'Company'})
    `;

    const [first] = await sql<any>`
      SELECT updated_at FROM empresas WHERE chat_id = ${chatId}
    `;

    // Aguarda um pouco para garantir timestamp diferente
    await new Promise((r) => setTimeout(r, 10));

    // Upsert
    await sql`
      INSERT INTO empresas (chat_id, cnpj, razao_social)
      VALUES (${chatId}, ${cnpj}, ${'Company Updated'})
      ON CONFLICT (chat_id, cnpj) DO UPDATE SET
        razao_social = EXCLUDED.razao_social,
        updated_at = NOW()
    `;

    const [second] = await sql<any>`
      SELECT updated_at FROM empresas WHERE chat_id = ${chatId}
    `;

    expect(second.updated_at > first.updated_at || second.updated_at === first.updated_at).toBe(true);
  });
});
