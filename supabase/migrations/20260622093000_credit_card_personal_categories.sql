-- ============================================================
-- MODULO: CARTAO - CATEGORIAS PESSOAIS E CLASSIFICACAO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.credit_card_personal_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#f59e0b',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT credit_card_personal_categories_name_key UNIQUE (name)
);

ALTER TABLE public.credit_card_personal_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read credit_card_personal_categories"
  ON public.credit_card_personal_categories FOR SELECT USING (true);

CREATE POLICY "Public insert credit_card_personal_categories"
  ON public.credit_card_personal_categories FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update credit_card_personal_categories"
  ON public.credit_card_personal_categories FOR UPDATE USING (true);

CREATE POLICY "Public delete credit_card_personal_categories"
  ON public.credit_card_personal_categories FOR DELETE USING (true);

DROP TRIGGER IF EXISTS trg_credit_card_personal_categories_updated
  ON public.credit_card_personal_categories;

CREATE TRIGGER trg_credit_card_personal_categories_updated
BEFORE UPDATE ON public.credit_card_personal_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.credit_card_invoice_items
  ADD COLUMN IF NOT EXISTS personal_category_id UUID
    REFERENCES public.credit_card_personal_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_credit_card_invoice_items_personal_category
  ON public.credit_card_invoice_items(personal_category_id);

CREATE INDEX IF NOT EXISTS idx_credit_card_personal_categories_active
  ON public.credit_card_personal_categories(active);

INSERT INTO public.credit_card_personal_categories (name, color)
VALUES
  ('Alimentacao', '#f59e0b'),
  ('Mercado', '#22c55e'),
  ('Transporte', '#3b82f6'),
  ('Saude', '#ef4444'),
  ('Assinaturas', '#8b5cf6'),
  ('Viagens', '#06b6d4'),
  ('Casa', '#84cc16'),
  ('Outros', '#64748b')
ON CONFLICT (name) DO NOTHING;
