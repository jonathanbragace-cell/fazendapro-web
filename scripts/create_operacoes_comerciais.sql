-- Operações comerciais de compra e venda de gado (sem registro individual no rebanho)
-- Execute no Supabase → SQL Editor → New query → Cole e clique em Run

CREATE TABLE IF NOT EXISTS public.operacoes_comerciais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fazenda_id uuid REFERENCES public.fazendas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'em_aberto',

  -- Compra
  data_compra date NOT NULL,
  vendedor text NOT NULL DEFAULT '',
  qtd_compra integer NOT NULL DEFAULT 0,
  categoria text NOT NULL DEFAULT 'boi',
  peso_total_compra numeric,
  forma_compra text NOT NULL DEFAULT 'arroba',
  valor_unit_compra numeric,
  valor_total_compra numeric NOT NULL DEFAULT 0,

  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operacoes_vendas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  operacao_id uuid NOT NULL REFERENCES public.operacoes_comerciais(id) ON DELETE CASCADE,
  data_venda date NOT NULL,
  comprador text NOT NULL DEFAULT '',
  qtd_vendida integer NOT NULL DEFAULT 0,
  peso_total_venda numeric,
  forma_venda text NOT NULL DEFAULT 'arroba',
  valor_unit_venda numeric,
  valor_total_venda numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operacoes_custos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  operacao_id uuid NOT NULL REFERENCES public.operacoes_comerciais(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data date,
  created_at timestamptz DEFAULT now()
);

-- Row Level Security (mesmo padrão do app)
ALTER TABLE public.operacoes_comerciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_custos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operacoes_comerciais' AND policyname = 'auth_all') THEN
    CREATE POLICY auth_all ON public.operacoes_comerciais FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operacoes_vendas' AND policyname = 'auth_all') THEN
    CREATE POLICY auth_all ON public.operacoes_vendas FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operacoes_custos' AND policyname = 'auth_all') THEN
    CREATE POLICY auth_all ON public.operacoes_custos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- NOTA: O lote "Cícero - 15/09/2026" está na tabela public.lotes com apenas id, nome e fazenda_id.
-- Após criar a operação correspondente na tela de Lotes, você pode removê-lo:
--   DELETE FROM public.lotes WHERE nome ILIKE '%Cicero%' OR nome ILIKE '%Cícero%';
