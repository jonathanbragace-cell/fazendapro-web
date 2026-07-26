import { createClient } from '@/lib/supabase/server'
import { BarChart3, TrendingUp, TrendingDown, Heart, ShieldPlus, GitFork } from 'lucide-react'

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export const dynamic = 'force-dynamic'

export default async function RelatoriosPage() {
  const supabase = await createClient()
  const hoje   = new Date().toISOString().split('T')[0]
  const inicio6m = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0]

  const { data: fazendas } = await supabase.from('fazendas').select('id, nome').order('nome')
  const ids = (fazendas ?? []).map((f: any) => f.id)

  const addF = (q: any) => ids.length === 1 ? q.eq('fazenda_id', ids[0]) : ids.length > 1 ? q.in('fazenda_id', ids) : q

  const [
    { data: animais },
    { data: pesagens },
    { data: reproducoes },
    { data: sanitario },
    { data: financeiro },
    { data: estoque },
  ] = await Promise.all([
    addF(supabase.from('animais').select('categoria, status').eq('status', 'ativo')),
    addF(supabase.from('pesagens').select('peso_kg, data').gte('data', inicio6m).order('data')),
    addF(supabase.from('reproducao').select('diagnostico, data_parto_real')),
    addF(supabase.from('sanitario').select('proxima_aplicacao')),
    addF(supabase.from('financeiro').select('tipo, valor, data, categoria').gte('data', inicio6m)),
    addF(supabase.from('estoque').select('produto, quantidade, estoque_minimo, unidade')),
  ])

  // Rebanho por categoria
  const catCount: Record<string, number> = {}
  ;(animais ?? []).forEach((a: any) => { catCount[a.categoria] = (catCount[a.categoria] ?? 0) + 1 })
  const totalAtivos = Object.values(catCount).reduce((s, v) => s + v, 0)

  const CAT_LABELS: Record<string, string> = { matriz:'Matrizes', bezerro:'Bezerros', novilha:'Novilhas', touro:'Touros', boi:'Bois' }

  // Financeiro 6m por mês
  const finMes: Record<string, { e: number; s: number }> = {}
  ;(financeiro ?? []).forEach((m: any) => {
    const k = m.data.slice(0, 7)
    if (!finMes[k]) finMes[k] = { e: 0, s: 0 }
    if (m.tipo === 'entrada') finMes[k].e += m.valor
    else finMes[k].s += m.valor
  })
  const finMeses = Object.entries(finMes).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
  const totalEntradas = (financeiro ?? []).filter((m: any) => m.tipo === 'entrada').reduce((s: number, m: any) => s + m.valor, 0)
  const totalSaidas   = (financeiro ?? []).filter((m: any) => m.tipo === 'saida').reduce((s: number, m: any) => s + m.valor, 0)

  // Reprodução
  const matrizes   = catCount['matriz'] ?? 0
  const gestantes  = (reproducoes ?? []).filter((r: any) => r.diagnostico === true && !r.data_parto_real).length
  const taxaPrenhez = matrizes > 0 ? Math.round((gestantes / matrizes) * 100) : 0

  // Sanitário
  const vencidos = (sanitario ?? []).filter((s: any) => s.proxima_aplicacao && s.proxima_aplicacao <= hoje).length
  const emDia    = (sanitario ?? []).filter((s: any) => !s.proxima_aplicacao || s.proxima_aplicacao > hoje).length

  // Pesagens
  const pesoMedio = pesagens && pesagens.length > 0
    ? Math.round(((pesagens as any[]).reduce((s, p) => s + p.peso_kg, 0) / pesagens.length) * 10) / 10
    : 0

  function shortM(ym: string) {
    const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    const [, m] = ym.split('-')
    return MESES[parseInt(m) - 1]
  }

  const maxBar = finMeses.length > 0 ? Math.max(...finMeses.map(([, v]) => Math.max(v.e, v.s)), 1) : 1

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-gray-500 text-sm mt-1">Últimos 6 meses</p>
      </div>

      {/* Financeiro */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-green-600" />
          <h2 className="font-semibold text-gray-900">Financeiro</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="text-center"><p className="text-xs text-gray-500 mb-1">Entradas</p><p className="text-lg font-bold text-green-700">{fmt(totalEntradas)}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500 mb-1">Saídas</p><p className="text-lg font-bold text-red-600">{fmt(totalSaidas)}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500 mb-1">Resultado</p><p className={`text-lg font-bold ${totalEntradas - totalSaidas >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(totalEntradas - totalSaidas)}</p></div>
        </div>
        {finMeses.length > 0 && (
          <div className="flex items-end gap-2 h-32">
            {finMeses.map(([mes, v]) => (
              <div key={mes} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex gap-0.5 items-end w-full">
                  <div className="flex-1 bg-green-500 rounded-t" style={{ height: `${Math.round((v.e / maxBar) * 96)}px` }} title={`Entradas: ${fmt(v.e)}`} />
                  <div className="flex-1 bg-red-400 rounded-t" style={{ height: `${Math.round((v.s / maxBar) * 96)}px` }} title={`Saídas: ${fmt(v.s)}`} />
                </div>
                <p className="text-xs text-gray-400">{shortM(mes)}</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-4 mt-3 justify-center">
          <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-3 h-3 bg-green-500 rounded" />Entradas</span>
          <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-3 h-3 bg-red-400 rounded" />Saídas</span>
        </div>
      </div>

      {/* Rebanho */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <GitFork size={18} className="text-green-600" />
          <h2 className="font-semibold text-gray-900">Rebanho — {totalAtivos} animais ativos</h2>
        </div>
        <div className="space-y-3">
          {Object.entries(catCount).map(([cat, qtd]) => {
            const pct = totalAtivos > 0 ? Math.round((qtd / totalAtivos) * 100) : 0
            return (
              <div key={cat}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{CAT_LABELS[cat] ?? cat}</span>
                  <span className="font-medium text-gray-900">{qtd} ({pct}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className="h-2 bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Reprodução */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Heart size={18} className="text-pink-500" />
          <h2 className="font-semibold text-gray-900">Reprodução</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center"><p className="text-xs text-gray-500 mb-1">Matrizes</p><p className="text-2xl font-bold text-gray-900">{matrizes}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500 mb-1">Gestantes</p><p className="text-2xl font-bold text-amber-600">{gestantes}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500 mb-1">Taxa prenhez</p><p className={`text-2xl font-bold ${taxaPrenhez >= 80 ? 'text-green-700' : taxaPrenhez >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{taxaPrenhez}%</p></div>
        </div>
        <div className="h-3 bg-gray-100 rounded-full">
          <div className={`h-3 rounded-full ${taxaPrenhez >= 80 ? 'bg-green-500' : taxaPrenhez >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${taxaPrenhez}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-1 text-right">Meta: 80%</p>
      </div>

      {/* Pesagem */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-blue-500" />
          <h2 className="font-semibold text-gray-900">Pesagem — últimos 6 meses</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center bg-blue-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Peso médio</p>
            <p className="text-2xl font-bold text-blue-700">{pesoMedio} kg</p>
          </div>
          <div className="text-center bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Registros</p>
            <p className="text-2xl font-bold text-gray-700">{pesagens?.length ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Sanitário */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ShieldPlus size={18} className="text-purple-500" />
          <h2 className="font-semibold text-gray-900">Sanitário</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className={`text-center rounded-xl p-4 ${vencidos > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <p className="text-xs text-gray-500 mb-1">Vencidos</p>
            <p className={`text-2xl font-bold ${vencidos > 0 ? 'text-red-600' : 'text-green-600'}`}>{vencidos}</p>
          </div>
          <div className="text-center bg-green-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Em dia / sem venc.</p>
            <p className="text-2xl font-bold text-green-700">{emDia}</p>
          </div>
        </div>
      </div>

      {/* Estoque */}
      {(estoque ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-amber-500" />
            <h2 className="font-semibold text-gray-900">Estoque</h2>
          </div>
          <div className="space-y-3">
            {(estoque as any[]).map(i => {
              const pct = i.estoque_minimo > 0 ? Math.min(Math.round((i.quantidade / (i.estoque_minimo * 3)) * 100), 100) : 100
              const critico = i.quantidade <= i.estoque_minimo
              return (
                <div key={i.produto}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{i.produto}</span>
                    <span className={`font-medium ${critico ? 'text-red-600' : 'text-gray-900'}`}>{i.quantidade} {i.unidade}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className={`h-2 rounded-full ${critico ? 'bg-red-400' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
