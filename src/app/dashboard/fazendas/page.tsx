import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FazendaManager } from '../fazenda-manager'

export default async function FazendasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: fazendas } = await supabase
    .from('fazendas')
    .select('id, nome, municipio, estado, area_total_ha')
    .order('nome')

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Fazendas</h1>
        <p className="text-sm text-gray-400">Gerencie as fazendas cadastradas</p>
      </div>
      <FazendaManager fazendas={fazendas ?? []} />
    </div>
  )
}
