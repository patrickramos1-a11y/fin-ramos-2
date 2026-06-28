create table if not exists credit_card_invoices (
  id text primary key,
  competence_month integer not null check (competence_month between 1 and 12),
  competence_year integer not null,
  invoice_label text not null,
  file_name text,
  holder text,
  source_meta text not null default '{}',
  selected_cards text not null default '[]',
  total_amount_cents integer not null default 0,
  total_transactions integer not null default 0,
  status text not null default 'CONFERENCIA' check (status in ('CONFERENCIA', 'FECHADA', 'CANCELADA')),
  created_by text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists credit_card_invoice_items (
  id text primary key,
  invoice_id text not null references credit_card_invoices(id) on delete cascade,
  card_name text,
  card_final_digits text,
  card_type text,
  transaction_date text,
  description text not null,
  normalized_description text,
  merchant_key text,
  installment text,
  scope text,
  country text,
  amount_cents integer not null default 0,
  category_hint text,
  transaction_category_id text,
  account_id text,
  entity_id text,
  cliente_id text,
  cost_center_id text,
  personal_category_id text,
  notes text,
  usage_scope text not null default 'DUVIDA' check (usage_scope in ('EMPRESA', 'PESSOAL', 'DUVIDA')),
  conversion_status text not null default 'NAO_SELECIONADO' check (conversion_status in ('NAO_SELECIONADO', 'PRONTO', 'CONVERTIDO', 'IGNORADO')),
  reimbursement_status text not null default 'NAO_APLICA' check (reimbursement_status in ('NAO_APLICA', 'PENDENTE', 'REEMBOLSADO')),
  reimbursement_notes text,
  review_status text not null default 'PENDENTE',
  transaction_id text,
  converted_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_credit_card_items_invoice_id on credit_card_invoice_items(invoice_id);
create index if not exists idx_credit_card_items_card on credit_card_invoice_items(card_name, card_final_digits);
create index if not exists idx_credit_card_items_merchant on credit_card_invoice_items(merchant_key);
create index if not exists idx_credit_card_items_conversion on credit_card_invoice_items(usage_scope, conversion_status);

create table if not exists credit_card_profiles (
  id text primary key,
  card_name text not null,
  card_final_digits text,
  owner_name text,
  profile_type text not null default 'NAO_CONFIGURADO' check (profile_type in ('EMPRESA', 'PESSOAL', 'NAO_CONFIGURADO')),
  color text,
  active integer not null default 1,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (card_name, card_final_digits)
);

create table if not exists credit_card_merchant_rules (
  id text primary key,
  merchant_key text not null unique,
  merchant_label text not null,
  transaction_category_id text,
  personal_category_id text,
  usage_scope text not null default 'DUVIDA' check (usage_scope in ('EMPRESA', 'PESSOAL', 'DUVIDA')),
  active integer not null default 1,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists credit_card_personal_categories (
  id text primary key,
  name text not null unique,
  color text,
  icon text,
  active integer not null default 1,
  display_order integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists contract_templates (
  id text primary key,
  name text not null,
  service_type text,
  description text,
  cover_title text,
  cover_subtitle text,
  cover_image_key text,
  active integer not null default 1,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists contract_clauses (
  id text primary key,
  template_id text not null references contract_templates(id) on delete cascade,
  title text not null,
  body text not null,
  display_order integer not null default 0,
  active integer not null default 1,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_contract_clauses_template on contract_clauses(template_id, display_order);

create table if not exists contract_documents (
  id text primary key,
  template_id text references contract_templates(id),
  title text not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'em_revisao', 'aguardando_aceite', 'aceito', 'cancelado')),
  contractor_type text not null check (contractor_type in ('pessoa_juridica', 'pessoa_fisica')),
  contractor_name text not null,
  contractor_document text not null,
  contractor_email text,
  contractor_phone text,
  contractor_address text,
  contractor_responsible text,
  plan_name text,
  plan_value_cents integer not null default 0,
  payment_terms text,
  start_date text,
  end_date text,
  digital_snapshot text not null default '{}',
  accepted_at text,
  created_by text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists contract_document_clauses (
  id text primary key,
  document_id text not null references contract_documents(id) on delete cascade,
  source_clause_id text,
  title text not null,
  body text not null,
  display_order integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_contract_document_clauses_document on contract_document_clauses(document_id, display_order);

create table if not exists contract_acceptance_links (
  id text primary key,
  document_id text not null references contract_documents(id) on delete cascade,
  token text not null unique,
  status text not null default 'ativo' check (status in ('ativo', 'aceito', 'expirado', 'cancelado')),
  expires_at text,
  accepted_at text,
  accepted_name text,
  accepted_document text,
  accepted_email text,
  accepted_ip text,
  accepted_user_agent text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists contract_acceptance_events (
  id text primary key,
  document_id text not null references contract_documents(id) on delete cascade,
  acceptance_link_id text references contract_acceptance_links(id),
  event_type text not null,
  actor_name text,
  actor_document text,
  actor_email text,
  ip text,
  user_agent text,
  metadata text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

insert into credit_card_personal_categories (id, name, color, icon, display_order)
values
  ('personal-alimentacao', 'Alimentacao', '#10b981', 'utensils', 10),
  ('personal-transporte', 'Transporte', '#f97316', 'car', 20),
  ('personal-saude', 'Saude', '#ef4444', 'heart-pulse', 30),
  ('personal-assinaturas', 'Assinaturas / Digital', '#6366f1', 'refresh-cw', 40),
  ('personal-viagem', 'Viagem', '#0ea5e9', 'plane', 50),
  ('personal-compras', 'Compras / Varejo', '#a855f7', 'shopping-bag', 60),
  ('personal-outros', 'Outros', '#64748b', 'tag', 999)
on conflict(name) do nothing;

insert into contract_templates (id, name, service_type, description, cover_title, cover_subtitle, active)
values (
  'template-vip-consultoria-ambiental',
  'Contrato VIP - Consultoria Ambiental',
  'consultoria_ambiental',
  'Modelo base para contratos digitais de consultoria ambiental da Ramos Engenharia.',
  'Contrato de Prestacao de Servicos',
  'Ramos Engenharia - Consulting & Solutions',
  1
)
on conflict(id) do nothing;

insert into contract_clauses (id, template_id, title, body, display_order, active)
values
  ('clause-vip-001', 'template-vip-consultoria-ambiental', 'Objeto', 'O presente contrato tem por objeto a prestacao de servicos tecnicos de consultoria ambiental, conforme escopo comercial aprovado entre as partes.', 10, 1),
  ('clause-vip-002', 'template-vip-consultoria-ambiental', 'Responsabilidades das partes', 'A contratada executara as atividades tecnicas previstas no escopo contratado, enquanto a contratante devera fornecer informacoes, documentos e acessos necessarios para a adequada prestacao dos servicos.', 20, 1),
  ('clause-vip-003', 'template-vip-consultoria-ambiental', 'Valores e condicoes de pagamento', 'Os valores, planos, descontos e condicoes de pagamento serao definidos no resumo comercial vinculado a este contrato digital.', 30, 1),
  ('clause-vip-004', 'template-vip-consultoria-ambiental', 'Vigencia', 'A vigencia do contrato sera definida no momento da geracao do documento, podendo ser por prazo determinado, recorrente ou sem prazo final previamente estabelecido.', 40, 1),
  ('clause-vip-005', 'template-vip-consultoria-ambiental', 'Aceite digital', 'O aceite digital registra a ciencia e concordancia operacional da contratante com os termos apresentados, incluindo data, hora, identificacao e trilha de auditoria.', 50, 1)
on conflict(id) do nothing;

insert into cf_meta (name, value, updated_at)
values ('schema_version', '0002_cards_contracts_pilot', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
on conflict(name) do update set value = excluded.value, updated_at = excluded.updated_at;
