-- Habilita Realtime nas tabelas principais
-- Execute no Supabase: SQL Editor → New query → Cole e clique em Run

ALTER PUBLICATION supabase_realtime ADD TABLE public.animais;
ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sanitario;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pesagens;
