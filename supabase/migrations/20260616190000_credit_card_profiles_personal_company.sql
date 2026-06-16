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
