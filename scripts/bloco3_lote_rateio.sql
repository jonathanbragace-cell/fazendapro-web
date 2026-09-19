-- Bloco 3: campo lote/roça no financeiro, lote no estoque, valor unitário no produto
-- Execute no Supabase → SQL Editor → New query → Cole e clique em Run

-- 1. Valor unitário no produto de estoque (para calcular custo na saída)
ALTER TABLE public.estoque
  ADD COLUMN IF NOT EXISTS valor_unitario numeric;

-- 2. Lote vinculado na movimentação de estoque
ALTER TABLE public.movimentos_estoque
  ADD COLUMN IF NOT EXISTS lote_id uuid REFERENCES public.lotes(id) ON DELETE SET NULL;

-- 3. Lote e roça no lançamento financeiro
ALTER TABLE public.financeiro
  ADD COLUMN IF NOT EXISTS lote_id uuid REFERENCES public.lotes(id) ON DELETE SET NULL;

ALTER TABLE public.financeiro
  ADD COLUMN IF NOT EXISTS roca_id uuid REFERENCES public.rocas(id) ON DELETE SET NULL;

-- Índices opcionais
CREATE INDEX IF NOT EXISTS idx_movimentos_estoque_lote ON public.movimentos_estoque(lote_id) WHERE lote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financeiro_lote ON public.financeiro(lote_id) WHERE lote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financeiro_roca ON public.financeiro(roca_id) WHERE roca_id IS NOT NULL;
