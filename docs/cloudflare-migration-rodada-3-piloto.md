# Rodada 3: Piloto Cartao e Contratos Digitais

## Status

Parcialmente concluida e atualizada em 2026-06-28.

O piloto tecnico de D1 + Worker para Cartao e Contratos Digitais foi criado, publicado e validado em ambiente de desenvolvimento. As telas reais de Cartao e Contratos agora possuem uma ponte controlada por variavel de ambiente para consumir Cloudflare. O financeiro principal continua no Supabase, conforme o plano.

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
  - `PATCH /api/cards/invoices/:id`;
  - `DELETE /api/cards/invoices/:id`;
  - `GET /api/cards/invoices/:id/items`;
  - `GET /api/cards/profiles`;
  - `POST /api/cards/profiles`;
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
- Cliente frontend paralelo em `src/lib/cloudflarePilotApi.ts`.
- Ponte da tela real de Cartao em `src/hooks/useCreditCardInvoices.ts`.
- Ponte da tela real de Contratos Digitais em `src/hooks/useDigitalContracts.ts`.
- Selecao de backend por variavel de ambiente:
  - `VITE_CARDS_BACKEND=cloudflare` para Cartao;
  - `VITE_CONTRACTS_BACKEND=cloudflare` para Contratos;
  - `VITE_FIN_BACKEND=cloudflare` ou `VITE_USE_CLOUDFLARE_PILOT=true` para o piloto conjunto.

## Infraestrutura

- Migration aplicada no D1 dev:
  - `fin-ramos-dev`;
  - `df4271fc-7646-418c-8e71-4503bc89f2d1`.
- Migration aplicada no D1 prod:
  - `fin-ramos-prod`;
  - `e5042bed-6c68-4d0b-92e7-5f838666eb71`.
- Worker dev publicado:
  - `https://fin-ramos-api.patrickramos1-a11y.workers.dev`.
- Versao ativa em 2026-06-28:
  - `3c6a7bb0-fb4d-4623-ad28-14d4256e8b0b`;
  - 100% do trafego do Worker de desenvolvimento.

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
- `PATCH /api/cards/invoices/:id`
  - atualizou a fatura piloto e retornou o valor decimal correto.
- `POST /api/cards/profiles`
  - criou perfil piloto do tipo `EMPRESA` e confirmou persistencia no D1.
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

## O Que Ainda Falta Nesta Rodada

- As telas reais ja podem consumir Cloudflare, mas a flag nao foi ligada por padrao em producao.
- As faturas e classificacoes reais que hoje estao no Supabase ainda nao foram copiadas para o D1.
- Falta o relatorio de paridade que compare contagem, totais e classificacoes entre Supabase e D1 antes da troca definitiva.
- Conversao real de itens de cartao para transacoes financeiras continua bloqueada/simulada ate a Rodada 4.
- Financeiro principal, transacoes, contas, dashboard e aprovacoes seguem no Supabase.
- R2 ainda nao esta sendo usado para armazenar arquivos de fatura/PDF nesta rodada.
- O Worker ainda precisa de autenticacao/autorizacao antes de receber dados reais sensiveis.

## Decisoes Tomadas

- Valores novos de Cartao e Contrato usam `*_cents` em inteiros no D1 para reduzir erro de centavos.
- O Worker e a camada oficial de API; o frontend nao deve falar diretamente com D1.
- O piloto fica paralelo para evitar corte prematuro.
- O aceite digital e operacional com trilha de auditoria, nao assinatura certificada.

## Proximos Passos Recomendados

1. Proteger o Worker com autenticacao e autorizacao por empresa/usuario.
2. Criar exportacao controlada dos dados reais de Cartao e Contratos do Supabase para o D1.
3. Criar relatorio de paridade entre Supabase e D1: registros, totais, status e relacionamentos.
4. Adicionar upload/leitura de arquivos no R2 para faturas e PDFs.
5. Ativar as flags Cloudflare primeiro em homologacao e executar testes ponta a ponta.
6. Somente depois ativar Cloudflare por padrao e iniciar a Rodada 4 do financeiro principal.

## Riscos e Cuidados

- D1 nao substitui Postgres linha por linha; regras que estavam em SQL/Postgres precisam virar codigo no Worker.
- A ponte pronta nao significa que os dados antigos ja foram migrados. Ligar a flag antes da copia e da paridade faria as faturas existentes parecerem vazias.
- O Worker ainda nao tem autenticacao propria; antes de dados reais sensiveis, proteger com sessao propria ou outra camada de identidade adequada ao aplicativo.
- Os dados de smoke test ficaram no D1 dev e estao identificados por `[SMOKE]` ou `codex-smoke-test`.
