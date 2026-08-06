-- Migration: add preco_compra and status_reprodutivo to animais
-- Run this in Supabase SQL editor or using psql with a service role connection.

ALTER TABLE public.animais
  ADD COLUMN IF NOT EXISTS preco_compra numeric;

ALTER TABLE public.animais
  ADD COLUMN IF NOT EXISTS status_reprodutivo text;
