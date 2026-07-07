# Plano Multiempresa e Tema por Empresa

## Objetivo

Evoluir o sistema financeiro para permitir que mais de uma empresa use a mesma plataforma, com dados financeiros isolados, usuários vinculados por empresa e opção de importar apenas configurações estruturais da Ramos Engenharia para acelerar a implantação de novas empresas.

## Princípios

- Cada empresa deve ter seus próprios dados financeiros.
- Transações, saldos, faturas, contratos gerados, aprovações e históricos nunca devem ser copiados de uma empresa para outra.
- Configurações estruturais podem ser copiadas como modelo inicial.
- O usuário pode participar de uma ou mais empresas.
- A empresa ativa define quais dados aparecem no sistema.
- A identidade visual pode mudar por empresa, usando cor principal, logo e nome.

## Dados que Podem Ser Copiados Como Modelo

- Categorias.
- Contas.
- Agrupadores.
- Centros de custo.
- Métodos de pagamento.
- Planos.
- Modelos de contrato.
- Cláusulas padrão.
- Categorias pessoais do cartão, se fizer sentido.
- Configurações gerais não financeiras.

## Dados que Não Devem Ser Copiados

- Transações.
- Saldos.
- Faturas de cartão.
- Itens de fatura.
- Aprovações.
- Lançamentos em aberto.
- Contratos gerados.
- Clientes com movimentação real, salvo se o usuário escolher importar cadastro base.
- Anexos.
- Histórico financeiro.
- Logs de auditoria.

## Modelo de Produto

### Entrada no Sistema

1. Usuário faz login normalmente.
2. Se tiver acesso a mais de uma empresa, vê uma tela de seleção de empresa.
3. Após selecionar a empresa, entra no sistema com dados filtrados pela empresa ativa.
4. Se tiver apenas uma empresa, o sistema pode entrar direto.

### Criação de Empresa

Ao criar uma empresa:

1. Informar nome da empresa.
2. Informar CNPJ ou CPF, quando aplicável.
3. Informar cor principal.
4. Informar logo, se houver.
5. Escolher se deseja importar configurações da Ramos Engenharia.
6. Confirmar que dados financeiros não serão copiados.

### Tema por Empresa

Cada empresa pode ter:

- Nome exibido.
- Logo.
- Cor principal.
- Cor secundária.
- Paleta de apoio.
- Preferência de destaque visual no menu e botões.

Exemplo:

- Ramos Engenharia: verde.
- Nova empresa: azul.

## Banco de Dados

### Tabelas Base

Criar:

- `companies`
- `company_members`
- `company_settings`

Campos sugeridos em `companies`:

- `id`
- `name`
- `document_type`
- `document_number`
- `status`
- `created_at`
- `updated_at`

Campos sugeridos em `company_members`:

- `id`
- `company_id`
- `user_id`
- `role`
- `status`
- `created_at`

Campos sugeridos em `company_settings`:

- `id`
- `company_id`
- `primary_color`
- `secondary_color`
- `logo_url`
- `theme_name`
- `created_at`
- `updated_at`

### Tabelas que Devem Receber `company_id`

Prioridade alta:

- Transações.
- Contas.
- Categorias.
- Centros de custo.
- Agrupadores.
- Clientes.
- Entidades.
- Métodos de pagamento.
- Aprovações.
- Faturas de cartão.
- Itens de fatura.
- Contratos.
- Dashboard/relatórios derivados.

## RLS e Segurança

Toda consulta deve filtrar pela empresa ativa.

Regra essencial:

- Usuário só pode ler/escrever dados de empresas onde é membro ativo.

Antes de ativar produção, validar:

- Usuário da Empresa A não vê dados da Empresa B.
- Usuário com duas empresas consegue alternar corretamente.
- Dados criados em uma empresa não aparecem em outra.

## Fases de Implementação

### Fase 1: Desenho e Mapeamento

- Mapear todas as tabelas atuais.
- Classificar cada tabela como global, por empresa ou derivada.
- Definir quais tabelas recebem `company_id`.
- Definir quais configurações podem ser copiadas.

### Fase 2: Estrutura Multiempresa

- Criar tabelas `companies`, `company_members` e `company_settings`.
- Criar empresa padrão Ramos Engenharia.
- Vincular usuários atuais à Ramos.
- Adicionar `company_id` nas tabelas principais.

### Fase 3: Empresa Ativa no Frontend

- Criar seletor de empresa.
- Salvar empresa ativa na sessão/local storage.
- Aplicar filtro de empresa nos hooks e telas.
- Exibir nome e cor da empresa ativa no layout.

### Fase 4: Criar Nova Empresa

- Criar fluxo para cadastrar empresa.
- Permitir escolher cor principal.
- Permitir importar configurações da Ramos.
- Copiar apenas dados estruturais.

### Fase 5: Tema Visual por Empresa

- Aplicar variáveis CSS por empresa.
- Trocar cor principal dos botões, indicadores e destaques.
- Permitir logo por empresa.
- Manter fallback para tema padrão da Ramos.

### Fase 6: Auditoria e Validação

- Validar isolamento de dados.
- Validar que a empresa nova nasce sem transações.
- Validar que configurações copiadas funcionam.
- Validar dashboards zerados para empresa nova.
- Validar alternância entre empresas.

## Cuidados com Lovable/Supabase

Essa mudança exige SQL e ajuste de RLS.

Não aplicar tudo de uma vez sem backup.

Sequência recomendada:

1. Backup do banco atual.
2. Criar tabelas multiempresa.
3. Criar empresa Ramos.
4. Vincular dados atuais à empresa Ramos.
5. Aplicar RLS.
6. Ajustar frontend.
7. Criar nova empresa de teste.
8. Validar isolamento.

## Critério de Aceite

- Usuário consegue escolher empresa ao entrar.
- Usuário consegue criar nova empresa.
- Nova empresa pode importar configurações.
- Nova empresa não recebe transações nem saldos da Ramos.
- Tema da nova empresa muda cor principal.
- Dados da Ramos continuam intactos.
- Dados entre empresas ficam isolados.
