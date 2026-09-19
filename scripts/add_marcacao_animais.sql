-- Ponto 5: Separa "marcação" de "status" na tabela animais
-- Execute no Supabase → SQL Editor → New query → Cole e clique em Run
--
-- ANTES:
--   status: 'ativo' | 'vendido' | 'morto' | 'descarte' | 'atencao'
--   descarte e atencao ficavam no status, tirando o animal do total de vivos
--
-- DEPOIS:
--   status: 'ativo' | 'vendido' | 'morto' | 'abatido'  (estado de vida do animal)
--   marcacao: NULL | 'descarte' | 'atencao'              (flags que NÃO mudam o status)
--
-- Resultado: animais descarte e atenção continuam no total de vivos, com badge visual.

-- 1. Adiciona a coluna marcacao
ALTER TABLE public.animais
  ADD COLUMN IF NOT EXISTS marcacao text
  CHECK (marcacao IN ('descarte', 'atencao'));

-- 2. Migra os animais que estão como descarte
UPDATE public.animais
SET marcacao = 'descarte', status = 'ativo'
WHERE status = 'descarte';

-- 3. Migra os animais que estão como atencao
UPDATE public.animais
SET marcacao = 'atencao', status = 'ativo'
WHERE status = 'atencao';

-- 4. Remove o CHECK constraint antigo e adiciona o novo (sem descarte/atencao no status)
ALTER TABLE public.animais DROP CONSTRAINT IF EXISTS animais_status_check;

ALTER TABLE public.animais
  ADD CONSTRAINT animais_status_check
  CHECK (status IN ('ativo', 'vendido', 'morto', 'abatido'));

-- 5. Cria índice para consultas por marcacao (opcional mas útil)
CREATE INDEX IF NOT EXISTS idx_animais_marcacao ON public.animais(marcacao)
  WHERE marcacao IS NOT NULL;

-- NOTA PARA O DESENVOLVEDOR:
-- Após executar esta migração, atualize o código em:
--   - src/app/dashboard/rebanho/page.tsx:
--     * Filtro "descarte" → WHERE marcacao = 'descarte'
--     * Filtro "atencao"  → WHERE marcacao = 'atencao'
--     * Total de vivos    → WHERE status = 'ativo'
--     * Ao salvar animal  → campo marcacao em vez de status para descarte/atencao
--   - src/app/dashboard/page.tsx (já tratado com IN('ativo','descarte','atencao') como fallback)
--   - src/app/dashboard/sanitario/page.tsx (se filtrar por status)
--
-- ENQUANTO a migração NÃO for executada:
--   O dashboard já conta status IN ('ativo','descarte','atencao') como vivos.
--   Após a migração, todos voltam para status='ativo' e o filtro continua funcionando.
