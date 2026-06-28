import { createApiClient } from "./apiClient";

const pilotApi = createApiClient({
  baseUrl: import.meta.env.VITE_CLOUDFLARE_API_URL ?? "https://fin-ramos-api.patrickramos1-a11y.workers.dev",
});

export type CardInvoiceItemPatch = Partial<{
  usage_scope: "EMPRESA" | "PESSOAL" | "DUVIDA";
  conversion_status: "NAO_SELECIONADO" | "PRONTO" | "CONVERTIDO" | "IGNORADO";
  transaction_category_id: string | null;
  account_id: string | null;
  entity_id: string | null;
  cliente_id: string | null;
  cost_center_id: string | null;
  personal_category_id: string | null;
  notes: string | null;
  reimbursement_status: "NAO_APLICA" | "PENDENTE" | "REEMBOLSADO";
  reimbursement_notes: string | null;
  review_status: string;
}>;

export const cloudflareCardsApi = {
  listInvoices: () => pilotApi.get("/api/cards/invoices"),
  createInvoice: (payload: unknown) => pilotApi.post("/api/cards/invoices", payload),
  updateInvoice: (invoiceId: string, payload: unknown) => pilotApi.patch(`/api/cards/invoices/${invoiceId}`, payload),
  deleteInvoice: (invoiceId: string) => pilotApi.delete(`/api/cards/invoices/${invoiceId}`),
  listInvoiceItems: (invoiceId: string) => pilotApi.get(`/api/cards/invoices/${invoiceId}/items`),
  updateItems: (ids: string[], patch: CardInvoiceItemPatch) =>
    pilotApi.patch("/api/cards/items/bulk", { ids, patch }),
  listProfiles: () => pilotApi.get("/api/cards/profiles"),
  saveProfile: (payload: unknown) => pilotApi.post("/api/cards/profiles", payload),
  listPersonalCategories: () => pilotApi.get("/api/cards/personal-categories"),
  createPersonalCategory: (payload: unknown) => pilotApi.post("/api/cards/personal-categories", payload),
  listMerchantRules: () => pilotApi.get("/api/cards/merchant-rules"),
  saveMerchantRule: (payload: unknown) => pilotApi.post("/api/cards/merchant-rules", payload),
  previewTransactions: (invoiceIds?: string[]) =>
    pilotApi.post("/api/cards/preview-transactions", { invoice_ids: invoiceIds ?? [] }),
};

export const cloudflareContractsApi = {
  listTemplates: () => pilotApi.get("/api/contracts/templates"),
  createTemplate: (payload: unknown) => pilotApi.post("/api/contracts/templates", payload),
  listTemplateClauses: (templateId: string) => pilotApi.get(`/api/contracts/templates/${templateId}/clauses`),
  listDocuments: () => pilotApi.get("/api/contracts/documents"),
  createDocument: (payload: unknown) => pilotApi.post("/api/contracts/documents", payload),
  listDocumentClauses: (documentId: string) => pilotApi.get(`/api/contracts/documents/${documentId}/clauses`),
  updateClause: (clauseId: string, payload: unknown) => pilotApi.patch(`/api/contracts/clauses/${clauseId}`, payload),
  createAcceptanceLink: (documentId: string) =>
    pilotApi.post(`/api/contracts/documents/${documentId}/acceptance-link`),
  getPublicAcceptance: (token: string) => pilotApi.get(`/api/public/contracts/accept/${token}`),
  acceptPublicContract: (token: string, payload: unknown) =>
    pilotApi.post(`/api/public/contracts/accept/${token}`, payload),
};
