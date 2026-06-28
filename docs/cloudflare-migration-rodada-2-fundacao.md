# Rodada 2: Fundacao Cloudflare Paralela

Status: concluida em 2026-06-26.

## Objetivo

Criar uma base Cloudflare paralela sem desligar Supabase, sem alterar telas financeiras e sem migrar dados reais ainda.

## O que foi criado

- `wrangler.toml` com configuracao para Worker, D1 e R2.
- `cloudflare/worker.ts` com endpoints basicos:
  - `GET /api/health`
  - `GET /api/version`
  - `GET /api/db-check`
- `cloudflare/migrations/0001_foundation.sql` com tabela tecnica `cf_meta`.
- `src/lib/apiClient.ts` como cliente HTTP para futuras chamadas `/api/*`.
- Scripts no `package.json` para dev, deploy e migrations D1.
- `wrangler` instalado como dependencia de desenvolvimento.

## Recursos Cloudflare criados

- D1 dev: `fin-ramos-dev`
  - ID: `df4271fc-7646-418c-8e71-4503bc89f2d1`
- D1 prod: `fin-ramos-prod`
  - ID: `e5042bed-6c68-4d0b-92e7-5f838666eb71`
- R2 dev: `fin-ramos-files-dev`
- R2 prod: `fin-ramos-files-prod`

## Worker publicado

URL de desenvolvimento:

- `https://fin-ramos-api.patrickramos1-a11y.workers.dev`

Worker de producao:

- Script publicado: `fin-ramos-api-production`
- Observacao: a URL `workers.dev` de producao retornou erro 1042; antes de uso real, configurar rota/dominio de producao.

Endpoints validados:

- `GET /api/health`
- `GET /api/version`
- `GET /api/db-check`

## Validacoes realizadas

- `bun run build` passou.
- `wrangler deploy --dry-run` validou os bindings D1/R2.
- `wrangler deploy` publicou `fin-ramos-api`.
- `wrangler deploy --env production` publicou `fin-ramos-api-production`.
- D1 dev recebeu `schema_version = 0001_foundation`.
- D1 prod recebeu `schema_version = 0001_foundation`.
- `/api/db-check` respondeu usando o D1 real de desenvolvimento.

## O que ainda nao foi feito

- Alterar telas do app para consumir `/api`.
- Migrar qualquer modulo financeiro.
- Configurar dominio proprio ou rota customizada.
- Expor/testar publicamente o ambiente de producao por rota valida.
- Criar rotina automatizada de deploy CI/CD.

## Comandos previstos

```bash
bun run cloudflare:dev
bun run d1:migrate:local
bun run cloudflare:deploy
bun run d1:migrate:prod
bun run cloudflare:deploy:prod
```

## Criterios de aceite desta rodada

- Worker responde `/api/health`.
- Worker responde `/api/version`.
- Worker responde `/api/db-check`.
- D1 dev e prod existem.
- R2 dev e prod existem.
- Supabase continua sendo a fonte oficial do sistema atual.

## Proximo passo recomendado

Iniciar Rodada 3, migrando primeiro Cartao e Contratos Digitais para D1/R2 por API Cloudflare, mantendo o financeiro principal no Supabase.
