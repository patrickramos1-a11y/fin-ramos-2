# Execucao Unificada: Rodadas 3, 4 e 5

Status: em execucao controlada.
Ultima atualizacao: 2026-07-02.

## Objetivo

Executar as Rodadas 3, 4 e 5 do plano de migracao Cloudflare sem fazer corte inseguro.

A regra operacional desta execucao e:

- avancar automaticamente em infraestrutura, scripts, endpoints e relatorios;
- parar antes de qualquer corte financeiro quando faltar paridade;
- documentar toda divergencia em vez de corrigir silenciosamente;
- manter Supabase como origem oficial ate a auditoria final aprovar Cloudflare.

## Fase 0 - Preflight

Status: concluida parcialmente nesta execucao.

Resultados encontrados:

- Ultimo commit base: `999a3ee Conecta modulo Cartao ao piloto Cloudflare`.
- Worktree tinha apenas `tmp/` nao rastreado, provavelmente artefato de Wrangler.
- Rodada 1 esta concluida.
- Rodada 2 esta concluida.
- Rodada 3 esta parcialmente concluida.
- Rodada 4 ainda nao foi iniciada.
- Rodada 5 ainda nao foi iniciada.
- `wrangler.toml` possui Worker, D1 dev/prod e R2 dev/prod.
- O Worker atual possui endpoints para Cartao e Contratos Digitais.
- Ainda existem muitas chamadas diretas a Supabase no financeiro principal.

Conclusao:

Nao e seguro iniciar corte ou migracao do financeiro principal sem antes criar relatorios de paridade e uma camada de importacao controlada.

## Fase 1 - Fechamento da Rodada 3

Status: em andamento.

Implementado nesta execucao:

- Endpoints Cloudflare de resumo/paridade:
  - `GET /api/migration/status`
  - `GET /api/migration/cards/summary`
  - `GET /api/migration/contracts/summary`
- Protecao opcional dos endpoints de auditoria:
  - em desenvolvimento, funcionam sem token;
  - em producao, exigem `MIGRATION_AUDIT_TOKEN`.
- Script local de paridade:
  - `scripts/cloudflare-parity-check.mjs`
  - script package: `migration:parity`

Objetivo do script:

- consultar os resumos do D1 pelo Worker;
- consultar Supabase quando houver credenciais disponiveis;
- comparar totais de Cartao e Contratos Digitais;
- gerar JSON com diferencas;
- impedir avancar em modo `--strict` quando houver divergencia.

Comando previsto:

```bash
npm run migration:parity -- --write tmp/cloudflare-parity-report.json
```

Para ambiente protegido:

```bash
npm run migration:parity -- --token <MIGRATION_AUDIT_TOKEN> --write tmp/cloudflare-parity-report.json
```

## Portao Antes da Rodada 4

Antes de migrar configuracoes, transacoes, contas, aprovacoes e dashboard, precisamos:

- publicar os endpoints de auditoria no Worker;
- rodar `migration:parity`;
- migrar dados reais de Cartao e Contratos para D1;
- validar que Cartao e Contratos batem entre Supabase e Cloudflare;
- decidir a estrategia de autenticacao do Worker para dados reais.

Se a paridade falhar:

- nao iniciar Rodada 4;
- registrar diferencas;
- corrigir importacao/schema;
- repetir auditoria.

## Rodada 4 - Financeiro Principal

Status: bloqueada ate o portao de paridade da Rodada 3 passar.

Motivo:

O financeiro principal ainda usa Supabase diretamente em transacoes, contas, aprovacoes, dashboard, reclassificacao, contratos recorrentes, pagamentos em aberto, transferencias e backlog.

Migrar isso sem relatorio de paridade criaria risco de:

- saldo divergente;
- transacao duplicada;
- pagamento desaparecido;
- transferencia entrando como receita/despesa;
- dashboard incorreto;
- aprovacao pendente incorreta.

## Rodada 5 - Corte Final

Status: bloqueada ate Rodada 4 passar com paridade financeira.

O corte final so deve acontecer depois de:

- backup final Supabase;
- importacao final D1;
- auditoria por competencia;
- auditoria por caixa;
- auditoria de saldos por conta;
- auditoria de aprovacoes;
- validacao funcional em producao/homologacao.

## Proxima Acao Recomendada

1. Validar build.
2. Validar dry-run do Worker.
3. Publicar Worker com endpoints de auditoria.
4. Rodar smoke test dos endpoints `/api/migration/*`.
5. Rodar `migration:parity`.
6. Se Supabase nao estiver acessivel por credencial local, solicitar/exportar credencial adequada ou gerar export manual.
## Resultado da Auditoria Inicial - 2026-07-01

O script `migration:parity` conseguiu ler o Supabase e encontrou:

- Faturas de cartao no Supabase: 3.
- Itens de cartao no Supabase: 716.
- Total das faturas/itens: R$ 87.317,47.
- Itens marcados como empresa: 70.
- Itens marcados como pessoal: 185.
- Itens em duvida: 461.
- Itens prontos para converter: 14.
- Itens empresa sem categoria: 40.
- Perfis de cartao: 2.
- Regras de estabelecimento: 15.
- Categorias pessoais: 8.
- Contratos digitais no Supabase: 0 documentos e 0 modelos no schema atual.

Bloqueio encontrado:

- O codigo local do Worker ja possui `/api/migration/status`, `/api/migration/cards/summary` e `/api/migration/contracts/summary`.
- `bun run build` passou.
- `wrangler deploy --dry-run` passou.
- Porem a URL publica `https://fin-ramos-api.patrickramos1-a11y.workers.dev` ainda responde 404 para `/api/migration/*`, indicando que a nova versao nao foi ativada/publicada na rota publica.
- Tentativas com `wrangler deploy`, `wrangler versions upload` e `wrangler versions deploy` nao retornaram erro, mas tambem nao ativaram as rotas novas.

Decisao de seguranca:

- Nao avancar para Rodada 4 enquanto os endpoints Cloudflare de auditoria nao estiverem publicamente acessiveis ou enquanto nao houver outro mecanismo confiavel de resumo D1.
- Nao executar corte, congelamento ou troca de flags de producao.

Proxima acao tecnica:

1. Resolver a ativacao do Worker ou criar fallback de auditoria direta via D1.
2. Migrar/importar os 3 registros de fatura, 716 itens, 2 perfis, 15 regras e 8 categorias pessoais para o D1.
3. Rodar novamente `migration:parity` ate comparar Supabase x Cloudflare com sucesso.
4. So entao iniciar Rodada 4A.
## Revalidacao - 2026-07-02

Comandos executados:

- `bun run build`: passou.
- `bun run migration:parity -- --write tmp\cloudflare-parity-report.json`: executou e gerou relatorio.

Resultado:

- Supabase continua acessivel e retornando os totais do modulo Cartao e Contratos.
- Cloudflare publico continua retornando 404 para `/api/migration/cards/summary` e `/api/migration/contracts/summary`.
- O portao da Rodada 3 permanece bloqueado ate a publicacao/ativacao do Worker ou ate criarmos uma auditoria D1 direta confiavel.

Decisao:

- Nao iniciar Rodada 4A ainda.
- Proximo trabalho recomendado: resolver a publicacao do Worker ou implementar fallback de auditoria direta via D1, depois importar Cartao/Contratos para D1 e repetir paridade.

