import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_WORKER_URL = "https://fin-ramos-api.patrickramos1-a11y.workers.dev";

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  try {
    const text = fs.readFileSync(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Some Codex sandboxes intentionally block direct .env reads. Env vars can still be passed explicitly.
  }
}

function argValue(name) {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeCents(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }
  return 0;
}

function centsFromRow(row, centsField, amountField) {
  if (typeof row?.[centsField] === "number") return row[centsField];
  return normalizeCents(row?.[amountField]);
}

function groupRows(rows, keyFn, valueFn = () => 1) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFn(row) || "SEM_VALOR";
    const current = grouped.get(key) ?? { key, count: 0, total_amount_cents: 0 };
    current.count += 1;
    current.total_amount_cents += valueFn(row);
    grouped.set(key, current);
  }
  return Array.from(grouped.values()).sort((a, b) => String(a.key).localeCompare(String(b.key)));
}

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: token ? { "x-migration-token": token } : undefined,
  });
  const body = await response.text();
  let parsed;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = { raw: body };
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

function describeError(error) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const parts = [error.message, error.details, error.hint, error.code].filter(Boolean);
    if (parts.length) return parts.join(" | ");
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

async function safe(label, fn) {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, label, error: describeError(error) };
  }
}

async function fetchAll(supabase, table, columns) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select(columns).range(from, to);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function countTable(supabase, table) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function supabaseCardsSummary(supabase) {
  const invoices = await fetchAll(
    supabase,
    "credit_card_invoices",
    "id, competence_month, competence_year, total_amount, total_transactions, status",
  );
  const items = await fetchAll(
    supabase,
    "credit_card_invoice_items",
    "id, invoice_id, amount, usage_scope, conversion_status, reimbursement_status, transaction_category_id, transaction_id",
  );

  return {
    invoices: {
      invoice_count: invoices.length,
      total_amount_cents: invoices.reduce((sum, row) => sum + centsFromRow(row, "total_amount_cents", "total_amount"), 0),
      total_transactions: invoices.reduce((sum, row) => sum + Number(row.total_transactions ?? 0), 0),
    },
    items: {
      item_count: items.length,
      total_amount_cents: items.reduce((sum, row) => sum + centsFromRow(row, "amount_cents", "amount"), 0),
      converted_count: items.filter((row) => row.conversion_status === "CONVERTIDO" || row.transaction_id).length,
      ready_count: items.filter((row) => row.conversion_status === "PRONTO").length,
      missing_category_count: items.filter((row) => row.usage_scope === "EMPRESA" && !row.transaction_category_id).length,
    },
    by_invoice_status: groupRows(invoices, (row) => row.status, (row) => centsFromRow(row, "total_amount_cents", "total_amount")),
    by_item_scope: groupRows(items, (row) => row.usage_scope, (row) => centsFromRow(row, "amount_cents", "amount")),
    by_conversion_status: groupRows(items, (row) => row.conversion_status, (row) => centsFromRow(row, "amount_cents", "amount")),
    profile_count: await countTable(supabase, "credit_card_profiles"),
    merchant_rule_count: await countTable(supabase, "credit_card_merchant_rules"),
    personal_category_count: await countTable(supabase, "credit_card_personal_categories"),
  };
}

async function supabaseContractsSummary(supabase) {
  const documents = await fetchAll(
    supabase,
    "contract_documents",
    "id, status, contractor_type, plan_value",
  );

  return {
    templates: await countTable(supabase, "contract_templates"),
    reusable_clauses: await countTable(supabase, "contract_clauses"),
    documents: {
      count: documents.length,
      plan_value_cents: documents.reduce((sum, row) => sum + centsFromRow(row, "plan_value_cents", "plan_value"), 0),
    },
    frozen_clauses: await countTable(supabase, "contract_document_clauses"),
    acceptance_links: await countTable(supabase, "contract_acceptance_links"),
    acceptance_events: await countTable(supabase, "contract_acceptance_events"),
    documents_by_status: groupRows(documents, (row) => row.status, (row) => centsFromRow(row, "plan_value_cents", "plan_value")),
    documents_by_contractor_type: groupRows(documents, (row) => row.contractor_type),
  };
}

