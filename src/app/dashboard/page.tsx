import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { FazendaManager } from './fazenda-manager'

type KPIs = {
  totalVivos: number
  ativos: number
  descartes: number
  atencaoCount: number
  matrizes: number
  femeasVivas: number
  gestantes: number
  taxaPrenhez: number
  bezerrosMes: number
  pesoMedio: number | null
  resultado: number
  vacinasVenc: number
  criticos: number
  semEstoque: boolean
}

async function getKPIs(fazendaIds: string[]): Promise<KPIs | null> {
  const supabase = await createClient()
  if (fazendaIds.length === 0) return null

  const hoje = new Date().toISOString().split('T')[0]
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  const addF = (q: any) =>
    fazendaIds.length === 1
      ? q.eq('fazenda_id', fazendaIds[0])
      : q.in('fazenda_id', fazendaIds)

  const [
    { count: totalVivos },
    { count: descartes },
    { count: atencaoCount },
    { count: matrizes },
    { count: femeasVivas },
    { count: gestantes },
    { count: bezerrosMes },
    { count: vacinasVenc },
    { data: estoques },
    { data: finMes },
    { data: pesRecentes },
  ] = await Promise.all([
    addF(supabase.from('animais').select('*', { count: 'exact', head: true }).eq('status', 'ativo')),
    addF(supabase.from('animais').select('*', { count: 'exact', head: true }).eq('marcacao', 'descarte')),
    addF(supabase.from('animais').select('*', { count: 'exact', head: true }).eq('marcacao', 'atencao')),
    addF(supabase.from('animais').select('*', { count: 'exact', head: true }).eq('categoria', 'matriz').eq('status', 'ativo')),
    addF(supabase.from('animais').select('*', { count: 'exact', head: true }).eq('sexo', 'femea').eq('status', 'ativo').or('marcacao.is.null,marcacao.neq.descarte')),
    addF(supabase.from('animais').select('*', { count: 'exact', head: true }).eq('status_reprodutivo', 'gestante').eq('status', 'ativo')),
    addF(supabase.from('reproducao').select('*', { count: 'exact', head: true }).eq('resultado_parto', 'vivo').gte('data_parto_real', inicioMes)),
    addF(supabase.from('sanitario').select('*', { count: 'exact', head: true }).lte('proxima_aplicacao', hoje)),
    addF(supabase.from('estoque').select('quantidade, estoque_minimo')),
    addF(supabase.from('financeiro').select('tipo, valor').gte('data', inicioMes).neq('status', 'pendente')),
    supabase.from('pesagens').select('peso_kg').order('data', { ascending: false }).limit(300),
  ])

  const criticos = (estoques ?? []).filter((e: any) => e.quantidade <= e.estoque_minimo).length
  const semEstoque = (estoques ?? []).length === 0
  const resultado = (finMes ?? []).reduce((acc: number, m: any) =>
    m.tipo === 'entrada' ? acc + m.valor : acc - m.valor, 0)
  const fv = femeasVivas ?? 0
  const taxaPrenhez = fv > 0 ? Math.round(((gestantes ?? 0) / fv) * 100) : 0
  const ps = pesRecentes ?? []
  const pesoMedio = ps.length > 0
    ? Math.round(ps.reduce((s: number, p: any) => s + p.peso_kg, 0) / ps.length)
    : null

  const tv = totalVivos ?? 0
  const dc = descartes ?? 0
  const ac = atencaoCount ?? 0
  return {
    totalVivos: tv,
    ativos: tv - dc - ac,
    descartes: dc,
    atencaoCount: ac,
    matrizes: matrizes ?? 0,
    femeasVivas: fv,
    gestantes: gestantes ?? 0,
    taxaPrenhez,
    bezerrosMes: bezerrosMes ?? 0,
    pesoMedio,
    resultado,
    vacinasVenc: vacinasVenc ?? 0,
    criticos,
    semEstoque,
  }
}

