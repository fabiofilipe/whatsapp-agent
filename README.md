# DueDi — Agente de Due Diligence Empresarial via WhatsApp

Projeto desenvolvido como entrega do desafio técnico da Namastex Labs para a vaga de AI Engineer.

Implementei um agente conversacional de inteligência comercial B2B que consulta CNPJ, avalia risco e gerencia um pipeline de empresas — tudo operado por WhatsApp. A stack integra **Claude SDK** (modelo), **Genie** (orquestrador de agente), **Omni** (bridge de canal WhatsApp via Baileys) e **Postgres** (persistência), com toda a execução containerizada via Docker.

---

## Propósito e visão de produto

Identifiquei que todo profissional brasileiro que negocia B2B — vendedor, comprador, analista de crédito, terceirizador — precisa validar empresas antes de fechar negócio. Hoje esse fluxo é manual, exige consultar 4 ou 5 sites diferentes (BrasilAPI, Receita, ConsultaCNPJ, JusBrasil), e leva em média 30 minutos por empresa.

Projetei o DueDi para resolver isso em torno de 10 segundos, dentro do canal que o profissional brasileiro já usa no dia a dia (WhatsApp).

Exemplo real de interação que construí:

```
Usuário: 47960950000121

DueDi:
MAGAZINE LUIZA S/A (MAGAZINE LUIZA)
CNPJ: 47.960.950/0001-21
Score de risco: 95/100 (BAIXO)

Perfil
- Situação: ATIVA
- Porte: DEMAIS
- Natureza: Sociedade Anônima Aberta
- Fundada em: 1966-10-24 (59 anos)
- Capital social: R$ 14.202.162.000
- Regime: Lucro Real
- Atividade: Lojas de departamentos
- Localização: Franca/SP

Sócios (top 3)
- FREDERICO TRAJANO INACIO RODRIGUES — Presidente
- FABRICIO BITTAR GARCIA — Diretor
- ANDRE LUIZ DE SOUZA FATALA — Diretor

Análise: empresa consolidada, ativa há 59 anos,
capital social robusto. Perfil de baixo risco.

Quer marcar como aprovada, rejeitada ou em análise?
```

O histórico fica persistido — o usuário pode listar empresas por status, alterar classificações e adicionar observações por empresa, tudo via conversa.

Posicionei o produto como um CRM conversacional focado em B2B brasileiro. A proposta é democratizar inteligência comercial — o que grandes empresas pagam consultorias para fazer (KYC, KYB, homologação de fornecedores), qualquer profissional passa a ter no bolso.

---

## Arquitetura

```
WhatsApp (usuário)
    |
    v
Omni — bridge de canal (Baileys)
    | publica NATS: omni.message.{instance}.{chat}
    v
Genie — orquestrador (Claude SDK executor)
    | spawna sessão Claude
    v
Claude — interpreta intenção e chama tools via Bash
    |
    v
Tools TypeScript (bun)
    |-- consultar-cnpj.ts  -> BrasilAPI + Postgres
    |-- marcar-empresa.ts  -> Postgres
    |-- listar-empresas.ts -> Postgres
    |
    v
Claude formata resposta para WhatsApp
    | publica NATS: omni.reply.{instance}.{chat}
    v
Omni entrega a resposta
    |
    v
WhatsApp (usuário)
```

### Decisões arquiteturais principais

Tomei as seguintes decisões com base na leitura do código-fonte do Genie e do Omni:

1. **SDK executor no Genie** (`GENIE_EXECUTOR=sdk`). Optei por não usar o executor tmux porque ele exigiria setup adicional dentro do container e não traz benefício para meu caso de uso. O SDK executor roda o Claude em processo e dispensa qualquer terminal multiplexer.

2. **Provider `nats-genie` no Omni**. Em vez de construir um webhook HTTP intermediário, usei o provider nativo que a Namastex já implementou em `packages/core/src/providers/nats-genie-provider.ts`. A mensagem flui via pub/sub no NATS em tempo real, sem polling, sem overhead HTTP, e com garantias de entrega do JetStream.

