import postgres from 'postgres';

let client: ReturnType<typeof postgres> | null = null;

/** Retorna singleton do cliente Postgres. Fecha automaticamente no exit. */
export function getDb() {
  if (client) return client;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL não definida no ambiente.');
  }

  client = postgres(url, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {}, // suprime NOTICE
  });

  return client;
}

/** Fecha conexões pendentes. Chamar antes do process.exit. */
export async function closeDb(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = null;
  }
}
