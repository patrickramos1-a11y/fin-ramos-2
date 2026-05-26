# Lancamento Inteligente

## Objetivo

Consolidar os fluxos de criacao, edicao, pagamento, aprovacao e reclassificacao em uma experiencia unica de lancamento financeiro.

Hoje o sistema ainda funciona como um roteador: a categoria escolhida encaminha o usuario para modais diferentes, como entrada avulsa, despesa fixa, despesa variavel ou contrato recorrente. Isso cria regras duplicadas, botoes diferentes e comportamentos inconsistentes.

O novo modelo deve usar uma unica superficie de trabalho, com a categoria como ponto de partida e as demais regras sendo herdadas automaticamente.

## Principios

- Categoria primeiro: categoria define tipo, conta padrao, centro de custo, natureza e impacto financeiro.
- Uma tela, varios modos: criar, editar, duplicar, pagar, reabrir, aprovar e reclassificar usam o mesmo formulario.
- Valor sempre monetario: todos os campos de valor usam entrada em reais com digitacao por centavos.
- Recorrencia e forma de pagamento sao configuracoes do lancamento, nao paginas diferentes.
- Transferencia nao e receita nem despesa: movimenta saldo entre contas sem contaminar DRE.
- Regras em camada unica: validacao e persistencia ficam em servicos/hooks compartilhados, nao espalhadas pelos componentes.

## Fluxos atuais a substituir

- `NewTransactionWizard`: escolhe categoria e redireciona para modais diferentes.
- `QuickTransactionModal`: cria entradas/saidas avulsas.
- `NewFixedExpenseModal`: cria despesa fixa e gera competencias.
- `NewRecurringContractModal`: cria contrato recorrente.
- `TransactionEditModal`: edita lancamento e propaga alteracoes recorrentes.
- `EditRecurringValueModal`: altera valores recorrentes por escopo.
- `OpenPaymentsView`: paga lancamentos em aberto.
- `ApprovalView`: aprova/rejeita lancamentos.
- `ReclassificationView`: corrige classificacao.
- `BulkEditPanel`: edita campos em massa.
- `TransferModal`, `PlannedTransferModal` e `ConvertToTransferModal`: fluxos especificos de transferencia.

## Modelo de experiencia

### 1. Tipo financeiro

Escolhas:

- Entrada
- Despesa
- Transferencia
- Ajuste
- Planejado

Esse campo pode ser sugerido pela categoria, mas deve poder ser explicitado quando necessario.

### 2. Categoria

Campo principal do fluxo.

Ao selecionar a categoria, o sistema resolve:

- conta padrao;
- centro de custo;
- tipo de movimento;
- subtipo operacional;
- se entra na DRE;
- se exige entidade;
- se exige cliente;
- se exige responsavel;
- documento esperado.

Conta e centro de custo deixam de ser escolhas principais do usuario. Eles aparecem como informacao herdada, com opcao de override apenas para perfil autorizado ou excecao controlada.

### 3. Envolvidos

Campos:

- descricao;
- cliente;
- entidade;
- responsavel;
- observacao;
- documento fiscal ou comprovante.

### 4. Valor e datas

Campos:

- valor;
- competencia;
- vencimento;
- status;
- data de pagamento;
- valor pago.

Regra: valor sempre usa componente monetario padronizado.

### 5. Comportamento do lancamento

Escolhas:

- pontual;
- recorrente sem data final;
- recorrente ate uma data;
- repetir quantidade definida de vezes;
- parcelado;
- contrato;
- transferencia planejada;
- ja pago no cadastro.

Essa etapa substitui as antigas paginas separadas de fixa, variavel, avulsa e contrato.

### 6. Revisao

Antes de salvar, o sistema mostra o resumo operacional:

- o que sera criado;
- quais competencias serao geradas;
- conta e centro de custo herdados;
- impacto no saldo;
- impacto ou nao na DRE;
- se exige aprovacao.

## Escopos de edicao

Toda edicao recorrente deve perguntar o escopo:

- somente este lancamento;
- este e os proximos;
- todos os lancamentos da serie;
- encerrar a serie a partir daqui.

Esse mesmo padrao tambem deve valer para exclusao, pagamento e reclassificacao quando o lancamento vier de uma serie.

## Fases de implementacao

### Fase 1 - Estabilizar regras atuais

- Corrigir geracao indevida de despesas fixas.
- Diferenciar exclusao de parcela, encerramento futuro e desativacao da despesa-mae.
- Padronizar campos monetarios.

Status: iniciado.

### Fase 2 - Criar camada de comando unica

Criar uma camada central para operacoes de transacao:

- criar lancamento;
- atualizar lancamento;
- pagar;
- reabrir;
- duplicar;
- excluir;
- encerrar recorrencia;
- aprovar;
- reclassificar;
- converter transferencia planejada.

Essa camada deve substituir mutacoes diretas espalhadas em componentes.

### Fase 3 - Criar formulario unico

Criar `SmartTransactionForm` com modos:

- `create`;
- `edit`;
- `pay`;
- `approve`;
- `reclassify`;
- `duplicate`.

Inicialmente ele pode conviver com as telas antigas.

### Fase 4 - Substituir o Novo Lancamento

Trocar o roteador atual por uma experiencia unica:

- categoria;
- dados principais;
- valor e datas;
- comportamento;
- revisao.

### Fase 5 - Substituir edicao, em aberto e aprovacao

Usar o mesmo formulario em:

- editar;
- pagar;
- reabrir;
- aprovar;
- reclassificar.

### Fase 6 - Remover fluxos antigos

Remover ou tornar internos os modais antigos depois que a nova tela estiver validada em producao.

## Primeiro comportamento esperado

Ao clicar em Novo Lancamento, o usuario deve ver:

1. busca de categoria;
2. painel mostrando conta e centro de custo herdados;
3. descricao, cliente, entidade e responsavel;
4. valor e datas;
5. escolha entre pontual, recorrente, parcelado, contrato ou planejado;
6. resumo final antes de salvar.

O usuario nao deve precisar descobrir qual pagina usar antes de fazer o lancamento. O proprio lancamento deve guiar a decisao.
