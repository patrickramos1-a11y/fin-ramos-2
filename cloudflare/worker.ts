type D1Result<T = unknown> = {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: unknown;
};

type D1RunResult = {
  success: boolean;
  error?: string;
  meta?: unknown;
};

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1RunResult>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type R2Bucket = unknown;

type Env = {
  DB: D1Database;
  FILES: R2Bucket;
  APP_ENV?: string;
  APP_VERSION?: string;
};

type JsonRecord = Record<string, unknown>;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init.headers ?? {}),
    },
  });
}

function notFound(pathname: string) {
  return jsonResponse(
    {
      ok: false,
      error: "not_found",
      message: `No Cloudflare API route registered for ${pathname}`,
    },
    { status: 404 },
  );
}

function badRequest(message: string, details?: unknown) {
  return jsonResponse({ ok: false, error: "bad_request", message, details }, { status: 400 });
}

function serverError(message: string, details?: unknown) {
  return jsonResponse({ ok: false, error: "server_error", message, details }, { status: 500 });
}

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  return crypto.randomUUID();
}

function centsFromValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }

  return 0;
}

async function readJson(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return {};
  const text = await request.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as JsonRecord;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function normalizeMerchant(description: unknown) {
  return String(description ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\d{1,2}\/\d{1,2}|\d+/g, " ")
    .replace(/[^a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function bindList(values: unknown[]) {
  return values.length ? values.map(() => "?").join(", ") : "null";
}

async function dbCheck(env: Env) {
  const result = await env.DB.prepare(
    "select name, value, updated_at from cf_meta where name = 'schema_version' limit 1",
  ).all<{ name: string; value: string; updated_at: string }>();

  if (!result.success) {
    return serverError("D1 query failed", result.error);
  }

  return jsonResponse({
    ok: true,
    database: "d1",
    schema: result.results?.[0] ?? null,
  });
}

async function listCardInvoices(env: Env) {
  const result = await env.DB.prepare(
    `select *
       from credit_card_invoices
      order by competence_year desc, competence_month desc, created_at desc`,
  ).all();

  if (!result.success) return serverError("Unable to list card invoices", result.error);
  return jsonResponse({ ok: true, invoices: result.results ?? [] });
}

async function createCardInvoice(request: Request, env: Env) {
  const body = await readJson(request);
  const id = String(body.id ?? uuid());
  const competenceMonth = Number(body.competence_month ?? body.competenceMonth);
  const competenceYear = Number(body.competence_year ?? body.competenceYear);
  const invoiceLabel = String(body.invoice_label ?? body.invoiceLabel ?? "Fatura sem nome");
  const items = Array.isArray(body.items) ? body.items : [];
  const createdAt = nowIso();
  const totalAmountCents =
    typeof body.total_amount_cents === "number"
      ? body.total_amount_cents
      : items.reduce((sum, item) => sum + centsFromValue((item as JsonRecord).amount), 0);

  if (!competenceMonth || !competenceYear) {
    return badRequest("competence_month and competence_year are required");
  }

  const invoiceResult = await env.DB.prepare(
    `insert into credit_card_invoices (
       id, competence_month, competence_year, invoice_label, file_name, holder,
       source_meta, selected_cards, total_amount_cents, total_transactions,
       status, created_by, created_at, updated_at
     ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      competenceMonth,
      competenceYear,
      invoiceLabel,
      body.file_name ?? body.fileName ?? null,
      body.holder ?? null,
      JSON.stringify(body.source_meta ?? body.sourceMeta ?? {}),
      JSON.stringify(body.selected_cards ?? body.selectedCards ?? []),
      totalAmountCents,
      Number(body.total_transactions ?? body.totalTransactions ?? items.length),
      body.status ?? "CONFERENCIA",
      body.created_by ?? body.createdBy ?? null,
      createdAt,
      createdAt,
    )
    .run();

  if (!invoiceResult.success) {
    return serverError("Unable to create card invoice", invoiceResult.error);
  }

  for (const rawItem of items) {
    const item = rawItem as JsonRecord;
    const description = String(item.description ?? "Lancamento sem descricao");
    const merchantKey = String(item.merchant_key ?? item.merchantKey ?? normalizeMerchant(description));
    const itemId = String(item.id ?? uuid());

    const itemResult = await env.DB.prepare(
      `insert into credit_card_invoice_items (
         id, invoice_id, card_name, card_final_digits, card_type, transaction_date,
         description, normalized_description, merchant_key, installment, scope, country,
         amount_cents, category_hint, transaction_category_id, account_id, entity_id,
         cliente_id, cost_center_id, personal_category_id, notes, usage_scope,
         conversion_status, reimbursement_status, review_status, transaction_id,
         converted_at, created_at, updated_at
       ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        itemId,
        id,
        item.card_name ?? item.cardName ?? null,
        item.card_final_digits ?? item.cardFinalDigits ?? null,
        item.card_type ?? item.cardType ?? null,
        item.transaction_date ?? item.transactionDate ?? null,
        description,
        item.normalized_description ?? item.normalizedDescription ?? merchantKey,
        merchantKey,
        item.installment ?? null,
        item.scope ?? null,
        item.country ?? null,
        typeof item.amount_cents === "number" ? item.amount_cents : centsFromValue(item.amount),
        item.category_hint ?? item.categoryHint ?? null,
        item.transaction_category_id ?? item.transactionCategoryId ?? null,
        item.account_id ?? item.accountId ?? null,
        item.entity_id ?? item.entityId ?? null,
        item.cliente_id ?? item.clienteId ?? null,
        item.cost_center_id ?? item.costCenterId ?? null,
        item.personal_category_id ?? item.personalCategoryId ?? null,
        item.notes ?? null,
        item.usage_scope ?? item.usageScope ?? "DUVIDA",
        item.conversion_status ?? item.conversionStatus ?? "NAO_SELECIONADO",
        item.reimbursement_status ?? item.reimbursementStatus ?? "NAO_APLICA",
        item.review_status ?? item.reviewStatus ?? "PENDENTE",
        item.transaction_id ?? item.transactionId ?? null,
        item.converted_at ?? item.convertedAt ?? null,
        createdAt,
        createdAt,
      )
      .run();

    if (!itemResult.success) {
      return serverError("Card invoice was created, but one item failed", {
        itemId,
        error: itemResult.error,
      });
    }
  }

  return jsonResponse({ ok: true, invoice: { id, item_count: items.length } }, { status: 201 });
}

async function listCardInvoiceItems(env: Env, invoiceId: string) {
  const result = await env.DB.prepare(
    `select *
       from credit_card_invoice_items
      where invoice_id = ?
      order by transaction_date asc, description asc`,
  )
    .bind(invoiceId)
    .all();

  if (!result.success) return serverError("Unable to list card invoice items", result.error);
  return jsonResponse({ ok: true, items: result.results ?? [] });
}

async function bulkPatchCardItems(request: Request, env: Env) {
  const body = await readJson(request);
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  const patch = (body.patch ?? {}) as JsonRecord;
  const allowed = new Set([
    "usage_scope",
    "conversion_status",
    "transaction_category_id",
    "account_id",
    "entity_id",
    "cliente_id",
    "cost_center_id",
    "personal_category_id",
    "notes",
    "reimbursement_status",
    "reimbursement_notes",
    "review_status",
  ]);
  const entries = Object.entries(patch).filter(([key, value]) => allowed.has(key) && value !== undefined);

  if (!ids.length) return badRequest("At least one item id is required");
  if (!entries.length) return badRequest("At least one allowed patch field is required");

  const setClause = entries.map(([key]) => `${key} = ?`).concat("updated_at = ?").join(", ");
  const values = entries.map(([, value]) => value);
  const timestamp = nowIso();

  for (const id of ids) {
    const result = await env.DB.prepare(`update credit_card_invoice_items set ${setClause} where id = ?`)
      .bind(...values, timestamp, id)
      .run();
    if (!result.success) return serverError("Unable to update card item", { id, error: result.error });
  }

  return jsonResponse({ ok: true, updated: ids.length });
}

async function listPersonalCategories(env: Env) {
  const result = await env.DB.prepare(
    `select *
       from credit_card_personal_categories
      where active = 1
      order by display_order asc, name asc`,
  ).all();

  if (!result.success) return serverError("Unable to list personal categories", result.error);
  return jsonResponse({ ok: true, categories: result.results ?? [] });
}

async function createPersonalCategory(request: Request, env: Env) {
  const body = await readJson(request);
  const name = String(body.name ?? "").trim();
  if (!name) return badRequest("name is required");

  const id = String(body.id ?? uuid());
  const timestamp = nowIso();
  const result = await env.DB.prepare(
    `insert into credit_card_personal_categories (id, name, color, icon, display_order, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?)
     on conflict(name) do update set
       color = excluded.color,
       icon = excluded.icon,
       display_order = excluded.display_order,
       active = 1,
       updated_at = excluded.updated_at`,
  )
    .bind(id, name, body.color ?? null, body.icon ?? null, Number(body.display_order ?? 0), timestamp, timestamp)
    .run();

  if (!result.success) return serverError("Unable to save personal category", result.error);
  return jsonResponse({ ok: true, category: { id, name } }, { status: 201 });
}

async function listMerchantRules(env: Env) {
  const result = await env.DB.prepare(
    `select *
       from credit_card_merchant_rules
      where active = 1
      order by merchant_label asc`,
  ).all();

  if (!result.success) return serverError("Unable to list merchant rules", result.error);
  return jsonResponse({ ok: true, rules: result.results ?? [] });
}

async function upsertMerchantRule(request: Request, env: Env) {
  const body = await readJson(request);
  const merchantKey = String(body.merchant_key ?? body.merchantKey ?? "").trim().toUpperCase();
  const merchantLabel = String(body.merchant_label ?? body.merchantLabel ?? merchantKey).trim();

  if (!merchantKey) return badRequest("merchant_key is required");

  const id = String(body.id ?? uuid());
  const timestamp = nowIso();
  const result = await env.DB.prepare(
    `insert into credit_card_merchant_rules (
       id, merchant_key, merchant_label, transaction_category_id, personal_category_id,
       usage_scope, active, created_at, updated_at
     ) values (?, ?, ?, ?, ?, ?, 1, ?, ?)
     on conflict(merchant_key) do update set
       merchant_label = excluded.merchant_label,
       transaction_category_id = excluded.transaction_category_id,
       personal_category_id = excluded.personal_category_id,
       usage_scope = excluded.usage_scope,
       active = 1,
       updated_at = excluded.updated_at`,
  )
    .bind(
      id,
      merchantKey,
      merchantLabel,
      body.transaction_category_id ?? body.transactionCategoryId ?? null,
      body.personal_category_id ?? body.personalCategoryId ?? null,
      body.usage_scope ?? body.usageScope ?? "DUVIDA",
      timestamp,
      timestamp,
    )
    .run();

  if (!result.success) return serverError("Unable to save merchant rule", result.error);
  return jsonResponse({ ok: true, rule: { id, merchant_key: merchantKey } }, { status: 201 });
}

async function previewCardTransactions(request: Request, env: Env) {
  const body = await readJson(request);
  const invoiceIds = Array.isArray(body.invoice_ids ?? body.invoiceIds)
    ? ((body.invoice_ids ?? body.invoiceIds) as unknown[]).map(String)
    : [];
  const where = invoiceIds.length ? `and invoice_id in (${bindList(invoiceIds)})` : "";
  const result = await env.DB.prepare(
    `select invoice_id, card_name, card_final_digits, transaction_category_id, count(*) as item_count,
            sum(amount_cents) as total_amount_cents
       from credit_card_invoice_items
      where usage_scope = 'EMPRESA'
        and conversion_status = 'PRONTO'
        and transaction_id is null
        ${where}
      group by invoice_id, card_name, card_final_digits, transaction_category_id
      order by card_name asc, transaction_category_id asc`,
  )
    .bind(...invoiceIds)
    .all();

  if (!result.success) return serverError("Unable to preview card transactions", result.error);
  return jsonResponse({ ok: true, groups: result.results ?? [] });
}

async function listContractTemplates(env: Env) {
  const result = await env.DB.prepare(
    `select *
       from contract_templates
      where active = 1
      order by updated_at desc, name asc`,
  ).all();

  if (!result.success) return serverError("Unable to list contract templates", result.error);
  return jsonResponse({ ok: true, templates: result.results ?? [] });
}

async function createContractTemplate(request: Request, env: Env) {
  const body = await readJson(request);
  const name = String(body.name ?? "").trim();
  if (!name) return badRequest("name is required");

  const id = String(body.id ?? uuid());
  const timestamp = nowIso();
  const result = await env.DB.prepare(
    `insert into contract_templates (
       id, name, service_type, description, cover_title, cover_subtitle,
       cover_image_key, active, created_at, updated_at
     ) values (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  )
    .bind(
      id,
      name,
      body.service_type ?? body.serviceType ?? null,
      body.description ?? null,
      body.cover_title ?? body.coverTitle ?? null,
      body.cover_subtitle ?? body.coverSubtitle ?? null,
      body.cover_image_key ?? body.coverImageKey ?? null,
      timestamp,
      timestamp,
    )
    .run();

  if (!result.success) return serverError("Unable to create contract template", result.error);
  return jsonResponse({ ok: true, template: { id, name } }, { status: 201 });
}

async function listTemplateClauses(env: Env, templateId: string) {
  const result = await env.DB.prepare(
    `select *
       from contract_clauses
      where template_id = ? and active = 1
      order by display_order asc, title asc`,
  )
    .bind(templateId)
    .all();

  if (!result.success) return serverError("Unable to list template clauses", result.error);
  return jsonResponse({ ok: true, clauses: result.results ?? [] });
}

async function listContractDocuments(env: Env) {
  const result = await env.DB.prepare(
    `select *
       from contract_documents
      order by created_at desc`,
  ).all();

  if (!result.success) return serverError("Unable to list contract documents", result.error);
  return jsonResponse({ ok: true, documents: result.results ?? [] });
}

async function listContractDocumentClauses(env: Env, documentId: string) {
  const result = await env.DB.prepare(
    `select *
       from contract_document_clauses
      where document_id = ?
      order by display_order asc`,
  )
    .bind(documentId)
    .all();

  if (!result.success) return serverError("Unable to list contract document clauses", result.error);
  return jsonResponse({ ok: true, clauses: result.results ?? [] });
}

async function updateContractClause(request: Request, env: Env, clauseId: string) {
  const body = await readJson(request);
  const updates = ((body.updates ?? body) as JsonRecord) ?? {};
  const allowed = new Set(["title", "body", "display_order", "active"]);
  const entries = Object.entries(updates).filter(([key, value]) => allowed.has(key) && value !== undefined);

  if (!entries.length) return badRequest("At least one allowed clause field is required");

  const setClause = entries.map(([key]) => `${key} = ?`).concat("updated_at = ?").join(", ");
  const values = entries.map(([, value]) => value);
  const result = await env.DB.prepare(`update contract_clauses set ${setClause} where id = ?`)
    .bind(...values, nowIso(), clauseId)
    .run();

  if (!result.success) return serverError("Unable to update contract clause", result.error);

  const clause = await env.DB.prepare("select * from contract_clauses where id = ? limit 1")
    .bind(clauseId)
    .first();
  return jsonResponse({ ok: true, clause });
}

async function createContractDocument(request: Request, env: Env) {
  const body = await readJson(request);
  const title = String(body.title ?? "").trim();
  const contractorType = String(body.contractor_type ?? body.contractorType ?? "");
  const contractorName = String(body.contractor_name ?? body.contractorName ?? "").trim();
  const contractorDocument = String(body.contractor_document ?? body.contractorDocument ?? "").trim();

  if (!title) return badRequest("title is required");
  if (!["pessoa_juridica", "pessoa_fisica"].includes(contractorType)) {
    return badRequest("contractor_type must be pessoa_juridica or pessoa_fisica");
  }
  if (!contractorName || !contractorDocument) {
    return badRequest("contractor_name and contractor_document are required");
  }

  const id = String(body.id ?? uuid());
  const templateId = body.template_id ?? body.templateId ?? null;
  const timestamp = nowIso();
  const planValueCents =
    typeof body.plan_value_cents === "number"
      ? body.plan_value_cents
      : centsFromValue(body.plan_value ?? body.planValue);

  const result = await env.DB.prepare(
    `insert into contract_documents (
       id, template_id, title, status, contractor_type, contractor_name,
       contractor_document, contractor_email, contractor_phone, contractor_address,
       contractor_responsible, plan_name, plan_value_cents, payment_terms,
       start_date, end_date, digital_snapshot, created_by, created_at, updated_at
     ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      templateId,
      title,
      body.status ?? "rascunho",
      contractorType,
      contractorName,
      contractorDocument,
      body.contractor_email ?? body.contractorEmail ?? null,
      body.contractor_phone ?? body.contractorPhone ?? null,
      body.contractor_address ?? body.contractorAddress ?? null,
      body.contractor_responsible ?? body.contractorResponsible ?? null,
      body.plan_name ?? body.planName ?? null,
      planValueCents,
      body.payment_terms ?? body.paymentTerms ?? null,
      body.start_date ?? body.startDate ?? null,
      body.end_date ?? body.endDate ?? null,
      JSON.stringify(body.digital_snapshot ?? body.digitalSnapshot ?? {}),
      body.created_by ?? body.createdBy ?? null,
      timestamp,
      timestamp,
    )
    .run();

  if (!result.success) return serverError("Unable to create contract document", result.error);

  const selectedClauseIds = Array.isArray(body.selected_clause_ids ?? body.selectedClauseIds)
    ? ((body.selected_clause_ids ?? body.selectedClauseIds) as unknown[]).map(String).filter(Boolean)
    : [];
  const providedClauses = Array.isArray(body.clauses) ? body.clauses : null;
  const clauses =
    providedClauses ??
    (
      await env.DB.prepare(
        `select id as source_clause_id, title, body, display_order
           from contract_clauses
          where template_id = ? and active = 1
            ${selectedClauseIds.length ? `and id in (${bindList(selectedClauseIds)})` : ""}
          order by display_order asc`,
      )
        .bind(templateId, ...selectedClauseIds)
        .all<JsonRecord>()
    ).results ??
    [];

  for (const rawClause of clauses as JsonRecord[]) {
    const clauseId = String(rawClause.id ?? uuid());
    const clauseResult = await env.DB.prepare(
      `insert into contract_document_clauses (
         id, document_id, source_clause_id, title, body, display_order, created_at
       ) values (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        clauseId,
        id,
        rawClause.source_clause_id ?? rawClause.sourceClauseId ?? null,
        rawClause.title ?? "Clausula",
        rawClause.body ?? "",
        Number(rawClause.display_order ?? rawClause.displayOrder ?? 0),
        timestamp,
      )
      .run();

    if (!clauseResult.success) {
      return serverError("Contract document was created, but one clause failed", clauseResult.error);
    }
  }

  return jsonResponse({ ok: true, document: { id, clause_count: clauses.length } }, { status: 201 });
}

async function createAcceptanceLink(env: Env, documentId: string) {
  const document = await env.DB.prepare("select id from contract_documents where id = ? limit 1")
    .bind(documentId)
    .first<{ id: string }>();

  if (!document) return badRequest("contract document not found");

  const id = uuid();
  const token = uuid().replace(/-/g, "");
  const timestamp = nowIso();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString();
  const result = await env.DB.prepare(
    `insert into contract_acceptance_links (id, document_id, token, status, expires_at, created_at)
     values (?, ?, ?, 'ativo', ?, ?)`,
  )
    .bind(id, documentId, token, expiresAt, timestamp)
    .run();

  if (!result.success) return serverError("Unable to create acceptance link", result.error);

  await env.DB.prepare("update contract_documents set status = 'aguardando_aceite', updated_at = ? where id = ?")
    .bind(timestamp, documentId)
    .run();

  return jsonResponse({
    ok: true,
    link: {
      id,
      document_id: documentId,
      token,
      expires_at: expiresAt,
      path: `/contratos/aceite/${token}`,
    },
  });
}

async function getPublicContract(env: Env, token: string) {
  const link = await env.DB.prepare(
    `select *
       from contract_acceptance_links
      where token = ? and status = 'ativo'
      limit 1`,
  )
    .bind(token)
    .first<JsonRecord>();

  if (!link) return notFound("/api/public/contracts/accept/:token");

  const document = await env.DB.prepare("select * from contract_documents where id = ? limit 1")
    .bind(link.document_id)
    .first<JsonRecord>();
  const clauses = await env.DB.prepare(
    `select *
       from contract_document_clauses
      where document_id = ?
      order by display_order asc`,
  )
    .bind(link.document_id)
    .all<JsonRecord>();

  return jsonResponse({ ok: true, link, document, clauses: clauses.results ?? [] });
}

async function acceptPublicContract(request: Request, env: Env, token: string) {
  const body = await readJson(request);
  const link = await env.DB.prepare(
    `select *
       from contract_acceptance_links
      where token = ? and status = 'ativo'
      limit 1`,
  )
    .bind(token)
    .first<JsonRecord>();

  if (!link) return notFound("/api/public/contracts/accept/:token");

  const timestamp = nowIso();
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? null;
  const userAgent = request.headers.get("user-agent");
  const acceptedName = body.accepted_name ?? body.acceptedName ?? body.name ?? null;
  const acceptedDocument = body.accepted_document ?? body.acceptedDocument ?? body.document ?? null;
  const acceptedEmail = body.accepted_email ?? body.acceptedEmail ?? body.email ?? null;

  const updateLink = await env.DB.prepare(
    `update contract_acceptance_links
        set status = 'aceito',
            accepted_at = ?,
            accepted_name = ?,
            accepted_document = ?,
            accepted_email = ?,
            accepted_ip = ?,
            accepted_user_agent = ?
      where token = ?`,
  )
    .bind(timestamp, acceptedName, acceptedDocument, acceptedEmail, ip, userAgent, token)
    .run();

  if (!updateLink.success) return serverError("Unable to accept contract link", updateLink.error);

  await env.DB.prepare("update contract_documents set status = 'aceito', accepted_at = ?, updated_at = ? where id = ?")
    .bind(timestamp, timestamp, link.document_id)
    .run();

  await env.DB.prepare(
    `insert into contract_acceptance_events (
       id, document_id, acceptance_link_id, event_type, actor_name, actor_document,
       actor_email, ip, user_agent, metadata, created_at
     ) values (?, ?, ?, 'accepted', ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      uuid(),
      link.document_id,
      link.id,
      acceptedName,
      acceptedDocument,
      acceptedEmail,
      ip,
      userAgent,
      JSON.stringify(body.metadata ?? {}),
      timestamp,
    )
    .run();

  return jsonResponse({ ok: true, accepted_at: timestamp });
}

async function handleCards(request: Request, env: Env, segments: string[]) {
  if (request.method === "GET" && segments.length === 2 && segments[1] === "invoices") {
    return listCardInvoices(env);
  }

  if (request.method === "POST" && segments.length === 2 && segments[1] === "invoices") {
    return createCardInvoice(request, env);
  }

  if (request.method === "GET" && segments.length === 4 && segments[1] === "invoices" && segments[3] === "items") {
    return listCardInvoiceItems(env, segments[2]);
  }

  if (request.method === "PATCH" && segments.join("/") === "cards/items/bulk") {
    return bulkPatchCardItems(request, env);
  }

  if (request.method === "GET" && segments.join("/") === "cards/personal-categories") {
    return listPersonalCategories(env);
  }

  if (request.method === "POST" && segments.join("/") === "cards/personal-categories") {
    return createPersonalCategory(request, env);
  }

  if (request.method === "GET" && segments.join("/") === "cards/merchant-rules") {
    return listMerchantRules(env);
  }

  if (request.method === "POST" && segments.join("/") === "cards/merchant-rules") {
    return upsertMerchantRule(request, env);
  }

  if (request.method === "POST" && segments.join("/") === "cards/preview-transactions") {
    return previewCardTransactions(request, env);
  }

  return null;
}

async function handleContracts(request: Request, env: Env, segments: string[]) {
  if (request.method === "GET" && segments.join("/") === "contracts/templates") {
    return listContractTemplates(env);
  }

  if (request.method === "POST" && segments.join("/") === "contracts/templates") {
    return createContractTemplate(request, env);
  }

  if (request.method === "GET" && segments.length === 4 && segments[1] === "templates" && segments[3] === "clauses") {
    return listTemplateClauses(env, segments[2]);
  }

  if (request.method === "GET" && segments.join("/") === "contracts/documents") {
    return listContractDocuments(env);
  }

  if (request.method === "POST" && segments.join("/") === "contracts/documents") {
    return createContractDocument(request, env);
  }

  if (request.method === "GET" && segments.length === 4 && segments[1] === "documents" && segments[3] === "clauses") {
    return listContractDocumentClauses(env, segments[2]);
  }

  if (request.method === "PATCH" && segments.length === 3 && segments[1] === "clauses") {
    return updateContractClause(request, env, segments[2]);
  }

  if (
    request.method === "POST" &&
    segments.length === 4 &&
    segments[1] === "documents" &&
    segments[3] === "acceptance-link"
  ) {
    return createAcceptanceLink(env, segments[2]);
  }

  return null;
}

async function handlePublicContracts(request: Request, env: Env, segments: string[]) {
  if (segments.length === 4 && segments[0] === "public" && segments[1] === "contracts" && segments[2] === "accept") {
    if (request.method === "GET") return getPublicContract(env, segments[3]);
    if (request.method === "POST") return acceptPublicContract(request, env, segments[3]);
  }

  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "content-type,authorization",
        },
      });
    }

    try {
      if (url.pathname === "/api/health") {
        return jsonResponse({
          ok: true,
          service: "fin-ramos-api",
          environment: env.APP_ENV ?? "unknown",
          timestamp: new Date().toISOString(),
        });
      }

      if (url.pathname === "/api/version") {
        return jsonResponse({
          ok: true,
          version: env.APP_VERSION ?? "unknown",
          runtime: "cloudflare-workers",
        });
      }

      if (url.pathname === "/api/db-check") {
        return dbCheck(env);
      }

      const segments = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
      const publicResponse = await handlePublicContracts(request, env, segments);
      if (publicResponse) return publicResponse;

      if (segments[0] === "cards") {
        const response = await handleCards(request, env, segments);
        if (response) return response;
      }

      if (segments[0] === "contracts") {
        const response = await handleContracts(request, env, segments);
        if (response) return response;
      }

      return notFound(url.pathname);
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid JSON body") {
        return badRequest(error.message);
      }

      return serverError("Unhandled Worker error", error instanceof Error ? error.message : String(error));
    }
  },
};
