-- Lote Comercial: campos para compra/venda em lote sem brinco individual
-- Execute no Supabase Dashboard > SQL Editor

ALTER TABLE public.lotes
  ADD COLUMN IF NOT EXISTS operacao_comercial boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS qtd_animais_compra integer,
  ADD COLUMN IF NOT EXISTS tipo_peso text CHECK (tipo_peso IN ('vivo','morto')),
  ADD COLUMN IF NOT EXISTS peso_total_kg numeric(10,2),
  ADD COLUMN IF NOT EXISTS preco_compra_lote numeric(12,2),
  ADD COLUMN IF NOT EXISTS preco_venda_lote numeric(12,2),
  ADD COLUMN IF NOT EXISTS data_compra date,
  ADD COLUMN IF NOT EXISTS data_venda date,
  ADD COLUMN IF NOT EXISTS fornecedor text,
  ADD COLUMN IF NOT EXISTS comprador text;
