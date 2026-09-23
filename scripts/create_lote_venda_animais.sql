-- Tabela de romaneio de venda para animais do rebanho em um lote
CREATE TABLE IF NOT EXISTS public.lote_venda_animais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.lotes(id) ON DELETE CASCADE,
  animal_id uuid NOT NULL REFERENCES public.animais(id) ON DELETE CASCADE,
  peso_vivo_kg numeric,
  desconto_pct numeric,
  peso_morto_kg numeric,
  preco_venda_kg numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lote_id, animal_id)
);

ALTER TABLE public.lote_venda_animais ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lote_venda_animais' AND policyname = 'lote_venda_animais_all'
  ) THEN
    EXECUTE 'CREATE POLICY lote_venda_animais_all ON public.lote_venda_animais FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;
