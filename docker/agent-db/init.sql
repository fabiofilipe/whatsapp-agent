-- Schema inicial do agente de Due Diligence
-- Executado automaticamente no primeiro boot do container Postgres
-- (via docker-entrypoint-initdb.d)

CREATE TABLE IF NOT EXISTS empresas (
  chat_id              TEXT         NOT NULL,
  cnpj                 TEXT         NOT NULL,
  razao_social         TEXT,
  nome_fantasia        TEXT,
  situacao             TEXT,
  porte                TEXT,
  natureza_juridica    TEXT,
  capital_social       NUMERIC(15,2),
  data_inicio          DATE,
  cnae_principal       TEXT,
  cnae_descricao       TEXT,
  uf                   TEXT,
  municipio            TEXT,
  email                TEXT,
  telefone             TEXT,
  opcao_simples        BOOLEAN,
  socios               JSONB,
  risk_score           INTEGER CHECK (risk_score BETWEEN 0 AND 100),
  risk_flags           JSONB,
  status               TEXT         NOT NULL DEFAULT 'em_analise'
                         CHECK (status IN ('em_analise', 'aprovada', 'rejeitada')),
  observacoes          TEXT,
  raw_data             JSONB,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, cnpj)
);

CREATE INDEX IF NOT EXISTS idx_empresas_status  ON empresas(chat_id, status);
CREATE INDEX IF NOT EXISTS idx_empresas_updated ON empresas(chat_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS consultas_log (
  id          BIGSERIAL PRIMARY KEY,
  chat_id     TEXT        NOT NULL,
  cnpj        TEXT        NOT NULL,
  sucesso     BOOLEAN     NOT NULL DEFAULT TRUE,
  erro_msg    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultas_log_chat ON consultas_log(chat_id, created_at DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS empresas_updated_at ON empresas;
CREATE TRIGGER empresas_updated_at
  BEFORE UPDATE ON empresas
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();
