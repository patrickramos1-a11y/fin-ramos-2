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

