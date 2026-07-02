# Plano Mestre: Migracao do Lovable/Supabase para Codex + Cloudflare

## Objetivo

Migrar o sistema financeiro para uma arquitetura em que o desenvolvimento, banco de dados, APIs, deploys e evolucoes passem a ser operados diretamente pelo Codex, sem depender do fluxo do Lovable para aplicar SQL, publicar alteracoes ou liberar estrutura de banco.

O alvo operacional e usar Cloudflare como infraestrutura principal:

- Cloudflare Workers para APIs e regras de negocio.
- Cloudflare D1 para banco SQL relacional.
- Cloudflare R2 para arquivos, anexos, faturas, contratos e PDFs.
- Cloudflare Pages ou Workers Static Assets para hospedagem do frontend.
- Wrangler e/ou Cloudflare MCP para migrations, deploys e operacao.

> Observacao importante: Codex nao e o banco de dados. Codex opera o codigo, as migrations e a infraestrutura conectada. A autonomia vem de termos o projeto, o banco e o deploy em ferramentas que o Codex consegue editar e acionar diretamente.

## Estado Atual do Projeto

- Frontend React/Vite.
- UI com shadcn/Radix/Tailwind.
- Dados acessados majoritariamente direto do frontend via `@supabase/supabase-js`.
- Banco atual em Supabase/Postgres, com migrations em `supabase/migrations`.
- Deploy atual ja passou por Vercel/Lovable em diferentes momentos.
- Modulos financeiros sensiveis: transacoes, contas, saldos, aprovacoes, dashboard, contratos, cartao, clientes e configuracoes.

## Principios da Migracao

- Nao desligar Supabase antes de ter paridade comprovada.
- Nao migrar o financeiro principal sem auditoria de valores.
- Evitar que o frontend fale direto com o banco novo.
- Centralizar regras de negocio em Workers.
- Migrar em paralelo, por rodadas.
- Comecar por modulos menos arriscados antes do caixa/transacoes.
- Validar sempre com build, consultas de contagem e comparativos financeiros.
- Manter Supabase como fonte historica/backup ate o corte final ser seguro.

## Arquitetura-Alvo

### Frontend

- React/Vite hospedado em Cloudflare Pages ou Workers Static Assets.
- Frontend consome uma API propria em `/api`.
- Gradualmente remove chamadas diretas a `supabase.from(...)`.

### API

- Cloudflare Worker como camada unica de acesso aos dados.
- Endpoints por dominio:
  - `/api/health`
  - `/api/version`
  - `/api/db-check`
  - `/api/cards/*`
  - `/api/contracts/*`
  - `/api/config/*`
  - `/api/transactions/*`
  - `/api/accounts/*`
  - `/api/approvals/*`
  - `/api/dashboard/*`

### Banco

- Cloudflare D1 como banco SQL.
- D1 usa SQLite, portanto nao e uma copia direta do Postgres.
- Migrations D1 devem adaptar tipos, constraints, enums e funcoes.
- IDs devem permanecer como texto/UUID para facilitar migracao.
- Valores financeiros devem ser padronizados, preferencialmente em centavos inteiros nas novas estruturas.

### Arquivos

- Cloudflare R2 para:
  - faturas importadas;
  - anexos;
  - PDFs de contratos;
  - documentos gerados;
  - exportacoes futuras.

### Autenticacao

Opcao inicial recomendada:

- Cloudflare Access para proteger o app interno durante a transicao.

Opcao evolutiva:

- Autenticacao propria via Worker com sessao/JWT, usuarios, papeis e permissoes no D1.

## Rodada 1: Diagnostico e Arquitetura-Alvo

### Objetivo

Criar o mapa completo da migracao antes de escrever a infraestrutura nova. Esta rodada responde: o que existe hoje, o que depende do Supabase, o que e critico e qual sera a ordem segura de migracao.

### Tarefas