3. **Tools como processos isolados**. Cada chamada do Claude spawna um processo Bun novo que abre a conexão Postgres, executa a query e fecha. Simplifica o modelo mental (cada tool é idempotente, sem estado compartilhado), evita conexões penduradas, e facilita o debug (basta rodar `bun tools/consultar-cnpj.ts ...` fora do agente).

4. **Postgres dedicado para o agente**. Separei o banco do agente do Postgres embedado do Omni. Evita acoplamento cruzado, permite backup independente, e isola o domínio de negócio da infraestrutura de mensageria.

5. **Upsert por `(chat_id, cnpj)`**. Cada usuário tem seu próprio pipeline. O isolamento é natural a partir da chave composta, sem precisar implementar multi-tenancy complexo. Um usuário não vê as empresas de outro.

6. **Validação de CNPJ com dígitos verificadores**. O review inicial do código detectou que `replace(/\D/g, '') && length === 14` aceita lixo como `"00000000000000"`. Implementei o algoritmo oficial dos dígitos verificadores em `tools/helpers.ts` para rejeitar entradas inválidas antes de queimar rate limit da BrasilAPI.

---

## Ferramentas do agente

| Tool | O que faz | Fonte de dados |
|------|-----------|----------------|
| `consultar-cnpj` | Busca dados cadastrais completos, calcula risk score (0-100), persiste no banco e loga a consulta | [BrasilAPI](https://brasilapi.com.br/docs) — gratuita, sem chave |
| `marcar-empresa` | Atualiza status (`em_analise` / `aprovada` / `rejeitada`) e observações da empresa | Postgres local |
| `listar-empresas` | Lista empresas consultadas com filtro por status e contadores agregados | Postgres local |

### Algoritmo de score de risco

Implementei uma heurística transparente e explicável em `tools/risk.ts` baseada em seis fatores:

1. **Situação cadastral** — ATIVA acrescenta 20 ao score; outras (BAIXADA, SUSPENSA, INAPTA) subtraem 40 e geram flag visível.
2. **Idade da empresa** — 10+ anos adiciona 15, 5+ anos adiciona 8, menos de 1 ano subtrai 15 e gera flag.
3. **Capital social** — acima de R$ 1M adiciona 10, abaixo de R$ 1k subtrai 5 e gera flag.
4. **Coerência porte × capital** — gera flag se porte "DEMAIS" vier com capital social abaixo de R$ 100k.
5. **Motivo de situação cadastral** — qualquer motivo diferente de "SEM MOTIVO" gera flag.
6. **QSA vazio** — sem sócios declarados gera flag e subtrai 5.

O score final é normalizado no intervalo 0-100 e mapeado para uma classificação textual (BAIXO, MÉDIO, ALTO, CRÍTICO). Escolhi heurística em vez de ML para manter o processo auditável e simples de evoluir — adicionar um fator novo é uma linha de código.

---

## Setup

### Pré-requisitos

- Docker + Docker Compose
- Um número de WhatsApp para conectar via QR code
- Uma chave da API Anthropic ([console.anthropic.com](https://console.anthropic.com/settings/keys))

### 1. Variáveis de ambiente

```bash
cp .env.example .env
```

No `.env`, preencha:
- `ANTHROPIC_API_KEY` — sua chave da Anthropic
- `AGENT_DB_PASSWORD` — opcional; use uma senha forte em produção

### 2. Subir infraestrutura base

```bash
docker compose up nats omni agent-db --build
```

Aguarde cerca de 45 segundos. A `OMNI_API_KEY` aparece no log do container omni:

```
[omni] Primary API Key: omni_xxxxxxxxxxxx
```

Copie e adicione ao `.env`:

```
OMNI_API_KEY=omni_xxxxxxxxxxxx
```

### 3. Configurar WhatsApp e provider Genie

```bash
./scripts/setup-omni.sh
```

O script executa:

1. Cria a instância WhatsApp no Omni
2. Instrui como escanear o QR code
3. Cria o provider `nats-genie` (ponte Omni para Genie)
4. Vincula o provider à instância
5. Salva os IDs gerados no `.env`

### 4. Subir o agente

```bash
docker compose up genie --build
```

### 5. Testar

Envio mensagens sugeridas:

- `"oi"` — apresentação do DueDi
- `47960950000121` — consulta Magazine Luiza (dado real)
- `"marca essa como aprovada"` — atualiza status
- `"me lista minhas empresas"` — resumo do pipeline

---

## Estrutura do projeto

```
.
|-- docker-compose.yml                  # Orquestração: nats + omni + agent-db + genie
|-- docker/
|   |-- omni/Dockerfile                 # Clona automagik-dev/omni
|   |-- genie/
|   |   |-- Dockerfile                  # Bun + Genie + Postgres client + tools
|   |   `-- entrypoint.sh               # Espera Postgres + genie serve --headless
|   `-- agent-db/init.sql               # Schema inicial (auto-executado)
|-- workspace/
|   |-- .genie/workspace.json           # Marca workspace para o Genie
|   `-- agents/assistente/
|       `-- AGENTS.md                   # System prompt + configuração do agente
|-- tools/                              # Ferramentas TypeScript (Bun)
|   |-- package.json
|   |-- tsconfig.json
|   |-- types.ts                        # Tipos derivados da BrasilAPI
|   |-- db.ts                           # Cliente Postgres (postgres.js)
|   |-- risk.ts                         # Algoritmo de score de risco
|   |-- helpers.ts                      # Validação CNPJ, fetch com retry, emit JSON
|   |-- consultar-cnpj.ts               # Tool 1
|   |-- marcar-empresa.ts               # Tool 2
|   `-- listar-empresas.ts              # Tool 3
|-- scripts/
|   `-- setup-omni.sh                   # Configura Omni pós-boot (QR + provider)
|-- .env.example
`-- README.md
```

---

## Variáveis de ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `ANTHROPIC_API_KEY` | sim | Chave da API Anthropic |
| `OMNI_API_KEY` | sim | Gerada no primeiro boot do Omni |
| `AGENT_DB_PASSWORD` | não | Senha do Postgres do agente (default `agent`) |
| `OMNI_INSTANCE_ID` | auto | Preenchido pelo `setup-omni.sh` |
| `OMNI_PROVIDER_ID` | auto | Preenchido pelo `setup-omni.sh` |

---

## Qualidade de código

Apliquei os seguintes padrões ao longo da implementação:

- **TypeScript estrito** com `strict: true` no `tsconfig.json`
- **Tipos derivados da API real** — antes de escrever as tools, validei o schema da BrasilAPI fazendo uma requisição direta com `curl` contra o CNPJ da Magazine Luiza (47960950000121) e derivei os tipos do JSON retornado. Evitei tipagem baseada em documentação desatualizada.
- **Validação de CNPJ** com cálculo dos dois dígitos verificadores
- **Fetch com retry** — backoff exponencial curto em respostas 5xx da BrasilAPI
- **Tratamento uniforme de erros** — todas as tools emitem JSON em stdout e usam exit code != 0 para sinalizar falha; stderr fica reservado para logs humanos
- **SQL parametrizado** via tagged templates do `postgres.js` (imune a injection)
- **Code review automatizado** — submeti as tools a um agente revisor especializado antes do commit final e corrigi todos os problemas classificados como críticos (🔴) e altos (🟠)

---

## Roadmap

O MVP entregue cobre o ciclo completo consultar → classificar → gerenciar. Listei os próximos passos naturais de evolução do produto:

- **Watch list**: monitorar empresas periodicamente e alertar mudanças (endereço, sócios, situação cadastral)
- **Análise de rede societária**: detectar grupos econômicos cruzando sócios entre empresas consultadas pelo mesmo usuário
- **Score customizável**: permitir pesos ajustáveis por setor ou por regra do usuário
- **Enriquecimento externo**: cruzar com CEPIM, CNEP e Lista de Inidôneos do TCU
- **Benchmarking setorial**: comparar empresa X com peers do mesmo CNAE e região
- **Exportar pipeline**: gerar CSV ou PDF do histórico para relatórios comerciais

---

## Licença

MIT.