function compareNumber(label, left, right) {
  return {
    label,
    supabase: left,
    cloudflare: right,
    diff: Number(right ?? 0) - Number(left ?? 0),
    match: Number(left ?? 0) === Number(right ?? 0),
  };
}

async function main() {
  loadDotEnv();

  const cloudflareUrl =
    argValue("--cloudflare-url") ||
    process.env.VITE_CLOUDFLARE_API_URL ||
    process.env.CLOUDFLARE_API_URL ||
    DEFAULT_WORKER_URL;
  const auditToken = argValue("--token") || process.env.MIGRATION_AUDIT_TOKEN || "";
  const writePath = argValue("--write");
  const strict = process.argv.includes("--strict");

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  const cloudflareCards = await safe("cloudflare_cards_summary", () =>
    fetchJson(`${cloudflareUrl.replace(/\/$/, "")}/api/migration/cards/summary`, auditToken),
  );
  const cloudflareContracts = await safe("cloudflare_contracts_summary", () =>
    fetchJson(`${cloudflareUrl.replace(/\/$/, "")}/api/migration/contracts/summary`, auditToken),
  );

  let supabaseCards = { ok: false, error: "Missing VITE_SUPABASE_URL/SUPABASE_URL or Supabase key" };
  let supabaseContracts = supabaseCards;
  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    supabaseCards = await safe("supabase_cards_summary", () => supabaseCardsSummary(supabase));
    supabaseContracts = await safe("supabase_contracts_summary", () => supabaseContractsSummary(supabase));
  }

  const comparisons = [];
  if (supabaseCards.ok && cloudflareCards.ok) {
    comparisons.push(
      compareNumber(
        "cards.invoice_count",
        supabaseCards.data.invoices.invoice_count,
        cloudflareCards.data.cards?.totals?.invoices?.invoice_count,
      ),
      compareNumber(
        "cards.invoice_total_amount_cents",
        supabaseCards.data.invoices.total_amount_cents,
        cloudflareCards.data.cards?.totals?.invoices?.total_amount_cents,
      ),
      compareNumber(
        "cards.item_count",
        supabaseCards.data.items.item_count,
        cloudflareCards.data.cards?.totals?.items?.item_count,
      ),
      compareNumber(
        "cards.item_total_amount_cents",
        supabaseCards.data.items.total_amount_cents,
        cloudflareCards.data.cards?.totals?.items?.total_amount_cents,
      ),
    );
  }

  if (supabaseContracts.ok && cloudflareContracts.ok) {
    comparisons.push(
      compareNumber("contracts.templates", supabaseContracts.data.templates, cloudflareContracts.data.contracts?.templates?.count),
      compareNumber("contracts.documents", supabaseContracts.data.documents.count, cloudflareContracts.data.contracts?.documents?.count),
      compareNumber(
        "contracts.plan_value_cents",
        supabaseContracts.data.documents.plan_value_cents,
        cloudflareContracts.data.contracts?.documents?.plan_value_cents,
      ),
    );
  }

  const report = {
    ok: comparisons.length > 0 && comparisons.every((row) => row.match),
    generated_at: new Date().toISOString(),
    cloudflare_url: cloudflareUrl,
    supabase_available: Boolean(supabaseUrl && supabaseKey),
    summaries: {
      supabase: { cards: supabaseCards, contracts: supabaseContracts },
      cloudflare: { cards: cloudflareCards, contracts: cloudflareContracts },
    },
    comparisons,
    next_gate:
      comparisons.length === 0
        ? "blocked_until_supabase_and_cloudflare_summaries_are_available"
        : comparisons.every((row) => row.match)
          ? "parity_passed_for_cards_and_contracts"
          : "parity_failed_review_diffs_before_cutover",
  };

  const output = JSON.stringify(report, null, 2);
  console.log(output);

  if (writePath) {
    const absolute = path.resolve(process.cwd(), writePath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, `${output}\n`);
  }

  if (strict && !report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