- Mapear todas as chamadas `supabase.from(...)`, `supabase.rpc(...)`, `supabase.auth` e `supabase.storage`.
- Listar todas as tabelas usadas pelo frontend.
- Listar migrations existentes e separar por modulo.
- Identificar Edge Functions Supabase em uso.
- Identificar Storage/Buckets atuais.
- Identificar regras de RLS, policies, triggers, views e funcoes Postgres.
- Separar modulos por risco:
  - baixo risco: cartao, contratos digitais, configuracoes auxiliares;
  - medio risco: clientes, entidades, categorias, centros de custo;
  - alto risco: transacoes, contas, saldos, dashboard, aprovacoes.
- Definir ordem oficial de migracao.
- Gerar matriz Supabase -> Cloudflare.

### Entregaveis

- Documento de inventario tecnico.
- Tabela de dependencias por modulo.
- Lista de riscos.
- Ordem recomendada de migracao.
- Decisao de autenticacao inicial.

### Criterios de aceite

- Sabemos quais arquivos ainda falam com Supabase.
- Sabemos quais tabelas precisam ir para D1.
- Sabemos quais recursos precisam ir para R2.
- Sabemos quais regras Postgres precisam virar codigo no Worker.
- Nenhum modulo financeiro central sera migrado sem plano de paridade.

### Prompt para iniciar esta rodada

```text
Execute a Rodada 1 do plano em docs/cloudflare-migration-plan.md. Faca o diagnostico completo do uso atual de Supabase, tabelas, migrations, Edge Functions, Storage, modulos de risco e ordem recomendada de migracao. Nao implemente a migracao ainda; gere o inventario tecnico e atualize o documento com o status da rodada.
```

## Rodada 2: Fundacao Cloudflare Paralela

### Objetivo

Criar uma fundacao Cloudflare funcional sem desligar nada do sistema atual. Ao final, teremos Worker, D1, scripts e endpoints basicos testaveis.

### Tarefas

- Adicionar configuracao Cloudflare:
  - `wrangler.toml`;
  - bindings D1;
  - bindings R2;
  - ambiente local/dev/prod.
- Criar estrutura da API Worker.
- Criar estrutura de migrations D1.
- Criar scripts no `package.json`, por exemplo:
  - `cloudflare:dev`;
  - `cloudflare:deploy`;
  - `d1:migrate:local`;
  - `d1:migrate:prod`;
  - `d1:seed`.
- Criar endpoints:
  - `GET /api/health`;
  - `GET /api/version`;
  - `GET /api/db-check`.
- Criar camada `apiClient` no frontend.
- Manter Supabase como fonte principal enquanto a API nova e testada.

### Entregaveis

- Worker Cloudflare rodando localmente.
- D1 conectado por binding.
- R2 configurado por binding.
- Endpoints basicos funcionando.
- Build do app funcionando.

### Criterios de aceite

- `GET /api/health` responde localmente.
- `GET /api/db-check` consulta D1 com sucesso.
- `bun run build` ou `npm run build` passa.
- Nenhuma tela existente deixa de funcionar.

### Prompt para iniciar esta rodada

```text
Execute a Rodada 2 do plano em docs/cloudflare-migration-plan.md. Crie a fundacao Cloudflare paralela com Worker, D1, R2, wrangler, scripts e endpoints health/version/db-check, sem desligar Supabase e sem migrar modulos financeiros ainda.
```

## Rodada 3: Piloto com Cartao e Contratos Digitais

### Objetivo

Migrar primeiro os modulos menos arriscados e mais novos: Cartao e Contratos Digitais. Eles ajudam a validar D1, R2 e Workers sem mexer diretamente no caixa principal.

### Modulo Cartao

Migrar para D1:

- faturas salvas;
- itens da fatura;
- perfis de cartao;
- categorias pessoais;
- regras por estabelecimento;
- status de conversao;
- controle de reembolso.

Criar endpoints:

- `GET /api/cards/invoices`;
- `POST /api/cards/invoices`;
- `GET /api/cards/invoices/:id/items`;
- `PATCH /api/cards/items/bulk`;
- `POST /api/cards/merchant-rules`;
- `POST /api/cards/personal-categories`;
- `POST /api/cards/preview-transactions`.

