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