function fmtMoeda(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`
  return `R$ ${v.toFixed(0)}`
}

function mesAtual() {
  return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const selectedFazendaId = cookieStore.get('fazenda_id')?.value ?? ''

  const { data: fazendas } = await supabase
    .from('fazendas').select('id, nome, municipio, estado, area_total_ha').order('nome')

  const allIds = (fazendas ?? []).map((f: any) => f.id)
  const ids = (selectedFazendaId && allIds.includes(selectedFazendaId))
    ? [selectedFazendaId]
    : allIds

  const kpis = await getKPIs(ids)
  const selectedFazenda = (fazendas ?? []).find((f: any) => f.id === selectedFazendaId)
  const displayName = selectedFazenda?.nome
    ?? (fazendas?.length === 1 ? fazendas[0].nome : 'Todas as fazendas')

  // Subtitle for animal count
  const animaisSubtitle = (() => {
    if (!kpis) return ''
    const parts: string[] = []
    if (kpis.ativos > 0) parts.push(`${kpis.ativos} ativos`)
    if (kpis.descartes > 0) parts.push(`${kpis.descartes} descarte`)
    if (kpis.atencaoCount > 0) parts.push(`${kpis.atencaoCount} atenção`)
    return parts.join(' · ') || 'nenhum animal'
  })()

  type CardDef = {
    label: string
    value: string | number
    subtitle: string
    accent?: string
  }

  const cards: CardDef[] = [
    {
      label: 'Animais vivos',
      value: kpis?.totalVivos ?? 0,
      subtitle: animaisSubtitle,
    },
    {
      label: 'Matrizes ativas',
      value: kpis?.matrizes ?? 0,
      subtitle: kpis ? `${kpis.femeasVivas} fêmeas reprod.` : '—',
    },
    {
      label: 'Bezerros/mês',
      value: kpis?.bezerrosMes ?? 0,
      subtitle: (kpis?.bezerrosMes ?? 0) === 0 ? 'nenhum parto no mês' : 'partos com resultado vivo',
    },
    {
      label: 'Taxa de prenhez',
      value: `${kpis?.taxaPrenhez ?? 0}%`,
      subtitle: kpis ? `${kpis.femeasVivas} fêmeas — ${kpis.gestantes} prenhas` : '—',
    },
    {
      label: 'Peso médio',
      value: kpis?.pesoMedio != null ? `${kpis.pesoMedio} kg` : 'sem dados',
      subtitle: kpis?.pesoMedio == null ? 'nenhuma pesagem' : 'média das pesagens',
    },
    {
      label: 'Resultado mês',
      value: kpis ? fmtMoeda(kpis.resultado) : '—',
      subtitle: kpis
        ? kpis.resultado >= 0 ? 'lucro no mês' : 'prejuízo no mês'
        : '',
      accent: kpis && kpis.resultado < 0 ? 'text-red-600' : 'text-green-700',
    },
    {
      label: 'Vacinas vencidas',
      value: (kpis?.vacinasVenc ?? 0) === 0 ? 'em dia' : String(kpis?.vacinasVenc),
      subtitle: (kpis?.vacinasVenc ?? 0) === 0 ? 'calendário ok' : 'aplicações atrasadas',
      accent: (kpis?.vacinasVenc ?? 0) > 0 ? 'text-red-600' : 'text-green-700',
    },
    {
      label: 'Estoque crítico',
      value: kpis?.semEstoque ? 'sem dados' : (kpis?.criticos ?? 0) === 0 ? 'ok' : String(kpis?.criticos),
      subtitle: kpis?.semEstoque
        ? 'nenhum item cadastrado'
        : (kpis?.criticos ?? 0) === 0
          ? 'todos acima do mínimo'
          : 'itens abaixo do mínimo',
      accent: (kpis?.criticos ?? 0) > 0
        ? 'text-red-600'
        : kpis?.semEstoque
          ? 'text-gray-400'
          : 'text-green-700',
    },
  ]

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto md:max-w-none md:px-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
        <p className="text-sm text-gray-400">{mesAtual()}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 leading-tight">
              {c.label}
            </p>
            <p className={`text-2xl font-bold leading-tight ${c.accent ?? 'text-gray-900'}`}>
              {c.value}
            </p>
            <p className="text-xs text-gray-400 mt-1 leading-tight">{c.subtitle}</p>
          </div>
        ))}
      </div>

      <FazendaManager fazendas={fazendas ?? []} />
    </div>
  )
}
