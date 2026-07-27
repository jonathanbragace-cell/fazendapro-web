import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  GitFork, Scale, Heart, ShieldPlus,
  Wallet, Package, TrendingUp,
} from 'lucide-react'
import { FazendaManager } from './fazenda-manager'

async function getKPIs(fazendaIds: string[]) {
  const supabase = await createClient()
  if (fazendaIds.length === 0) return null

  const hoje = new Date().toISOString().split('T')[0]
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const em15 = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]

  const addF = (q: any) => fazendaIds.length === 1
    ? q.eq('fazenda_id', fazendaIds[0])
    : q.in('fazenda_id', fazendaIds)

  const [
    { count: totalAnimais },
    { count: matrizes },
    { count: gestantes },
    { count: bezerrosMes },
    { count: partosProx },
    { count: vacinasVenc },
    { data: estoques },
    { data: finMes },
  ] = await Promise.all([
    addF(supabase.from('animais').select('*', { count: 'exact', head: true }).eq('status', 'ativo')),
    addF(supabase.from('animais').select('*', { count: 'exact', head: true }).eq('categoria', 'matriz').eq('status', 'ativo')),
    addF(supabase.from('animais').select('*', { count: 'exact', head: true }).eq('status_reprodutivo', 'gestante')),
    addF(supabase.from('reproducao').select('*', { count: 'exact', head: true }).eq('resultado_parto', 'vivo').gte('data_parto_real', inicioMes)),
    addF(supabase.from('reproducao').select('*', { count: 'exact', head: true }).is('data_parto_real', null).gte('data_parto_prevista', hoje).lte('data_parto_prevista', em15)),
    addF(supabase.from('sanitario').select('*', { count: 'exact', head: true }).lte('proxima_aplicacao', hoje)),
    addF(supabase.from('estoque').select('quantidade, estoque_minimo')),
    addF(supabase.from('financeiro').select('tipo, valor').gte('data', inicioMes)),
  ])

  const criticos = (estoques ?? []).filter((e: any) => e.quantidade <= e.estoque_minimo).length
  const resultado = (finMes ?? []).reduce((acc: number, m: any) =>
    m.tipo === 'entrada' ? acc + m.valor : acc - m.valor, 0)
  const taxaPrenhez = matrizes ? Math.round(((gestantes ?? 0) / matrizes) * 100) : 0

  return {
    totalAnimais: totalAnimais ?? 0,
    matrizes: matrizes ?? 0,
    taxaPrenhez,
    bezerrosMes: bezerrosMes ?? 0,
    partosProx: partosProx ?? 0,
    vacinasVenc: vacinasVenc ?? 0,
    criticos,
    resultado,
  }
}

function fmt(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `R$${(v / 1_000).toFixed(1)}k`
  return `R$${v.toFixed(0)}`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: fazendas } = await supabase.from('fazendas').select('id, nome').order('nome')
  const ids = (fazendas ?? []).map((f: any) => f.id)
  const kpis = await getKPIs(ids)

  const cards = [
    { label: 'Animais ativos',    value: kpis?.totalAnimais ?? 0, icon: GitFork,    color: 'bg-green-50 text-green-700',   border: 'border-green-200' },
    { label: 'Matrizes ativas',   value: kpis?.matrizes ?? 0,     icon: Heart,      color: 'bg-pink-50 text-pink-700',     border: 'border-pink-200' },
    { label: 'Taxa de prenhez',   value: `${kpis?.taxaPrenhez ?? 0}%`, icon: Scale, color: 'bg-blue-50 text-blue-700',    border: 'border-blue-200' },
    { label: 'Bezerros (mês)',    value: kpis?.bezerrosMes ?? 0,  icon: GitFork,    color: 'bg-yellow-50 text-yellow-700', border: 'border-yellow-200' },
    { label: 'Partos (15 dias)',  value: kpis?.partosProx ?? 0,   icon: Heart,      color: 'bg-amber-50 text-amber-700',   border: 'border-amber-200' },
    { label: 'Resultado (mês)',   value: kpis ? fmt(kpis.resultado) : '-', icon: TrendingUp, color: kpis && kpis.resultado >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700', border: kpis && kpis.resultado >= 0 ? 'border-green-200' : 'border-red-200' },
    { label: 'Vacinas vencidas',  value: kpis?.vacinasVenc ?? 0,  icon: ShieldPlus, color: kpis && kpis.vacinasVenc > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700', border: kpis && kpis.vacinasVenc > 0 ? 'border-red-200' : 'border-green-200' },
    { label: 'Estoques críticos', value: kpis?.criticos ?? 0,     icon: Package,    color: kpis && kpis.criticos > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700', border: kpis && kpis.criticos > 0 ? 'border-red-200' : 'border-green-200' },
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          {fazendas && fazendas.length > 0
            ? `${fazendas.length} fazenda${fazendas.length > 1 ? 's' : ''} cadastrada${fazendas.length > 1 ? 's' : ''}`
            : 'Nenhuma fazenda cadastrada'}
        </p>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`bg-white rounded-xl p-4 border ${c.border} shadow-sm`}>
            <div className={`inline-flex p-2 rounded-lg ${c.color} mb-3`}>
              <c.icon size={18} />
            </div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{c.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <FazendaManager fazendas={fazendas ?? []} />
    </div>
  )
}