### Modulo Contratos Digitais

Migrar para D1:

- modelos de contrato;
- clausulas;
- contratos gerados;
- clausulas congeladas;
- links de aceite;
- eventos de aceite.

Usar R2 para:

- PDFs;
- anexos;
- documentos gerados.

Criar endpoints:

- `GET /api/contracts/templates`;
- `POST /api/contracts/documents`;
- `PATCH /api/contracts/documents/:id`;
- `POST /api/contracts/documents/:id/acceptance-link`;
- `GET /api/public/contracts/accept/:token`;
- `POST /api/public/contracts/accept/:token`.

### Entregaveis

- Cartao lendo/escrevendo em Cloudflare.
- Contratos Digitais lendo/escrevendo em Cloudflare.
- Supabase ainda ativo para financeiro principal.
- Conversao de cartao para transacao pode ficar bloqueada ou simulada ate Rodada 4.

### Criterios de aceite

- Salvar fatura no D1.
- Classificar item do cartao no D1.
- Salvar regra por estabelecimento no D1.
- Criar categoria pessoal no D1.
- Criar contrato digital no D1.
- Gerar link de aceite.
- Registrar evento de aceite.
- Build passa.

### Prompt para iniciar esta rodada

```text
Execute a Rodada 3 do plano em docs/cloudflare-migration-plan.md. Migre os modulos Cartao e Contratos Digitais para Cloudflare Workers + D1 + R2, mantendo o financeiro principal no Supabase. A conversao para transacoes pode ficar bloqueada ou simulada ate a Rodada 4.
```

## Rodada 4: Migracao do Financeiro Principal

### Objetivo

Migrar os modulos centrais do sistema financeiro com controle de paridade. Esta e a rodada mais sensivel.

### Ordem Recomendada

1. Configuracoes financeiras:
   - empresas;
   - contas;
   - agrupadores;
   - categorias;
   - centros de custo;
   - metodos de pagamento;
   - clientes;
   - entidades.
2. Transacoes:
   - lancamentos;
   - edicao;
   - historico;
   - status;
   - competencia;
   - pagamento.
3. Aprovacoes:
   - pendentes;
   - aprovadas;
   - rejeitadas;
   - edicao em massa.
4. Contas e saldos:
   - movimentos por competencia;
   - saldo bancario/caixa;
   - transferencias;
   - saldo previsto.
5. Dashboard e relatorios:
   - receitas;
   - despesas;
   - resultado;
   - aberto;
   - DRE;
   - analises anuais/mensais.

### Regras Criticas

- Movimento por competencia e saldo de caixa nao podem ser misturados.
- Transferencia nao pode contaminar receita, despesa ou DRE.
- Valores precisam bater com o sistema atual antes do corte.
- Qualquer divergencia deve gerar relatorio, nao ser corrigida silenciosamente.

### Entregaveis

- APIs por dominio financeiro.
- D1 com dados principais migrados.
- Frontend usando API Cloudflare nos modulos migrados.
- Relatorios de paridade.

### Criterios de aceite

- Total de transacoes por mes bate com Supabase.
- Total de entradas por mes bate.
- Total de saidas por mes bate.
- Saldos por conta batem conforme regra definida.
- Aprovacoes mostram os mesmos pendentes.
- Dashboard apresenta os mesmos totais para periodos auditados.
- Build passa.

### Prompt para iniciar esta rodada

```text
Execute a Rodada 4 do plano em docs/cloudflare-migration-plan.md. Migre o financeiro principal em ordem controlada, criando APIs Cloudflare e D1 para configuracoes, transacoes, contas, aprovacoes e dashboard. Antes de desligar qualquer coisa, gere relatorios de paridade com Supabase.
```

## Rodada 5: Corte Final, Backup e Operacao

### Objetivo

Encerrar a dependencia operacional do Lovable/Supabase, mantendo backup e rollback planejados.

### Tarefas

