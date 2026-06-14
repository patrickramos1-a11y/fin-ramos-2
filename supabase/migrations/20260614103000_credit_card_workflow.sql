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

