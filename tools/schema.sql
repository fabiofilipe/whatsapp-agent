-- Schema do banco de dados do agente
-- Criado automaticamente no startup do container Genie

-- Tabela genérica de contexto por usuário (chat_id = identificador WhatsApp)
CREATE TABLE IF NOT EXISTS user_context (
  chat_id     TEXT PRIMARY KEY,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  -- TODO: adicionar colunas específicas do domínio aqui
);

-- Histórico de interações (para memória entre sessões)
CREATE TABLE IF NOT EXISTS interaction_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id     TEXT NOT NULL,
  role        TEXT NOT NULL CHECK(role IN ('user', 'agent')),
  content     TEXT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TODO: adicionar tabelas específicas do domínio aqui
-- Exemplo para finanças: expenses, budgets, categories
-- Exemplo para agenda: events, reminders
-- Exemplo para suporte: tickets, knowledge_base