- Congelar escrita no Supabase.
- Exportar dados finais.
- Importar dados finais para D1.
- Rodar auditoria final:
  - contagem de registros por tabela;
  - totais por competencia;
  - totais por caixa;
  - saldos por conta;
  - transacoes por status;
  - contratos;
  - faturas;
  - aprovacoes.
- Trocar variaveis de producao para API Cloudflare.
- Publicar frontend em Cloudflare ou manter temporariamente Vercel apontando para API Cloudflare.
- Documentar rollback.
- Manter Supabase como backup historico por periodo definido.

### Entregaveis

- Sistema em producao usando Cloudflare.
- Supabase fora do caminho operacional principal.
- Backup final salvo.
- Documento de operacao.

### Criterios de aceite

- Usuario consegue logar/acessar o sistema.
- Dashboard carrega.
- Transacoes carregam e podem ser criadas/editadas.
- Contas e saldos carregam corretamente.
- Cartao funciona.
- Contratos funcionam.
- Aprovacoes funcionam.
- Nenhuma chamada critica depende de Lovable/Supabase.

### Prompt para iniciar esta rodada

```text
Execute a Rodada 5 do plano em docs/cloudflare-migration-plan.md. Faca o corte final para Cloudflare, com congelamento de escrita no Supabase, exportacao/importacao final, auditoria de paridade, troca de producao, plano de rollback e documentacao operacional.
```

## Checklist Geral de Progresso

Use este checklist como marcador de andamento.

- [x] Rodada 1 concluida: diagnostico e arquitetura-alvo.
- [x] Rodada 2 concluida: fundacao Cloudflare paralela.
- [ ] Rodada 3 concluida: piloto Cartao e Contratos Digitais. Base tecnica criada; auditoria/paridade local criada; falta ativar Worker publico, importar dados reais para D1 e validar paridade.
- [ ] Rodada 4 concluida: financeiro principal migrado e auditado.
- [ ] Rodada 5 concluida: corte final e operacao Cloudflare.

## Registro de Status

Atualize esta secao ao fim de cada rodada.

| Rodada | Status | Data | Observacoes |
| --- | --- | --- | --- |
| 1 | Diagnostico inicial concluido | 2026-06-26 | Ver `docs/cloudflare-migration-rodada-1-diagnostico.md`. Nenhuma migracao executada ainda. |
| 2 | Concluida | 2026-06-26 | D1/R2 criados, migration inicial aplicada, Worker dev publicado e endpoints basicos validados. Worker prod criado; falta rota/dominio para acesso publico. Ver `docs/cloudflare-migration-rodada-2-fundacao.md`. |
| 3 | Em andamento / bloqueada no portao de paridade | 2026-07-01 | Endpoints de auditoria e script `migration:parity` criados. Supabase respondeu com 3 faturas, 716 itens, 2 perfis, 15 regras e 8 categorias pessoais. Build e dry-run do Worker passaram, mas a URL publica ainda retorna 404 para `/api/migration/*`; antes da Rodada 4 falta ativar/publicar Worker, importar dados reais para D1 e comprovar paridade. Ver `docs/cloudflare-migration-execucao-unificada.md`. |
| 4 | Nao iniciada | - | - |
| 5 | Nao iniciada | - | - |

## Como Usar Este Documento nas Proximas Conversas

Voce pode pedir ao Codex:

- "Leia `docs/cloudflare-migration-plan.md` e execute a Rodada 1."
- "O que falta para concluir a Rodada 1?"
- "Atualize o status da Rodada 2."
- "Compare o que ja foi feito com o checklist do plano Cloudflare."
- "Gere o relatorio de paridade da Rodada 4."
- "Prepare a Rodada 5, mas nao execute o corte ainda."

## Notas de Cuidado

- Esta migracao e estrutural e deve ser tratada como projeto de infraestrutura.
- A maior dificuldade nao e criar tabelas, e preservar regras financeiras.
- D1 nao tem todos os recursos do Postgres; triggers, enums, funcoes e RLS precisam ser redesenhados.
- O sistema nao deve perder a distincao entre competencia e caixa.
- O corte final so deve acontecer quando os relatorios de paridade estiverem confiaveis.