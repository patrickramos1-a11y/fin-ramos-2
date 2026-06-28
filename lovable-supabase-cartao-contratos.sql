-- PROMPT PARA O LOVABLE
-- Aplique este SQL completo no Supabase do projeto para sincronizar os módulos Cartão e Contratos Digitais.
-- O app publicado já usa estas tabelas e colunas; os erros atuais indicam que o banco ainda está desatualizado.
-- Depois de aplicar, recarregue o schema cache do Supabase/PostgREST, se necessário.

create extension if not exists pgcrypto;

-- ============================================================
-- MÓDULO: FATURAS DE CARTÃO (IMPORTAÇÃO / CONFERÊNCIA)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.credit_card_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competence_month INTEGER NOT NULL CHECK (competence_month BETWEEN 1 AND 12),
  competence_year INTEGER NOT NULL CHECK (competence_year BETWEEN 2000 AND 2100),
  file_name TEXT,
  holder TEXT,
  invoice_label TEXT,
  source_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  selected_cards JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'CONFERENCIA' CHECK (status IN ('CONFERENCIA','PRONTA','CONVERTIDA','ARQUIVADA')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_card_invoices_competence
  ON public.credit_card_invoices(competence_year, competence_month);

ALTER TABLE public.credit_card_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read credit_card_invoices" ON public.credit_card_invoices FOR SELECT USING (true);
CREATE POLICY "Public insert credit_card_invoices" ON public.credit_card_invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update credit_card_invoices" ON public.credit_card_invoices FOR UPDATE USING (true);
CREATE POLICY "Public delete credit_card_invoices" ON public.credit_card_invoices FOR DELETE USING (true);

CREATE TRIGGER trg_credit_card_invoices_updated
BEFORE UPDATE ON public.credit_card_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.credit_card_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.credit_card_invoices(id) ON DELETE CASCADE,
  card_name TEXT NOT NULL,
  card_final_digits TEXT,
  card_type TEXT,
  transaction_date DATE,
  description TEXT NOT NULL,
  normalized_description TEXT,
  installment TEXT,
  scope TEXT NOT NULL DEFAULT 'nacional' CHECK (scope IN ('nacional','internacional')),
  country TEXT,
  usd_value NUMERIC,
  fx_rate NUMERIC,
  amount NUMERIC NOT NULL,
  category_hint TEXT,
  transaction_category_id UUID REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  entity_id UUID REFERENCES public.financial_entities(id) ON DELETE SET NULL,
  notes TEXT,
  review_status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (review_status IN ('PENDENTE','REVISADO','IGNORADO','CONVERTIDO')),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_card_invoice_items_invoice
  ON public.credit_card_invoice_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_credit_card_invoice_items_description
  ON public.credit_card_invoice_items(normalized_description);

CREATE INDEX IF NOT EXISTS idx_credit_card_invoice_items_status
  ON public.credit_card_invoice_items(review_status);

ALTER TABLE public.credit_card_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read credit_card_invoice_items" ON public.credit_card_invoice_items FOR SELECT USING (true);
CREATE POLICY "Public insert credit_card_invoice_items" ON public.credit_card_invoice_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update credit_card_invoice_items" ON public.credit_card_invoice_items FOR UPDATE USING (true);
CREATE POLICY "Public delete credit_card_invoice_items" ON public.credit_card_invoice_items FOR DELETE USING (true);

CREATE TRIGGER trg_credit_card_invoice_items_updated
BEFORE UPDATE ON public.credit_card_invoice_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- MÓDULO: CARTÃO - GESTÃO / CLASSIFICAÇÃO / CONVERSÃO
-- ============================================================

ALTER TABLE public.credit_card_invoice_items
  ADD COLUMN IF NOT EXISTS usage_scope TEXT NOT NULL DEFAULT 'DUVIDA'
    CHECK (usage_scope IN ('EMPRESA','PESSOAL','DUVIDA')),
  ADD COLUMN IF NOT EXISTS conversion_status TEXT NOT NULL DEFAULT 'NAO_SELECIONADO'
    CHECK (conversion_status IN ('NAO_SELECIONADO','PRONTO','CONVERTIDO','IGNORADO')),
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.recurring_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_credit_card_invoice_items_scope
  ON public.credit_card_invoice_items(usage_scope);

CREATE INDEX IF NOT EXISTS idx_credit_card_invoice_items_conversion
  ON public.credit_card_invoice_items(conversion_status);

CREATE INDEX IF NOT EXISTS idx_credit_card_invoice_items_card
  ON public.credit_card_invoice_items(invoice_id, card_name, card_final_digits);

-- ============================================================
-- MÓDULO: CARTÃO - PADRÕES POR ESTABELECIMENTO E REEMBOLSO
-- ============================================================

ALTER TABLE public.credit_card_invoice_items
  ADD COLUMN IF NOT EXISTS usage_scope TEXT NOT NULL DEFAULT 'DUVIDA'
    CHECK (usage_scope IN ('EMPRESA','PESSOAL','DUVIDA')),
  ADD COLUMN IF NOT EXISTS conversion_status TEXT NOT NULL DEFAULT 'NAO_SELECIONADO'
    CHECK (conversion_status IN ('NAO_SELECIONADO','PRONTO','CONVERTIDO','IGNORADO')),
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.recurring_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reimbursement_status TEXT NOT NULL DEFAULT 'NAO_APLICA'
    CHECK (reimbursement_status IN ('NAO_APLICA','PENDENTE','REEMBOLSADO')),
  ADD COLUMN IF NOT EXISTS reimbursement_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_credit_card_invoice_items_scope
  ON public.credit_card_invoice_items(usage_scope);

CREATE INDEX IF NOT EXISTS idx_credit_card_invoice_items_conversion
  ON public.credit_card_invoice_items(conversion_status);

CREATE INDEX IF NOT EXISTS idx_credit_card_invoice_items_card
  ON public.credit_card_invoice_items(invoice_id, card_name, card_final_digits);

CREATE INDEX IF NOT EXISTS idx_credit_card_invoice_items_reimbursement
  ON public.credit_card_invoice_items(reimbursement_status);

CREATE TABLE IF NOT EXISTS public.credit_card_merchant_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_key TEXT NOT NULL UNIQUE,
  merchant_label TEXT NOT NULL,
  transaction_category_id UUID NOT NULL REFERENCES public.transaction_categories(id) ON DELETE CASCADE,
  usage_scope TEXT NOT NULL DEFAULT 'EMPRESA'
    CHECK (usage_scope IN ('EMPRESA','PESSOAL','DUVIDA')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_card_merchant_rules_key
  ON public.credit_card_merchant_rules(merchant_key);

CREATE INDEX IF NOT EXISTS idx_credit_card_merchant_rules_category
  ON public.credit_card_merchant_rules(transaction_category_id);

ALTER TABLE public.credit_card_merchant_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read credit_card_merchant_rules"
  ON public.credit_card_merchant_rules FOR SELECT USING (true);

CREATE POLICY "Public insert credit_card_merchant_rules"
  ON public.credit_card_merchant_rules FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update credit_card_merchant_rules"
  ON public.credit_card_merchant_rules FOR UPDATE USING (true);

CREATE POLICY "Public delete credit_card_merchant_rules"
  ON public.credit_card_merchant_rules FOR DELETE USING (true);

DROP TRIGGER IF EXISTS trg_credit_card_merchant_rules_updated ON public.credit_card_merchant_rules;
CREATE TRIGGER trg_credit_card_merchant_rules_updated
BEFORE UPDATE ON public.credit_card_merchant_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE IF NOT EXISTS public.credit_card_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_key TEXT NOT NULL UNIQUE,
  card_name TEXT NOT NULL,
  card_final_digits TEXT,
  card_type TEXT,
  owner_name TEXT,
  usage_scope TEXT NOT NULL DEFAULT 'DUVIDA'
    CHECK (usage_scope IN ('EMPRESA', 'PESSOAL', 'DUVIDA')),
  color TEXT NOT NULL DEFAULT '#10b981',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_card_profiles_scope
  ON public.credit_card_profiles(usage_scope);

CREATE INDEX IF NOT EXISTS idx_credit_card_profiles_active
  ON public.credit_card_profiles(active);

ALTER TABLE public.credit_card_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read credit_card_profiles"
  ON public.credit_card_profiles FOR SELECT USING (true);

CREATE POLICY "Public insert credit_card_profiles"
  ON public.credit_card_profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update credit_card_profiles"
  ON public.credit_card_profiles FOR UPDATE USING (true);

CREATE POLICY "Public delete credit_card_profiles"
  ON public.credit_card_profiles FOR DELETE USING (true);

DROP TRIGGER IF EXISTS trg_credit_card_profiles_updated ON public.credit_card_profiles;
CREATE TRIGGER trg_credit_card_profiles_updated
BEFORE UPDATE ON public.credit_card_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
create extension if not exists pgcrypto;

create table if not exists public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  service_type text,
  description text,
  cover_title text,
  cover_subtitle text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contract_clauses (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.contract_templates(id) on delete cascade,
  title text not null,
  body text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.contract_templates(id) on delete set null,
  title text not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'em_revisao', 'aguardando_aceite', 'aceito', 'cancelado')),
  contractor_type text not null check (contractor_type in ('pessoa_fisica', 'pessoa_juridica')),
  contractor_name text not null,
  contractor_document text not null,
  contractor_email text,
  contractor_phone text,
  contractor_address text,
  contractor_responsible text,
  plan_name text,
  plan_value numeric(14,2),
  payment_terms text,
  start_date date,
  end_date date,
  digital_snapshot jsonb not null default '{}'::jsonb,
  accepted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contract_document_clauses (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.contract_documents(id) on delete cascade,
  source_clause_id uuid references public.contract_clauses(id) on delete set null,
  title text not null,
  body text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.contract_acceptance_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.contract_documents(id) on delete cascade,
  token text not null unique,
  status text not null default 'aguardando' check (status in ('aguardando', 'aceito', 'expirado', 'cancelado')),
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_name text,
  accepted_document text,
  accepted_email text,
  accepted_ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.contract_acceptance_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.contract_documents(id) on delete cascade,
  acceptance_link_id uuid references public.contract_acceptance_links(id) on delete set null,
  event_type text not null,
  actor_name text,
  actor_document text,
  actor_email text,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_clauses_template on public.contract_clauses(template_id, display_order);
create index if not exists idx_contract_documents_status on public.contract_documents(status, created_at);
create index if not exists idx_contract_acceptance_links_token on public.contract_acceptance_links(token);
create index if not exists idx_contract_acceptance_links_document on public.contract_acceptance_links(document_id);

alter table public.contract_templates enable row level security;
alter table public.contract_clauses enable row level security;
alter table public.contract_documents enable row level security;
alter table public.contract_document_clauses enable row level security;
alter table public.contract_acceptance_links enable row level security;
alter table public.contract_acceptance_events enable row level security;

drop policy if exists "Authenticated can manage contract templates" on public.contract_templates;
create policy "Authenticated can manage contract templates"
on public.contract_templates for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can manage contract clauses" on public.contract_clauses;
create policy "Authenticated can manage contract clauses"
on public.contract_clauses for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can manage contract documents" on public.contract_documents;
create policy "Authenticated can manage contract documents"
on public.contract_documents for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can manage document clauses" on public.contract_document_clauses;
create policy "Authenticated can manage document clauses"
on public.contract_document_clauses for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can manage acceptance links" on public.contract_acceptance_links;
create policy "Authenticated can manage acceptance links"
on public.contract_acceptance_links for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can manage acceptance events" on public.contract_acceptance_events;
create policy "Authenticated can manage acceptance events"
on public.contract_acceptance_events for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read valid acceptance links" on public.contract_acceptance_links;
create policy "Public can read valid acceptance links"
on public.contract_acceptance_links for select
to anon
using (
  status = 'aguardando'
  and (expires_at is null or expires_at > now())
);

drop policy if exists "Public can accept valid links" on public.contract_acceptance_links;
create policy "Public can accept valid links"
on public.contract_acceptance_links for update
to anon
using (
  status = 'aguardando'
  and (expires_at is null or expires_at > now())
)
with check (status in ('aguardando', 'aceito'));

drop policy if exists "Public can read linked contract documents" on public.contract_documents;
create policy "Public can read linked contract documents"
on public.contract_documents for select
to anon
using (
  exists (
    select 1
    from public.contract_acceptance_links l
    where l.document_id = contract_documents.id
      and l.status = 'aguardando'
      and (l.expires_at is null or l.expires_at > now())
  )
);

drop policy if exists "Public can read linked document clauses" on public.contract_document_clauses;
create policy "Public can read linked document clauses"
on public.contract_document_clauses for select
to anon
using (
  exists (
    select 1
    from public.contract_acceptance_links l
    where l.document_id = contract_document_clauses.document_id
      and l.status = 'aguardando'
      and (l.expires_at is null or l.expires_at > now())
  )
);

drop policy if exists "Public can insert acceptance events" on public.contract_acceptance_events;
create policy "Public can insert acceptance events"
on public.contract_acceptance_events for insert
to anon
with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.contract_templates, public.contract_clauses, public.contract_documents, public.contract_document_clauses to authenticated;
grant insert, update, delete on public.contract_templates, public.contract_clauses, public.contract_documents, public.contract_document_clauses to authenticated;
grant select, insert, update, delete on public.contract_acceptance_links, public.contract_acceptance_events to authenticated;
grant select on public.contract_acceptance_links, public.contract_documents, public.contract_document_clauses to anon;
grant update on public.contract_acceptance_links to anon;
grant insert on public.contract_acceptance_events to anon;

insert into public.contract_templates (name, service_type, description, cover_title, cover_subtitle)
select
  'Contrato VIP - Ramos Engenharia',
  'Consultoria e soluções ambientais',
  'Modelo base para contratos de consultoria com planos por salário mínimo.',
  'Contrato de Prestação de Serviços',
  'Construindo o presente para preservar o futuro'
where not exists (
  select 1 from public.contract_templates where name = 'Contrato VIP - Ramos Engenharia'
);

with base_template as (
  select id from public.contract_templates where name = 'Contrato VIP - Ramos Engenharia' limit 1
)
insert into public.contract_clauses (template_id, title, body, display_order)
select base_template.id, clause.title, clause.body, clause.display_order
from base_template
cross join (
  values
    ('Das Partes', 'Identificação da CONTRATANTE e da CONTRATADA, incluindo dados cadastrais, representantes e contatos oficiais.', 1),
    ('Do Objeto', 'Prestação de serviços técnicos, consultivos e operacionais conforme plano contratado e escopo aprovado entre as partes.', 2),
    ('Utilização do Sisramos', 'Quando aplicável, a CONTRATANTE poderá utilizar os recursos digitais disponibilizados pela Ramos Engenharia para acompanhamento das atividades.', 3),
    ('Descrição do Plano de Serviço', 'O plano contratado definirá escopo, recorrência, entregáveis, valores, condições comerciais e responsabilidades operacionais.', 4),
    ('Plano Contratado', 'O plano, valor, vigência e condições de pagamento serão apresentados no resumo comercial deste contrato.', 5),
    ('Obrigações da Contratante', 'A CONTRATANTE deverá fornecer informações corretas, documentos, acessos e aprovações necessárias para execução dos serviços.', 6),
    ('Obrigações da Contratada', 'A CONTRATADA deverá executar os serviços com zelo técnico, confidencialidade e comunicação adequada durante a vigência contratual.', 7),
    ('Informações Confidenciais', 'As partes se comprometem a preservar sigilo sobre informações técnicas, comerciais, financeiras e estratégicas compartilhadas.', 8),
    ('Prazo e Validade', 'O prazo de vigência será definido no resumo comercial, podendo ser por prazo determinado, recorrente ou indeterminado conforme negociação.', 9),
    ('Forma de Pagamento, Cobrança e Valor', 'Os valores, vencimentos, reajustes, descontos e forma de cobrança serão definidos no resumo comercial deste contrato.', 10),
    ('Aceite Digital', 'O aceite eletrônico realizado por link seguro registra ciência e concordância com a versão digital apresentada, incluindo data, hora e dados de identificação.', 11)
) as clause(title, body, display_order)
where not exists (
  select 1
  from public.contract_clauses c
  where c.template_id = base_template.id
);
alter table public.contract_templates
  add column if not exists cover_image_url text,
  add column if not exists accent_color text default '#10b981',
  add column if not exists template_status text default 'ativo',
  add column if not exists version_label text default 'v1';

alter table public.contract_clauses
  add column if not exists clause_kind text default 'legal',
  add column if not exists is_required boolean default true,
  add column if not exists version_label text default 'v1',
  add column if not exists notes text;

do $$
declare
  v_template_id uuid;
begin
  select id
    into v_template_id
    from public.contract_templates
   where name = 'Contrato VIP - Ramos Engenharia'
   order by created_at
   limit 1;

  if v_template_id is null then
    insert into public.contract_templates (
      name,
      service_type,
      description,
      cover_title,
      cover_subtitle,
      accent_color,
      template_status,
      version_label,
      active
    )
    values (
      'Contrato VIP - Ramos Engenharia',
      'Consultoria ambiental',
      'Modelo VIP de prestação de serviços ambientais com Sisramos, acompanhamento técnico, plano comercial e aceite digital.',
      'Contrato VIP de Prestação de Serviços Ambientais',
      'Construindo o presente para preservar o futuro',
      '#10b981',
      'ativo',
      'v2 referência APEU',
      true
    )
    returning id into v_template_id;
  else
    update public.contract_templates
       set service_type = 'Consultoria ambiental',
           description = 'Modelo VIP de prestação de serviços ambientais com Sisramos, acompanhamento técnico, plano comercial e aceite digital.',
           cover_title = 'Contrato VIP de Prestação de Serviços Ambientais',
           cover_subtitle = 'Construindo o presente para preservar o futuro',
           accent_color = coalesce(accent_color, '#10b981'),
           template_status = 'ativo',
           version_label = 'v2 referência APEU',
           updated_at = now()
     where id = v_template_id;
  end if;

  delete from public.contract_clauses where template_id = v_template_id;

  insert into public.contract_clauses (template_id, display_order, title, body, clause_kind, is_required, version_label)
  values
  (v_template_id, 1, 'Das Partes', $clause$
Pelo presente instrumento particular de prestação de serviços, de um lado a CONTRATANTE, qualificada no quadro de dados do contrato, e de outro lado a RAMOS ENGENHARIA, CONSULTORIA E SERVIÇOS LTDA, pessoa jurídica de direito privado, inscrita no CNPJ nº 28.439.151/0001-60, com sede em Castanhal/PA, neste ato representada por Patrick de Oliveira Ramos, doravante denominada CONTRATADA, resolvem celebrar o presente contrato.

As partes reconhecem que os dados cadastrais informados na criação deste documento integram este contrato para todos os fins, inclusive identificação do responsável, endereço, documento, e-mail e telefone de contato.
$clause$, 'identificacao', true, 'v2'),

  (v_template_id, 2, 'Do Objeto', $clause$
O presente contrato tem por objeto a prestação de serviços técnicos de consultoria, acompanhamento e gestão ambiental pela CONTRATADA em favor da CONTRATANTE.

Os serviços poderão compreender, conforme plano contratado: visitas técnicas periódicas, elaboração e acompanhamento de relatórios técnicos e ambientais, monitoramento de requisitos legais e normativos, assessoria em práticas ambientais sustentáveis, suporte técnico em licenciamento ambiental, desenvolvimento de projetos ambientais, processos de outorga, acompanhamento de notificações, auditorias e demais atividades compatíveis com a natureza do plano contratado.

O escopo específico será interpretado em conjunto com o plano comercial selecionado, as condições de pagamento e as cláusulas ativas deste documento.
$clause$, 'escopo', true, 'v2'),

  (v_template_id, 3, 'Utilização do Sisramos', $clause$
A CONTRATADA poderá disponibilizar à CONTRATANTE acesso ao Sisramos, sistema de gestão ambiental inteligente utilizado para organização, acompanhamento e compartilhamento de informações relacionadas aos serviços contratados.

O Sisramos poderá conter relatórios, documentos técnicos, status de licenças, prazos, histórico de interações, solicitações e demais registros pertinentes ao acompanhamento ambiental. O acesso será restrito aos usuários autorizados pela CONTRATANTE e poderá ser atualizado periodicamente pela CONTRATADA.

Manutenções programadas, indisponibilidades temporárias e melhorias evolutivas do sistema não caracterizam descumprimento contratual, desde que preservada a continuidade razoável dos serviços técnicos contratados.
$clause$, 'sistema', true, 'v2'),

  (v_template_id, 4, 'Descrição dos Planos de Serviço', $clause$
Os planos de serviço são organizados em níveis de atendimento, podendo incluir: Plano Anual, Plano VIP, Plano Premium e Plano Master.

O Plano Anual contempla acompanhamento ambiental recorrente, suporte em processo de licenciamento, resposta a notificações, cadastro em sistemas ambientais, elaboração de relatórios, desenvolvimento de projetos ambientais, processo de outorga, grupo de atendimento e emissão de boletim ambiental.

O Plano VIP inclui as entregas do Plano Anual e acrescenta suporte em memorial descritivo geográfico, conscientização ambiental, gerenciamento de resíduos sólidos, projeto de estação de tratamento de efluentes, acompanhamento de obras, auditorias, relatórios de visitas e movimentação de processos licenciatórios.

O Plano Premium inclui as entregas do Plano VIP e acrescenta maior volume de processos, rotinas de monitoramento, certificação ambiental, incentivo fiscal, assessoramento de consultor pleno, cotações e negociações relacionadas aos serviços.

O Plano Master inclui as entregas do Plano Premium e acrescenta políticas internas ambientais, diretrizes ambientais, processos ambientais ampliados, auditoria mensal, otimização produtiva, gestão de resíduos, projetos de otimização de recursos naturais e assessoramento de consultor sênior.
$clause$, 'plano', true, 'v2'),

  (v_template_id, 5, 'Plano Contratado', $clause$
O plano efetivamente contratado será aquele selecionado no momento de geração deste contrato, constando no resumo comercial e na capa digital do documento.

Quando o plano selecionado for o Plano VIP, ficam compreendidas, em linhas gerais, as atividades de acompanhamento técnico ambiental, licenciamento, projetos ambientais, monitoramento, assessoria contínua, suporte em outorgas e certificações, visitas técnicas e relatórios, observados os limites comerciais acordados entre as partes.

Serviços extraordinários, urgências, deslocamentos, taxas, análises laboratoriais, ARTs, emolumentos e despesas de terceiros não estarão automaticamente incluídos, salvo previsão expressa em proposta, anexo ou condição comercial específica.
$clause$, 'plano', true, 'v2'),

  (v_template_id, 6, 'Obrigações da Contratante', $clause$
São obrigações da CONTRATANTE: fornecer informações, documentos e acessos necessários à execução dos serviços; indicar responsáveis internos para comunicação; cumprir prazos de envio de documentos; efetuar os pagamentos nas datas acordadas; arcar com taxas públicas, emolumentos, ARTs, análises laboratoriais, deslocamentos e despesas de terceiros quando não incluídas expressamente no plano.

A CONTRATANTE reconhece que atrasos, omissões ou inconsistências nas informações fornecidas podem impactar prazos, qualidade técnica e andamento de processos administrativos ou ambientais.
$clause$, 'obrigacoes', true, 'v2'),

  (v_template_id, 7, 'Obrigações da Contratada', $clause$
São obrigações da CONTRATADA: prestar os serviços com zelo técnico, boa-fé e diligência profissional; utilizar as informações recebidas exclusivamente para a execução do contrato; manter sigilo sobre informações estratégicas da CONTRATANTE; disponibilizar orientações técnicas compatíveis com o plano contratado; comunicar pendências relevantes; e emitir documentos fiscais ou recibos quando aplicável.

A CONTRATADA não se responsabiliza por indeferimentos, autuações, sanções, atrasos de órgãos públicos ou decisões administrativas que dependam de terceiros, da veracidade dos dados fornecidos ou de atos da própria CONTRATANTE.
$clause$, 'obrigacoes', true, 'v2'),

  (v_template_id, 8, 'Informações Confidenciais', $clause$
Serão consideradas confidenciais todas as informações técnicas, comerciais, financeiras, ambientais, operacionais, estratégicas, documentais ou cadastrais compartilhadas entre as partes em razão deste contrato.

A parte receptora deverá manter sigilo, não divulgar a terceiros sem autorização e não utilizar as informações para finalidade diversa da execução contratual. A obrigação de confidencialidade permanecerá vigente durante o contrato e por 2 anos após seu encerramento, salvo quando a informação já for pública, legalmente exigida por autoridade competente ou obtida legitimamente por outra fonte.
$clause$, 'confidencialidade', true, 'v2'),

  (v_template_id, 9, 'Prazo e Validade', $clause$
O contrato terá início na data indicada no resumo comercial ou, na ausência desta, na data de aceite ou assinatura. A vigência poderá ser por prazo determinado ou indeterminado, conforme configuração do contrato.

Nos contratos recorrentes sem prazo final definido, a prestação dos serviços permanecerá ativa enquanto houver pagamento regular e interesse das partes. Qualquer parte poderá solicitar encerramento mediante comunicação escrita, respeitadas obrigações vencidas e eventuais valores proporcionais devidos.
$clause$, 'vigencia', true, 'v2'),

  (v_template_id, 10, 'Forma de Pagamento, Cobrança e Valor', $clause$
O valor, periodicidade e forma de pagamento serão aqueles definidos no resumo comercial do contrato. Quando pactuado pagamento mensal recorrente, os pagamentos deverão ocorrer até a data acordada entre as partes, mediante boleto, transferência, PIX ou outro meio aceito pela CONTRATADA.

Em caso de atraso superior a 30 dias, a CONTRATADA poderá suspender os serviços, restringir acessos, interromper acompanhamentos e adotar medidas de cobrança cabíveis, inclusive protesto de títulos quando aplicável, sem prejuízo da cobrança de valores vencidos.
$clause$, 'financeiro', true, 'v2'),

  (v_template_id, 11, 'Descumprimento Contratual', $clause$
O descumprimento de qualquer cláusula contratual poderá ensejar notificação, suspensão de serviços, rescisão imediata ou adoção de medidas administrativas e judiciais cabíveis.

A rescisão não exonera as partes de obrigações já constituídas, inclusive pagamento de valores vencidos, devolução ou preservação de informações confidenciais e cumprimento de obrigações legais aplicáveis.
$clause$, 'juridico', true, 'v2'),

  (v_template_id, 12, 'Rescisão', $clause$
Qualquer parte poderá solicitar a rescisão do contrato por comunicação escrita enviada ao e-mail ou canal oficial informado no contrato.

Quando houver pagamento antecipado e encerramento antes do período contratado, eventual restituição proporcional deverá observar os serviços já executados, custos incorridos, obrigações em andamento e condições comerciais pactuadas.
$clause$, 'juridico', true, 'v2'),

  (v_template_id, 13, 'Disposições Gerais, Aceite Digital e Foro', $clause$
Este contrato não cria vínculo empregatício, societário, representação comercial ou exclusividade entre as partes. Alterações deverão ocorrer por escrito, por termo aditivo, nova versão digital ou aceite expresso em canal validado.

O aceite digital deste documento será considerado manifestação operacional de concordância com os termos apresentados, registrando nome, documento, e-mail, data, hora e identificação técnica do navegador. Esta versão inicial não substitui assinatura eletrônica avançada, certificação ICP-Brasil ou plataforma especializada quando tais formalidades forem exigidas.

Fica eleito o foro da Comarca de Castanhal/PA para dirimir eventuais controvérsias, salvo disposição legal obrigatória em sentido diverso.
$clause$, 'aceite', true, 'v2');
end $$;
do $$
declare
  v_template_id uuid;
begin
  select id
    into v_template_id
    from public.contract_templates
   where name = 'Contrato VIP - Ramos Engenharia'
   order by created_at
   limit 1;

  if v_template_id is null then
    insert into public.contract_templates (
      name,
      service_type,
      description,
      cover_title,
      cover_subtitle,
      active
    )
    values (
      'Contrato VIP - Ramos Engenharia',
      'Consultoria ambiental',
      'Contrato de prestação de serviços ambientais com plano VIP, Sisramos e termo de aceite digital.',
      'Contrato VIP de Prestação de Serviços',
      'Construindo o presente para preservar o futuro',
      true
    )
    returning id into v_template_id;
  else
    update public.contract_templates
       set service_type = 'Consultoria ambiental',
           description = 'Contrato de prestação de serviços ambientais com plano VIP, Sisramos e termo de aceite digital.',
           cover_title = 'Contrato VIP de Prestação de Serviços',
           cover_subtitle = 'Construindo o presente para preservar o futuro',
           updated_at = now()
     where id = v_template_id;
  end if;

  delete from public.contract_clauses where template_id = v_template_id;

  insert into public.contract_clauses (template_id, display_order, title, body, active)
  values
  (v_template_id, 1, 'DAS PARTES', $md$
Este contrato é celebrado entre:

**CONTRATANTE:** {{contratante_nome}}, inscrita no {{contratante_tipo_documento}} sob o nº {{contratante_documento}}, doravante denominada simplesmente **CONTRATANTE**.

**CONTRATADO:** RAMOS ENGENHARIA, CONSULTORIA E SERVIÇOS LTDA, inscrita no CNPJ sob o nº 28.439.151/0001-60, com sede à TV. ARGENTINA, nº 2794, NOVO ESTRELA, CEP: 68.742-235, CASTANHAL/PA, neste ato representada por seu representante legal, Sr. Patrick de Oliveira Ramos, portador do CPF nº 006.011.652-84 e RG nº 9355281 PC/PA, doravante denominada simplesmente **CONTRATADO**.

Decidem as partes, na melhor forma de direito, celebrar o presente **CONTRATO DE PRESTAÇÃO DE SERVIÇOS**, que reger-se-á mediante as cláusulas e condições adiante estipuladas.

As partes acima identificadas têm, entre si, justo e acordado o presente contrato de prestação de serviços, que se regerá pelas cláusulas e condições seguintes, que mutuamente aceitam e outorgam.
$md$, true),

  (v_template_id, 2, 'DO OBJETO', $md$
Este contrato tem por objeto a prestação de serviços profissionais pela RAMOS ENGENHARIA, CONSULTORIA E SERVIÇOS LTDA, para a CONTRATANTE, conforme descrito abaixo:

## Prestação de serviços de acompanhamento ambiental

- Realização de visitas técnicas periódicas para monitoramento e assessoria ambiental.
- Elaboração e acompanhamento de relatórios técnicos e ambientais.
- Monitoramento de cumprimento de requisitos legais e normativos ambientais.
- Assessoria na implementação de políticas e práticas ambientais sustentáveis.
- Acompanhamento e suporte técnico em processos de licenciamento ambiental.

## Utilização do Sisramos

- Utilização do sistema de gestão ambiental inteligente, Sisramos, para compartilhamento de informações sobre os serviços prestados.
- Atualizações contínuas no Sisramos com relatórios de progresso, status de licenças e outras informações relevantes.

## Serviços específicos de cada plano contratado

- **Plano Anual:** serviços contínuos de assessoria e acompanhamento ambiental.
- **Plano VIP:** serviços do Plano Anual, acrescidos de suporte adicional em projetos específicos.
- **Plano Premium:** serviços do Plano VIP, acrescidos de implementação de práticas avançadas de sustentabilidade.
- **Plano Master:** serviços do Plano Premium, acrescidos de assessoria em otimização de recursos naturais e processos produtivos.

Este contrato se regerá pelas cláusulas e condições adiante estipuladas, que as partes mutuamente aceitam e outorgam.
$md$, true),

  (v_template_id, 3, 'UTILIZAÇÃO DO SISRAMOS', $md$
O presente contrato prevê a utilização do Sisramos, sistema de gestão ambiental inteligente desenvolvido pela RAMOS ENGENHARIA, CONSULTORIA E SERVIÇOS LTDA, que tem como objetivo principal o compartilhamento de informações sobre os serviços prestados à CONTRATANTE.

## Cadastro e acesso

- A CONTRATANTE receberá credenciais exclusivas para acesso ao Sisramos, onde poderá visualizar dados e relatórios relacionados aos serviços contratados.
- O acesso ao sistema será restrito às pessoas autorizadas pela CONTRATANTE, garantindo segurança e confidencialidade das informações.

## Atualizações e manutenção

- O CONTRATADO se compromete a manter o Sisramos atualizado, incluindo novas funcionalidades e melhorias de segurança, conforme necessário.
- Eventuais manutenções programadas serão comunicadas à CONTRATANTE com antecedência mínima de 48 horas.

## Relatórios e documentos

- Todos os relatórios técnicos, documentos de licenciamento, certificados e demais documentos relacionados aos serviços prestados serão disponibilizados no Sisramos.
- A CONTRATANTE poderá acessar, baixar e imprimir os documentos conforme necessário.

## Comunicação e suporte

- O Sisramos disponibiliza funcionalidades de comunicação direta entre CONTRATANTE e CONTRATADO, facilitando o acompanhamento dos serviços e a resolução de dúvidas.
- O suporte técnico relacionado ao uso do Sisramos será prestado pelo CONTRATADO durante o horário comercial, via telefone, e-mail ou chat integrado ao sistema.
$md$, true),

  (v_template_id, 4, 'DESCRIÇÃO DO PLANO DE SERVIÇO', $md$
A RAMOS ENGENHARIA, CONSULTORIA E SERVIÇOS LTDA oferece quatro planos de serviço para atender às necessidades da CONTRATANTE. Cada plano é detalhado a seguir:

## 4.1. Plano Anual (0,75 salário mínimo por mês)

1. Processo de licenciamento.
2. Resposta a notificações e acompanhamento do processo.
3. Cadastro no IBAMA.
4. Elaboração do RIAA (Relatório de Impacto Ambiental Anual).
5. Desenvolvimento de projetos ambientais.
6. Processo de outorga.
7. Grupo de atendimento.
8. Elaboração e execução do plano de ação.
9. Emissão de boletim ambiental.

## 4.2. Plano VIP (1,5 salário mínimo por mês)

O Plano VIP inclui todos os serviços do Plano Anual, além de:

1. Memorial Descritivo Geográfico.
2. Curso de Conscientização Ambiental.
3. Projeto para Gerenciamento de Resíduos Sólidos.
4. Projeto de Estação de Tratamento de Efluentes (até 12m³/hora).
5. Acompanhamento de obras.
6. Assessoria sobre licenças e serviços de engenharia.
7. Visitas e auditorias periódicas, com emissão de relatórios de visitas.
8. Movimentação dos processos licenciatórios.

## 4.3. Plano Premium (2,25 salários mínimos por mês)

O Plano Premium inclui todos os serviços do Plano VIP, além de:

1. Mais 2 processos de outorga.
2. Mais 2 processos de licenciamento, para outras atividades ou ampliação.
3. Implantação de placas de conscientização ambiental.
4. Processo de CEPROF.
5. Criação de rotinas de monitoramento ambiental, incluindo água, ETE e resíduos.
6. Projeto para certificação ambiental.
7. Projeto para incentivo fiscal.
8. Disponibilidade de assessoramento de um consultor pleno.
9. Cotações e negociações sobre propostas de serviços de engenharia e licenciatórios.

## 4.4. Plano Master (3,5 salários mínimos por mês)

O Plano Master inclui todos os serviços do Plano Premium, além de:

1. Criação de políticas internas ambientais.
2. Criação de diretrizes ambientais.
3. Processos ambientais ilimitados.
4. Realização de uma auditoria mensal.
5. Projetos de otimização do sistema produtivo.
6. Gestão de geração de resíduos.
7. Disponibilidade de projetos para otimização de recursos naturais, como água, energia, matéria-prima e papel.
8. Projetos de usos sustentáveis, como energias renováveis, compostagem e aproveitamento hídrico.
9. Disponibilidade de assessoramento de um consultor sênior.
$md$, true),

  (v_template_id, 5, 'PLANO CONTRATADO', $md$
O presente contrato especifica que os serviços serão prestados de acordo com o plano selecionado no momento da geração do contrato.

Quando selecionado o **PLANO VIP**, este contempla uma gama abrangente de serviços ambientais, incluindo, mas não se limitando a, processos de licenciamento, projetos ambientais, monitoramento e assessoria contínua, além de suporte em outorgas e certificações.

Este plano garante que a CONTRATANTE receberá suporte técnico especializado e acompanhamento detalhado conforme descrito na Cláusula 4ª deste contrato.
$md$, true),

  (v_template_id, 6, 'OBRIGAÇÕES DA CONTRATANTE', $md$
1. **Fornecimento de informações:** a CONTRATANTE deverá fornecer ao CONTRATADO todas as informações necessárias à realização do serviço, especificando os detalhes necessários para a perfeita consecução do mesmo.

2. **Pagamentos:** a CONTRATANTE deverá efetuar o pagamento conforme estabelecido na cláusula de forma de pagamento, cobrança e valor.

3. **Despesas adicionais:** fica de responsabilidade da CONTRATANTE arcar com o pagamento das taxas e despesas ao decorrer do processo que não estejam inclusas na proposta, tais como:

- Anotação de Responsabilidade Técnica (ART).
- Laudos físico-químicos da água, solo e ar.
- Taxas referentes aos processos de licenciamento.
- Despesas de deslocamento da consultoria para resolver seus processos ou de qualquer outra natureza.
$md$, true),

  (v_template_id, 7, 'OBRIGAÇÕES DO CONTRATADO', $md$
1. **Prestação de serviços:** o CONTRATADO deverá prestar os serviços solicitados pela CONTRATANTE conforme detalhamento descrito neste contrato.

2. **Meios necessários:** serão de responsabilidade do CONTRATADO os meios necessários para viabilizar a prestação de serviço objeto deste instrumento, incluindo equipamentos, licenças de software e local de trabalho, salvo as obrigações da CONTRATANTE previstas neste contrato.

3. **Sigilo e confidencialidade:** o CONTRATADO se obriga a manter absoluto sigilo sobre as operações, dados, estratégias, materiais, pormenores, informações e documentos da CONTRATANTE, mesmo após a conclusão dos projetos e serviços ou do término da relação contratual.

4. **Uso das informações:** os contratos, informações, dados, materiais e documentos inerentes à CONTRATANTE ou a seus clientes deverão ser utilizados pelo CONTRATADO, seus funcionários ou contratados, estritamente para cumprimento dos serviços solicitados.

5. **Responsabilidades trabalhistas e tributárias:** será de responsabilidade do CONTRATADO todo o ônus trabalhista ou tributário referente aos funcionários utilizados para a prestação do serviço, ficando a CONTRATANTE isenta de qualquer obrigação em relação a eles.

6. **Documentos fiscais:** o CONTRATADO deverá fornecer os respectivos documentos fiscais referentes aos pagamentos do presente instrumento.
$md$, true),

  (v_template_id, 8, 'INFORMAÇÕES CONFIDENCIAIS', $md$
1. **Definição de informações confidenciais:** incluem todas as informações técnicas, comerciais, financeiras, de mercado, pesquisa e desenvolvimento, segredos comerciais, know-how e quaisquer outras informações identificadas como confidenciais pela parte divulgadora.

2. **Obrigações de confidencialidade:** as partes concordam que:

- Manterão em sigilo absoluto todas as Informações Confidenciais recebidas.
- Não revelarão as Informações Confidenciais a terceiros sem consentimento prévio por escrito da parte divulgadora.
- Não utilizarão as Informações Confidenciais para fins diferentes daqueles relacionados à execução deste contrato.

3. **Propriedade das informações:** as Informações Confidenciais permanecerão propriedade exclusiva da parte divulgadora.

4. **Devolução das informações:** mediante solicitação por escrito da parte divulgadora, a parte receptora deverá devolver ou destruir todas as cópias das Informações Confidenciais recebidas no prazo de 7 dias.

5. **Exceções:** as obrigações de confidencialidade não se aplicarão às informações que:

- Eram de domínio público no momento da divulgação ou tornaram-se públicas sem violação deste contrato.
- Estavam em posse da parte receptora antes da divulgação.
- Foram divulgadas por terceiro que tinha direito legal de fazê-lo.
- Foram desenvolvidas independentemente pela parte receptora sem uso das Informações Confidenciais.

6. **Prazo de confidencialidade:** as obrigações permanecerão em vigor durante a vigência deste contrato e por 2 anos após seu término ou rescisão.
$md$, true),

  (v_template_id, 9, 'PRAZO E VALIDADE', $md$
1. **Início e duração:** o presente contrato vigorará de forma contínua e recorrente, com início a partir da data de sua assinatura ou aceite.

2. **Pagamento dos serviços:** o pagamento será realizado de forma mensal e contínua, no valor estabelecido conforme o plano contratado.

3. **Rescisão do contrato:** o contrato permanecerá em vigor até que uma das partes solicite a rescisão, mediante aviso prévio por escrito, de forma imediata através de e-mail. A prestação de serviços será suspensa imediatamente e os dias pagos e não utilizados serão reembolsados em prazo máximo de 7 dias, quando aplicável.
$md$, true),

  (v_template_id, 10, 'FORMA DE PAGAMENTO, COBRANÇA E VALOR', $md$
## Forma de pagamento

- O pagamento pelos serviços prestados será contínuo e recorrente, com valor mensal fixo estabelecido conforme o plano contratado.
- O pagamento inicial será proporcional aos dias restantes no mês atual e deverá ser efetuado até o dia 10 do mês seguinte, salvo condição comercial específica.
- Os pagamentos subsequentes serão realizados até o dia 10 de cada mês.
- Os pagamentos poderão ser feitos via boletos bancários, PIX ou transferência, conforme definição comercial.

## Valor do plano contratado

- O valor mensal do plano contratado será definido no resumo comercial do contrato.
- Para o Plano VIP, a referência comercial poderá ser de 1,5 salários mínimos por mês, quando essa condição estiver selecionada.

## Atraso nos pagamentos

- O não pagamento dos boletos em até 30 dias poderá levar os títulos em aberto e vencidos para protesto, conforme Lei Federal 9.492/97.
$md$, true),

  (v_template_id, 11, 'DESCUMPRIMENTO CONTRATUAL', $md$
O descumprimento de qualquer uma das cláusulas por qualquer parte implicará na possibilidade de rescisão imediata deste contrato, não isentando as partes de suas responsabilidades referentes ao zelo com informações, dados, pagamentos vencidos e obrigações já constituídas.
$md$, true),

  (v_template_id, 12, 'RESCISÃO IMEDIATA', $md$
## Direito de rescisão imediata

- Qualquer uma das partes poderá rescindir este contrato de forma imediata, mediante solicitação por e-mail.
- A prestação de serviços será suspensa imediatamente a partir do recebimento da solicitação de rescisão.

## Reembolso de dias não utilizados

- Os dias pagos e não utilizados poderão ser reembolsados em prazo máximo de 7 dias úteis, quando aplicável.
- O reembolso será proporcional ao valor pago mensalmente, dividido pelo número de dias do mês e multiplicado pelo número de dias não utilizados no mês corrente.

## Informação sobre rescisão

- A solicitação de rescisão deve ser formalizada por escrito e enviada ao endereço de e-mail patrick@ramosengenharia.info.
$md$, true),

  (v_template_id, 13, 'DISPOSIÇÕES GERAIS', $md$
1. **Inexistência de vínculo trabalhista:** as partes acordam que não há qualquer vínculo trabalhista entre a CONTRATANTE e o CONTRATADO.

2. **Alterações e aditivos:** qualquer alteração ou aditivo ao presente contrato somente terá validade se formalizado por escrito e aceito por ambas as partes.

3. **Tolerância:** a tolerância de qualquer das partes com relação ao descumprimento de qualquer termo ou condição não será considerada renúncia de direito nem representará novação.

4. **Plataformas digitais:** as partes concordam em utilizar plataformas digitais para acompanhamento e gestão dos serviços prestados, podendo também utilizar e-mail, ligações e mensagens para comunicação e troca de informações.

5. **Notificações:** todas as notificações, comunicações ou avisos previstos neste contrato serão feitos por escrito e enviados para os endereços especificados no preâmbulo deste instrumento.

6. **Lei aplicável e foro:** o presente contrato será regido e interpretado de acordo com as leis da República Federativa do Brasil, ficando eleito o foro da Comarca de Castanhal, Estado do Pará.
$md$, true),

  (v_template_id, 14, 'TERMO DE ACEITE DO CONTRATO', $md$
## Partes envolvidas

- **Contratante:** {{contratante_nome}}
- **Contratado:** Ramos Engenharia, representada por Patrick de Oliveira Ramos.

## Objeto do contrato

- Prestação de serviços profissionais pela Ramos Engenharia conforme especificado nas cláusulas deste contrato.

## Obrigações da contratante

1. Fornecer todas as informações necessárias à realização do serviço.
2. Efetuar o pagamento conforme estabelecido nas condições comerciais.
3. Arcar com taxas e despesas adicionais, tais como ART, laudos físico-químicos, taxas de licenciamento, deslocamentos da consultoria e demais despesas não incluídas.

## Obrigações do contratado

1. Prestar os serviços conforme detalhado no plano contratado.
2. Disponibilizar os meios necessários para viabilizar a prestação dos serviços.
3. Manter sigilo sobre operações, dados e documentos da contratante.
4. Responsabilizar-se pelo ônus trabalhista ou tributário referente aos funcionários utilizados.
5. Fornecer documentos fiscais referentes aos pagamentos.

## Preço e condições de pagamento

- O pagamento será contínuo e recorrente, conforme valor do plano selecionado.
- Pagamentos poderão ser realizados via boletos bancários, PIX ou transferências.

## Aceite

Ao aceitar digitalmente este contrato, a CONTRATANTE declara ter lido, compreendido e concordado com as cláusulas, condições comerciais, obrigações, prazo, validade, disposições gerais e foro.
$md$, true);
end $$;

-- VERIFICAÇÃO FINAL
select
  to_regclass('public.credit_card_invoices') as credit_card_invoices,
  to_regclass('public.credit_card_invoice_items') as credit_card_invoice_items,
  to_regclass('public.credit_card_merchant_rules') as credit_card_merchant_rules,
  to_regclass('public.credit_card_profiles') as credit_card_profiles,
  to_regclass('public.contract_templates') as contract_templates,
  to_regclass('public.contract_clauses') as contract_clauses,
  to_regclass('public.contract_documents') as contract_documents,
  to_regclass('public.contract_document_clauses') as contract_document_clauses,
  to_regclass('public.contract_acceptance_links') as contract_acceptance_links,
  to_regclass('public.contract_acceptance_events') as contract_acceptance_events;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'credit_card_invoice_items'
  and column_name in ('usage_scope','conversion_status','cliente_id','cost_center_id','converted_at','reimbursement_status','reimbursement_notes')
order by column_name;
