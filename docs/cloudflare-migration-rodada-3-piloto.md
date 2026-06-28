# Rodada 3: Piloto Cartao e Contratos Digitais

## Status

Parcialmente concluida em 2026-06-27.

O piloto tecnico de D1 + Worker para Cartao e Contratos Digitais foi criado e validado em ambiente de desenvolvimento. O financeiro principal continua no Supabase, conforme o plano.

## O Que Foi Implementado

- Migration D1 `cloudflare/migrations/0002_cards_contracts_pilot.sql`.
- Tabelas piloto de Cartao:
  - `credit_card_invoices`;
  - `credit_card_invoice_items`;
  - `credit_card_profiles`;
  - `credit_card_merchant_rules`;
  - `credit_card_personal_categories`.
- Tabelas piloto de Contratos Digitais:
  - `contract_templates`;
  - `contract_clauses`;
  - `contract_documents`;
  - `contract_document_clauses`;
  - `contract_acceptance_links`;
  - `contract_acceptance_events`.
- Seeds iniciais:
  - categorias pessoais basicas para cartao;
  - modelo base de contrato VIP;
  - clausulas base congelaveis.
- Endpoints Worker de Cartao:
  - `GET /api/cards/invoices`;
  - `POST /api/cards/invoices`;
  - `GET /api/cards/invoices/:id/items`;
  - `PATCH /api/cards/items/bulk`;
  - `GET /api/cards/personal-categories`;
  - `POST /api/cards/personal-categories`;
  - `GET /api/cards/merchant-rules`;
  - `POST /api/cards/merchant-rules`;
  - `POST /api/cards/preview-transactions`.
- Endpoints Worker de Contratos:
  - `GET /api/contracts/templates`;
  - `POST /api/contracts/templates`;
  - `GET /api/contracts/templates/:id/clauses`;
  - `GET /api/contracts/documents`;
  - `POST /api/contracts/documents`;
  - `POST /api/contracts/documents/:id/acceptance-link`;
  - `GET /api/public/contracts/accept/:token`;
  - `POST /api/public/contracts/accept/:token`.
- Cliente frontend paralelo:
  - `src/lib/cloudflarePilotApi.ts`.

## Infraestrutura

- Migration aplicada no D1 dev:
  - `fin-ramos-dev`;
  - `df4271fc-7646-418c-8e71-4503bc89f2d1`.
- Migration aplicada no D1 prod:
  - `fin-ramos-prod`;
  - `e5042bed-6c68-4d0b-92e7-5f838666eb71`.
- Worker dev publicado:
  - `https://fin-ramos-api.patrickramos1-a11y.workers.dev`.

## Smoke Tests Realizados

- `GET /api/db-check`
  - retornou `schema_version = 0002_cards_contracts_pilot`.
- `GET /api/cards/personal-categories`
  - retornou categorias pessoais seedadas.
- `GET /api/contracts/templates`
  - retornou o modelo `Contrato VIP - Consultoria Ambiental`.
- `POST /api/contracts/documents`
  - criou documento de teste com 5 clausulas congeladas.
- `POST /api/contracts/documents/:id/acceptance-link`
  - criou link publico de aceite.
- `GET /api/public/contracts/accept/:token`
  - retornou contrato e clausulas sem login.
- `POST /api/public/contracts/accept/:token`
  - registrou aceite com data/hora.
- `POST /api/cards/invoices`
  - criou fatura piloto com item.
- `PATCH /api/cards/items/bulk`
  - classificou item como `EMPRESA` e `PRONTO`.
- `POST /api/cards/merchant-rules`
  - salvou regra de estabelecimento.
- `POST /api/cards/preview-transactions`
  - retornou grupo apto a pre-lancamento com `total_amount_cents`.
- `bun run build`
  - passou.
- `wrangler deploy --dry-run`
  - passou.

## O Que Ainda Nao Foi Migrado

- Telas reais de Cartao ainda nao foram trocadas para consumir Cloudflare por padrao.
- Tela real de Contratos Digitais ainda precisa ser ligada ao novo cliente API.
- Conversao real de itens de cartao para transacoes financeiras continua bloqueada/simulada ate a Rodada 4.
- Financeiro principal, transacoes, contas, dashboard e aprovacoes seguem no Supabase.
- R2 ainda nao esta sendo usado para armazenar arquivos de fatura/PDF nesta rodada.

## Decisoes Tomadas

- Valores novos de Cartao e Contrato usam `*_cents` em inteiros no D1 para reduzir erro de centavos.
- O Worker e a camada oficial de API; o frontend nao deve falar diretamente com D1.
- O piloto fica paralelo para evitar corte prematuro.
- O aceite digital e operacional com trilha de auditoria, nao assinatura certificada.

## Proximos Passos Recomendados

1. Ligar a tela de Cartao ao `cloudflarePilotApi` atras de uma flag ou modo piloto.
2. Ligar `Contratos > Documentos Digitais` ao `cloudflarePilotApi`.
3. Adicionar upload/leitura de arquivos no R2 para faturas e PDFs.
4. Criar relatorio de paridade entre dados Supabase e D1 dos modulos piloto.
5. So depois iniciar Rodada 4 para financeiro principal.

## Riscos e Cuidados

- D1 nao substitui Postgres linha por linha; regras que estavam em SQL/Postgres precisam virar codigo no Worker.
- O Worker ainda nao tem autenticacao propria; antes de dados reais sensiveis, proteger com Cloudflare Access ou sessao propria.
- Os dados de smoke test ficaram no D1 dev e estao identificados por `[SMOKE]` ou `codex-smoke-test`.
