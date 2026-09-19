-- Bloco 2: adiciona roca_id em animais para filtro por roça no Rebanho
-- Execute no Supabase → SQL Editor → New query → Cole e clique em Run

ALTER TABLE public.animais
  ADD COLUMN IF NOT EXISTS roca_id uuid REFERENCES public.rocas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_animais_roca_id ON public.animais(roca_id) WHERE roca_id IS NOT NULL;
