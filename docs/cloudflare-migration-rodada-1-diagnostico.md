# Rodada 1: Diagnostico da Migracao Cloudflare

Status: diagnostico inicial concluido em 2026-06-26.

## Objetivo desta rodada

Mapear como o sistema financeiro depende hoje do Supabase/Lovable antes de criar a infraestrutura Cloudflare. Esta rodada nao altera o app, nao cria D1 e nao faz corte de banco. Ela cria a referencia tecnica para executar as proximas fases com seguranca.

## Resumo executivo

O sistema ainda usa Supabase como camada direta de dados no frontend. A entrada principal esta em `src/integrations/supabase/client.ts`, usando `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `@supabase/supabase-js`.

Isso significa que a migracao para Cloudflare nao deve comecar trocando tabelas diretamente. A ordem correta e criar uma API Worker paralela, manter Supabase como fonte atual e migrar modulo por modulo para D1/R2 com comparativos.

O maior risco esta em transacoes, contas, saldos, dashboard, aprovacoes e recorrencias. Cartao e contratos digitais sao os melhores pilotos porque sao modulos novos, mais isolados e com menos impacto imediato sobre caixa.

## Arquitetura atual encontrada

- Frontend React/Vite com shadcn/Radix/Tailwind.
- Dependencia direta de `@supabase/supabase-js`.
- Supabase Auth usado em `src/hooks/useAuth.tsx`.
- Supabase Storage usado no backlog para anexos.
- Supabase Edge Function encontrada em `supabase/functions/create-initial-users/index.ts`.
- Migrations Postgres em `supabase/migrations`.
- Regras de negocio importantes vivem em uma mistura de frontend, triggers, RPCs e funcoes Postgres.

## Entrada Supabase no frontend

Arquivo central:

- `src/integrations/supabase/client.ts`

Configuracao:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- Sessao persistida em `localStorage`

Na arquitetura Cloudflare, esse arquivo deve deixar de ser usado pelos modulos migrados. O frontend deve passar a consumir uma camada `apiClient` com endpoints em `/api/*`.

## Dependencias por modulo

### Autenticacao e permissoes

Arquivos principais:

- `src/hooks/useAuth.tsx`
- `src/hooks/usePermissions.ts`
- `src/components/settings/UserPermissionsView.tsx`

Tabelas e recursos:

- `profiles`
- `user_roles`
- `user_module_permissions`
- Supabase Auth

Destino Cloudflare:

- Curto prazo: Cloudflare Access para proteger ambiente interno.
- Medio prazo: Worker com sessoes/JWT, usuarios, papeis e permissoes no D1.

### Configuracao financeira

Arquivos principais:

- `src/hooks/useFinancialConfig.ts`
- `src/hooks/useFiscalConfig.ts`
- `src/hooks/useFinancialEntities.ts`

Tabelas:

- `financial_companies`
- `account_categories`
- `accounts`
- `cost_centers`
- `transaction_categories`
- `payment_methods`
- `financial_entities`
- `fiscal_config`
- `minimum_wage_config`

Risco: medio. Essas tabelas alimentam quase todos os formularios, mas sao menos perigosas que movimentacoes financeiras executadas.

### Transacoes e lancamentos

Arquivos principais:

- `src/hooks/useTransactions.ts`
- `src/components/transactions/*`
- `src/lib/financial/aggregates.ts`
- `src/hooks/useOpenPayments.ts`
- `src/hooks/useFixedExpenses.ts`
- `src/hooks/useSmartImport.ts`

Tabelas e RPCs:

- `transactions`
- `fixed_expenses`
- `transaction_history`
- `transaction_entities`
- `rejected_transactions`
- `recurring_installments`
- `archive_and_delete_rejected`
- `recalculate_account_balance`

Risco: alto. Este modulo define resultado financeiro, aprovacoes, status, competencia, caixa e historico.

Regra de migracao:

- Nao migrar antes de ter relatorio de paridade por competencia, caixa, status e conta.

### Contas, saldos e transferencias

Arquivos principais:

- `src/hooks/useAccountDetail.ts`
- `src/hooks/useAccountsSnapshot.ts`
- `src/hooks/useAccountsEvolution.ts`
- `src/hooks/useAccountAnnual.ts`
- `src/hooks/useAccountForecast.ts`
- `src/hooks/usePlannedTransfers.ts`
- `src/hooks/useConvertToTransfer.ts`
- `src/components/accounts/*`

Tabelas e RPCs:

- `accounts`
- `account_transfers`
- `planned_transfers`
- `planned_transfer_occurrences`
- `execute_planned_occurrence`
- `recalculate_account_balance`

Risco: alto. Aqui existem regras sensiveis de saldo bancario, movimento por competencia, transferencia recebida/enviada e saldo previsto.

Regra de migracao:

- Manter separada a leitura de competencia da leitura de caixa.
- Transferencias nao podem contaminar receita, despesa ou DRE.

### Dashboard, relatorios e DRE

Arquivos principais:

- `src/components/dashboard/*`
- `src/hooks/useDashboardYTD.ts`
- `src/hooks/useDREReport.ts`
- `src/hooks/useAnnualBreakdown.ts`
- `src/hooks/useProjections.ts`
- `src/components/reports/ReportsView.tsx`

Tabelas:

- `transactions`
- `transaction_categories`
- `accounts`
- `recurring_clients`
- `recurring_contracts`
- `minimum_wage_config`
- `cost_centers`

Risco: alto. O dashboard deve ser migrado depois das regras oficiais de transacoes e contas.

### Aprovacoes e reclassificacao

Arquivos principais:

- `src/components/approval/ApprovalView.tsx`
- `src/components/reclassification/ReclassificationView.tsx`
- `src/components/transactions/BulkEditPanel.tsx`

Tabelas e RPCs:

- `transactions`
- `rejected_transactions`
- `transaction_history`
- `transaction_categories`
- `accounts`
- `cost_centers`
- `recurring_clients`
- `financial_entities`
- `archive_and_delete_rejected`

Risco: alto. Aprovacoes alteram fluxo financeiro e precisam preservar historico.

### Contratos financeiros recorrentes

Arquivos principais:

- `src/hooks/useRecurringContracts.ts`
- `src/components/contracts/NewRecurringContractModal.tsx`
- `src/components/clients/ClientsView.tsx`

Tabelas:

- `contract_plans`
- `recurring_clients`
- `recurring_contracts`
- `recurring_installments`
- `minimum_wage_config`
- `transactions`

Risco: alto quando gera transacoes. Medio quando apenas gerencia clientes e planos.

### Cartao

Arquivo principal:

- `src/hooks/useCreditCardInvoices.ts`
- `src/components/cards/CreditCardInvoicesView.tsx`

Tabelas:

- `credit_card_invoices`
- `credit_card_invoice_items`
- `credit_card_profiles`
- `credit_card_merchant_rules`
- `credit_card_personal_categories`
- `transactions`
- `transaction_history`
- `recurring_clients`

Risco: baixo a medio. E o melhor piloto para D1, desde que a conversao para transacoes continue bloqueada, simulada ou auditada ate o financeiro principal migrar.

### Contratos digitais

Arquivo principal:

- `src/hooks/useDigitalContracts.ts`

Tabelas:

- `contract_templates`
- `contract_clauses`
- `contract_documents`
- `contract_document_clauses`
- `contract_acceptance_links`
- `contract_acceptance_events`

Risco: baixo a medio. Bom piloto junto com Cartao, principalmente porque precisa de D1 para dados e R2 para documentos/PDFs.

### Backlog e anexos

Arquivo principal:

- `src/hooks/useBacklog.ts`

Tabelas e Storage:

- `backlog_projects`
- `backlog_modules`
- `backlog_items`
- `backlog_item_modules`
- `backlog_attachments`
- `backlog_validations`
- `backlog_implementation_records`
- `backlog_history`
- bucket `backlog-attachments`

Destino Cloudflare:

- D1 para metadados.
- R2 para anexos.

## Recursos Postgres que precisam ser redesenhados

D1 usa SQLite e nao suporta copiar diretamente todos os recursos Postgres usados hoje. Estes itens precisam virar schema D1, codigo Worker ou auditorias:

- Enums Postgres devem virar `TEXT CHECK (...)` ou constantes no codigo.
- RPCs devem virar endpoints ou services no Worker.
- Triggers de saldo e sincronizacao devem virar transacoes atomicas no Worker.
- RLS/policies devem virar middleware de autorizacao no Worker.
- Supabase Storage deve virar R2.
- Edge Functions devem virar Worker routes ou scripts administrativos.

RPCs/funcoes sensiveis identificadas:

- `recalculate_account_balance`
- `archive_and_delete_rejected`
- `execute_planned_occurrence`
- `bulk_quitar_periodo`
- `sync_installment_to_transaction`
- `sync_transaction_to_installment`
- `generate_planned_transfer_occurrences`
- funcoes de historico do backlog

## Matriz Supabase para Cloudflare

| Area atual | Supabase hoje | Cloudflare alvo | Observacao |
| --- | --- | --- | --- |
| Banco relacional | Postgres | D1 | Adaptar schema para SQLite |
| Consultas diretas | `supabase.from` no frontend | Worker API | Frontend nao deve falar direto com D1 |
| RPCs | Postgres functions | Worker services/endpoints | Regras ficam versionadas no codigo |
| Triggers | Postgres triggers | Worker transactions + jobs | Evitar magica invisivel no banco |
| Auth | Supabase Auth | Cloudflare Access primeiro | Depois auth propria, se necessario |
| RLS | Supabase policies | Middleware Worker | Validar usuario, papel e modulo |
| Storage | Supabase Storage | R2 | Anexos, faturas, contratos, PDFs |
| Edge Functions | Supabase Functions | Cloudflare Workers | `create-initial-users` vira rota/script admin |

## Classificacao de risco

Baixo risco:

- Contratos digitais sem PDF juridico avancado.
- Cartao enquanto conferencia/classificacao.
- Categorias pessoais do cartao.
- Regras por estabelecimento.

Medio risco:

- Clientes.
- Entidades.
- Categorias.
- Centros de custo.
- Contas como cadastro.
- Permissoes por modulo.
- Backlog e anexos.

Alto risco:

- Transacoes.
- Despesas fixas.
- Contratos recorrentes que geram parcelas/transacoes.
- Aprovacoes.
- Reclassificacao.
- Saldos de conta.
- Transferencias.
- Dashboard.
- DRE e relatorios financeiros.

## Ordem recomendada de migracao

1. Rodada 2: criar fundacao Cloudflare paralela, sem mudar telas existentes.
2. Rodada 3A: migrar Cartao para D1/R2, mantendo conversao financeira bloqueada ou auditada.
3. Rodada 3B: migrar Contratos Digitais para D1/R2.
4. Rodada 4A: migrar cadastros/configuracoes financeiras.
5. Rodada 4B: migrar transacoes em modo sombra, comparando com Supabase.
6. Rodada 4C: migrar aprovacoes, reclassificacao e aberto.
7. Rodada 4D: migrar contas, saldos, transferencias e dashboard.
8. Rodada 5: corte final com congelamento de escrita, importacao final e rollback documentado.

## Decisoes antes da Rodada 2

- Confirmar se o frontend sera publicado em Cloudflare Pages ou Workers Static Assets.
- Confirmar nomes de ambientes: `local`, `staging` e `production`.
- Confirmar nomes de D1: sugestao `fin-ramos-dev` e `fin-ramos-prod`.
- Confirmar nomes de R2: sugestao `fin-ramos-files-dev` e `fin-ramos-files-prod`.
- Confirmar autenticacao inicial: recomendacao `Cloudflare Access` para reduzir risco.
- Confirmar se o Supabase continua como fonte oficial ate Rodada 5: recomendacao sim.

## Criterios de aceite desta rodada

- O ponto central de dependencia Supabase foi identificado.
- Os modulos foram classificados por risco.
- As principais tabelas e recursos foram agrupados por dominio.
- Os recursos Postgres que precisam virar codigo Worker foram identificados.
- A ordem de migracao foi definida.
- O plano mestre foi atualizado com referencia a este diagnostico.

## Proximo prompt sugerido

```text
Execute a Rodada 2 usando docs/cloudflare-migration-plan.md e docs/cloudflare-migration-rodada-1-diagnostico.md como referencia. Crie a fundacao Cloudflare paralela com Worker, D1, R2, wrangler, scripts e endpoints health/version/db-check, sem desligar Supabase e sem migrar modulos financeiros ainda.
```
