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
