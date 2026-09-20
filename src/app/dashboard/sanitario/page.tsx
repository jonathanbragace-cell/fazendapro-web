'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, AlertTriangle, Trash2, Calendar, ShieldPlus, Pencil } from 'lucide-react'

const supabase = createClient()

type Tab = 'aplicacoes' | 'calendario' | 'lote'

type Registro = {
  id: string; tipo: string; produto: string; dose?: string | null; via?: string | null
  data_aplicacao: string; proxima_aplicacao?: string | null; responsavel?: string | null
  animal?: { id: string; brinco: string; nome?: string | null } | null
  lote?: { nome: string } | null
}
type Animal   = { id: string; brinco: string; nome?: string | null; categoria?: string; lote_id?: string | null; roca_id?: string | null }
type Fazenda  = { id: string; nome: string }
type Lote     = { id: string; nome: string }
type Roca     = { id: string; nome: string }
type Calendario = {
  id: string; nome: string; tipo: string; produto: string
  categoria_animal: string | null; periodicidade_meses: number | null
  via: string | null; dose: string | null; ativa: boolean
}

const TIPOS: Record<string, string> = {
  vacina:'Vacina', vermifugo:'Vermífugo', carrapaticida:'Carrapaticida', tratamento:'Tratamento', outro:'Outro',
}
const tipoColor: Record<string, string> = {
  vacina:'bg-blue-100 text-blue-700', vermifugo:'bg-purple-100 text-purple-700',
  carrapaticida:'bg-amber-100 text-amber-700', tratamento:'bg-red-100 text-red-700', outro:'bg-gray-100 text-gray-600',
}
const CATEGORIAS_LABEL: Record<string, string> = {
  '': 'Todos os animais', matriz:'Matrizes', bezerro:'Bezerros', novilha:'Novilhas', touro:'Touros', boi:'Bois',
}
const VACINAS_PADRAO = [
  { nome: 'Aftosa semestral', tipo: 'vacina', produto: 'Vacina FMD', categoria_animal: '', periodicidade_meses: 6, via: 'SC', dose: '2mL' },
  { nome: 'Brucelose (fêmeas 3–8 meses)', tipo: 'vacina', produto: 'Brucella abortus B19', categoria_animal: 'femea_jovem', periodicidade_meses: null, via: 'SC', dose: '2mL' },
  { nome: 'Clostridiose anual', tipo: 'vacina', produto: 'Polivalente clostridiose', categoria_animal: '', periodicidade_meses: 12, via: 'SC', dose: '5mL' },
  { nome: 'Raiva anual', tipo: 'vacina', produto: 'Vacina antirrábica', categoria_animal: '', periodicidade_meses: 12, via: 'SC', dose: '2mL' },
  { nome: 'Vermifugação', tipo: 'vermifugo', produto: 'Ivermectina', categoria_animal: '', periodicidade_meses: 4, via: 'SC', dose: '1mL/50kg' },
]

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const hoje = () => new Date().toISOString().split('T')[0]

export default function SanitarioPage() {
  const [tab, setTab]           = useState<Tab>('aplicacoes')
  const [registros, setRegistros] = useState<Registro[]>([])
  const [calendario, setCalendario] = useState<Calendario[]>([])
  const [fazendas, setFazendas]  = useState<Fazenda[]>([])
  const [lotes, setLotes]        = useState<Lote[]>([])
  const [rocas, setRocas]        = useState<Roca[]>([])
  const [loading, setLoading]    = useState(true)
  const [tipoFilter, setTipoFilter] = useState('')

  // Dialog: nova aplicação individual
  const [openNova, setOpenNova]    = useState(false)
  const [saving, setSaving]        = useState(false)
  const [formNova, setFormNova]    = useState({
    fazenda_id: '', tipo: 'vacina', produto: '', dose: '', via: '',
    data_aplicacao: hoje(), proxima_aplicacao: '', responsavel: '',
    animal_search: '', animal_id: '',
  })
  const [animalResults, setAnimalResults] = useState<Animal[]>([])

  // Dialog: calendário — criar/editar
  const [openCal, setOpenCal]     = useState(false)
  const [editCal, setEditCal]     = useState<Calendario | null>(null)
  const [formCal, setFormCal]     = useState({
    fazenda_id: '', nome: '', tipo: 'vacina', produto: '', categoria_animal: '',
    periodicidade_meses: '', via: '', dose: '',
  })

  // Aplicar em lote
  const [filtroTipo, setFiltroTipo]   = useState<'lote' | 'categoria' | 'roca' | 'manual'>('categoria')
  const [filtroValor, setFiltroValor] = useState('')
  const [animaisLote, setAnimaisLote] = useState<Animal[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loadingLote, setLoadingLote] = useState(false)
  const [formLote, setFormLote]       = useState({
    tipo: 'vacina', produto: '', dose: '', via: '',
    data_aplicacao: hoje(), proxima_aplicacao: '', responsavel: '', fazenda_id: '',
  })
  const [savingLote, setSavingLote]   = useState(false)
  const [busca, setBusca]             = useState('')
  const [buscaResults, setBuscaResults] = useState<Animal[]>([])

  async function loadAll() {
    setLoading(true)
    const [{ data: faz }, { data: lots }, { data: rocs }] = await Promise.all([
      supabase.from('fazendas').select('id, nome').order('nome'),
      supabase.from('lotes').select('id, nome').order('nome'),
      supabase.from('rocas').select('id, nome').order('nome'),
    ])
    setFazendas(faz ?? [])
    setLotes(lots ?? [])
    setRocas(rocs ?? [])

    let q = supabase.from('sanitario')
      .select('id, tipo, produto, dose, via, data_aplicacao, proxima_aplicacao, responsavel, animal:animais(id, brinco, nome), lote:lotes(nome)')
      .order('data_aplicacao', { ascending: false }).limit(300)
    if (tipoFilter) q = q.eq('tipo', tipoFilter)
    const { data: regs } = await q
    setRegistros((regs ?? []) as unknown as Registro[])

    const { data: cal } = await supabase
      .from('calendario_sanitario').select('*').order('nome')
    setCalendario((cal ?? []) as Calendario[])

    setLoading(false)
  }

  useEffect(() => { loadAll() }, [tipoFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRef = useRef(loadAll)
  useEffect(() => { loadRef.current = loadAll })
  useEffect(() => {
    const ch = supabase.channel('sanitario-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sanitario' }, () => loadRef.current())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const hj = hoje()
  const vencidos = registros.filter(r => r.proxima_aplicacao && r.proxima_aplicacao <= hj)

  // ── Animal search for individual form ──
  useEffect(() => {
    if (!formNova.animal_search) { setAnimalResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('animais').select('id, brinco, nome')
        .eq('status', 'ativo').ilike('brinco', `%${formNova.animal_search}%`).limit(8)
      setAnimalResults(data ?? [])
    }, 300)
    return () => clearTimeout(t)
  }, [formNova.animal_search])

  // ── Busca manual no tab lote ──
  useEffect(() => {
    if (!busca || filtroTipo !== 'manual') { setBuscaResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('animais').select('id, brinco, nome, categoria')
        .eq('status', 'ativo').ilike('brinco', `%${busca}%`).limit(15)
      setBuscaResults(data ?? [])
    }, 300)
    return () => clearTimeout(t)
  }, [busca, filtroTipo])

  // ── Load animals for lote tab ──
  async function carregarAnimaisLote() {
    if (!filtroValor && filtroTipo !== 'manual') { setAnimaisLote([]); return }
    setLoadingLote(true)
    let q = supabase.from('animais').select('id, brinco, nome, categoria, lote_id, roca_id')
      .eq('status', 'ativo').order('brinco')
    if (filtroTipo === 'lote')       q = (q as any).eq('lote_id', filtroValor)
    else if (filtroTipo === 'roca')  q = (q as any).eq('roca_id', filtroValor)
    else if (filtroTipo === 'categoria') q = q.eq('categoria', filtroValor)
    const { data } = await q
    setAnimaisLote(data ?? [])
    setSelectedIds(new Set((data ?? []).map((a: Animal) => a.id)))
    setLoadingLote(false)
  }

  useEffect(() => {
    if (filtroTipo !== 'manual') carregarAnimaisLote()
  }, [filtroTipo, filtroValor]) // eslint-disable-line react-hooks/exhaustive-deps

  function setFN(k: string, v: string) { setFormNova(p => ({ ...p, [k]: v })) }
  function setFC(k: string, v: string) { setFormCal(p => ({ ...p, [k]: v })) }
  function setFL(k: string, v: string) { setFormLote(p => ({ ...p, [k]: v })) }

  async function salvarNova() {
    if (!formNova.produto.trim()) { alert('Informe o produto.'); return }
    if (!formNova.animal_id) { alert('Selecione um animal para o registro individual. Para vários, use a aba "Aplicar em lote".'); return }
    setSaving(true)
    await supabase.from('sanitario').insert({
      fazenda_id: formNova.fazenda_id || fazendas[0]?.id || null,
      tipo: formNova.tipo, produto: formNova.produto.trim(),
      dose: formNova.dose.trim() || null, via: formNova.via.trim() || null,
      data_aplicacao: formNova.data_aplicacao,
      proxima_aplicacao: formNova.proxima_aplicacao || null,
      responsavel: formNova.responsavel.trim() || null,
      animal_id: formNova.animal_id,
    })
    setSaving(false)
    setOpenNova(false)
    setFormNova(p => ({ ...p, animal_id: '', animal_search: '', produto: '', dose: '', via: '', proxima_aplicacao: '' }))
    loadAll()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este registro?')) return
    await supabase.from('sanitario').delete().eq('id', id)
    loadAll()
  }

  // ── Calendário CRUD ──
  function abrirNovoCal() {
    setEditCal(null)
    setFormCal({ fazenda_id: fazendas[0]?.id ?? '', nome: '', tipo: 'vacina', produto: '', categoria_animal: '', periodicidade_meses: '', via: '', dose: '' })
    setOpenCal(true)
  }

  function preencherDoPadrao(p: typeof VACINAS_PADRAO[0]) {
    setFormCal(prev => ({
      ...prev,
      nome: p.nome, tipo: p.tipo, produto: p.produto,
      categoria_animal: p.categoria_animal,
      periodicidade_meses: p.periodicidade_meses ? String(p.periodicidade_meses) : '',
      via: p.via, dose: p.dose,
    }))
  }

  function abrirEditCal(c: Calendario) {
    setEditCal(c)
    setFormCal({
      fazenda_id: fazendas[0]?.id ?? '',
      nome: c.nome, tipo: c.tipo, produto: c.produto,
      categoria_animal: c.categoria_animal ?? '',
      periodicidade_meses: c.periodicidade_meses ? String(c.periodicidade_meses) : '',
      via: c.via ?? '', dose: c.dose ?? '',
    })
    setOpenCal(true)
  }

  async function salvarCal() {
    if (!formCal.nome.trim() || !formCal.produto.trim()) { alert('Preencha nome e produto.'); return }
    setSaving(true)
    const payload = {
      fazenda_id: formCal.fazenda_id || fazendas[0]?.id || null,
      nome: formCal.nome.trim(), tipo: formCal.tipo, produto: formCal.produto.trim(),
      categoria_animal: formCal.categoria_animal || null,
      periodicidade_meses: formCal.periodicidade_meses ? parseInt(formCal.periodicidade_meses) : null,
      via: formCal.via.trim() || null, dose: formCal.dose.trim() || null, ativa: true,
    }
    if (editCal) {
      await supabase.from('calendario_sanitario').update(payload).eq('id', editCal.id)
    } else {
      await supabase.from('calendario_sanitario').insert(payload)
    }
    setSaving(false)
    setOpenCal(false)
    loadAll()
  }

  async function excluirCal(id: string) {
    if (!confirm('Excluir este item do calendário?')) return
    await supabase.from('calendario_sanitario').delete().eq('id', id)
    loadAll()
  }

  function usarCalendarioNoLote(c: Calendario) {
    setFormLote(p => ({
      ...p, tipo: c.tipo, produto: c.produto,
      dose: c.dose ?? '', via: c.via ?? '',
      proxima_aplicacao: c.periodicidade_meses
        ? (() => {
            const d = new Date(); d.setMonth(d.getMonth() + c.periodicidade_meses!)
            return d.toISOString().split('T')[0]
          })()
        : '',
    }))
    if (c.categoria_animal && c.categoria_animal !== 'femea_jovem') {
      setFiltroTipo('categoria')
      setFiltroValor(c.categoria_animal)
    }
    setTab('lote')
  }

  // ── Aplicar em lote ──
  const animaisParaAplicar = filtroTipo === 'manual'
    ? [...selectedIds].map(id => animaisLote.find(a => a.id === id)).filter(Boolean) as Animal[]
    : animaisLote.filter(a => selectedIds.has(a.id))

  async function salvarLote() {
    if (!formLote.produto.trim()) { alert('Informe o produto.'); return }
    if (animaisParaAplicar.length === 0) { alert('Nenhum animal selecionado.'); return }
    setSavingLote(true)
    const fazId = formLote.fazenda_id || fazendas[0]?.id || null
    const rows = animaisParaAplicar.map(a => ({
      fazenda_id: fazId,
      animal_id: a.id,
      tipo: formLote.tipo, produto: formLote.produto.trim(),
      dose: formLote.dose.trim() || null, via: formLote.via.trim() || null,
      data_aplicacao: formLote.data_aplicacao,
      proxima_aplicacao: formLote.proxima_aplicacao || null,
      responsavel: formLote.responsavel.trim() || null,
    }))
    const { error } = await supabase.from('sanitario').insert(rows)
    setSavingLote(false)
    if (error) { alert(`Erro: ${error.message}`); return }
    alert(`${rows.length} registro(s) inserido(s) com sucesso.`)
    setSelectedIds(new Set())
    setFiltroValor('')
    setAnimaisLote([])
    setFormLote(p => ({ ...p, produto: '', dose: '', via: '', proxima_aplicacao: '' }))
    setTab('aplicacoes')
    loadAll()
  }

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-bold text-xl text-gray-900">Sanitário</h1>
          <p className="text-sm text-gray-400">{registros.length} registros · {vencidos.length} vencidos</p>
        </div>
        {tab === 'aplicacoes' && (
          <button
            onClick={() => { setFormNova(p => ({ ...p, fazenda_id: fazendas[0]?.id ?? '' })); setOpenNova(true) }}
            className="flex items-center gap-1.5 bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded-xl hover:bg-green-800 transition-colors shrink-0"
          >
            <Plus size={16} /> Nova
          </button>
        )}
        {tab === 'calendario' && (
          <button
            onClick={abrirNovoCal}
            className="flex items-center gap-1.5 bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded-xl hover:bg-green-800 transition-colors shrink-0"
          >
            <Plus size={16} /> Adicionar
          </button>
        )}
      </div>

      {/* Alerta vencidos */}
      {vencidos.length > 0 && tab === 'aplicacoes' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="text-red-600 mt-0.5 shrink-0" size={16} />
          <div>
            <p className="font-semibold text-red-800 text-sm">{vencidos.length} aplicação(ões) vencida(s)</p>
            <p className="text-red-600 text-xs mt-0.5">{vencidos.slice(0, 3).map(r => r.produto).join(', ')}{vencidos.length > 3 ? '…' : ''}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {([
          ['aplicacoes', 'Aplicações'],
          ['calendario', 'Calendário'],
          ['lote', 'Aplicar em lote'],
        ] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: APLICAÇÕES ── */}
      {tab === 'aplicacoes' && (
        <>
          {/* Filtro tipo */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {(['', ...Object.keys(TIPOS)] as string[]).map(t => (
              <button key={t} onClick={() => setTipoFilter(t)}
                className={`h-[34px] shrink-0 px-3 rounded-full text-xs font-semibold transition-colors ${tipoFilter === t ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t ? TIPOS[t] : 'Todos'}
              </button>
            ))}
          </div>

          {loading && <p className="text-center text-gray-400 py-12">Carregando...</p>}

          {!loading && registros.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-base font-medium mb-1">Nenhum registro</p>
              <p className="text-sm">Use "Nova" para registrar ou "Aplicar em lote" para vários animais.</p>
            </div>
          )}

          {!loading && registros.length > 0 && (
            <div className="space-y-3">
              {registros.map(r => {
                const vencido = r.proxima_aplicacao && r.proxima_aplicacao <= hj
                const temProx = !!r.proxima_aplicacao
                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900">{r.produto}{r.dose ? ` · ${r.dose}` : ''}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {r.animal?.brinco ?? r.lote?.nome ?? 'Sem animal vinculado'}{r.via ? ` · ${r.via}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tipoColor[r.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                          {TIPOS[r.tipo]}
                        </span>
                        {temProx && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${vencido ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {vencido ? 'Vencido' : 'Em dia'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-400 space-y-0.5">
                        <p>Aplicado em {fmtDate(r.data_aplicacao)}</p>
                        {r.proxima_aplicacao && <p>Próxima: {fmtDate(r.proxima_aplicacao)}</p>}
                        {r.responsavel && <p>Resp.: {r.responsavel}</p>}
                      </div>
                      <button onClick={() => excluir(r.id)} className="p-1.5 text-gray-200 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB: CALENDÁRIO ── */}
      {tab === 'calendario' && (
        <>
          {calendario.length === 0 && !loading && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">Nenhum calendário cadastrado</p>
              <p className="text-xs text-amber-700 mb-3">Adicione os protocolos que se repetem: aftosa, brucelose, clostridiose, raiva, vermifugação.</p>
              <p className="text-xs font-semibold text-amber-700 mb-2">Sugestões rápidas:</p>
              <div className="flex flex-wrap gap-2">
                {VACINAS_PADRAO.map(p => (
                  <button
                    key={p.nome}
                    onClick={() => { preencherDoPadrao(p); setOpenCal(true) }}
                    className="text-xs bg-white border border-amber-300 text-amber-800 px-2.5 py-1 rounded-full hover:bg-amber-100 transition-colors"
                  >
                    + {p.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {calendario.length > 0 && (
            <div className="space-y-3 mb-4">
              {calendario.map(c => (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{c.nome}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.produto}{c.dose ? ` · ${c.dose}` : ''}{c.via ? ` · ${c.via}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${tipoColor[c.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                      {TIPOS[c.tipo]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                      {c.periodicidade_meses && (
                        <span className="bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5">
                          A cada {c.periodicidade_meses} meses
                        </span>
                      )}
                      {c.categoria_animal && (
                        <span className="bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5">
                          {CATEGORIAS_LABEL[c.categoria_animal] ?? c.categoria_animal}
                        </span>
                      )}
                      {!c.categoria_animal && (
                        <span className="bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5">Todos os animais</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => usarCalendarioNoLote(c)}
                        className="text-xs text-green-700 font-semibold border border-green-200 rounded-lg px-2.5 py-1 hover:bg-green-50 transition-colors"
                      >
                        Aplicar
                      </button>
                      <button onClick={() => abrirEditCal(c)} className="p-1.5 text-gray-300 hover:text-gray-600 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => excluirCal(c.id)} className="p-1.5 text-gray-200 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {calendario.length > 0 && (
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 mb-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">Adicionar sugestão rápida</p>
              <div className="flex flex-wrap gap-2">
                {VACINAS_PADRAO.filter(p => !calendario.some(c => c.produto === p.produto)).map(p => (
                  <button
                    key={p.nome}
                    onClick={() => { preencherDoPadrao(p); setOpenCal(true) }}
                    className="text-xs bg-white border border-gray-200 text-gray-600 px-2.5 py-1 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    + {p.nome}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: APLICAR EM LOTE ── */}
      {tab === 'lote' && (
        <>
          {/* Selecionar animais */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Selecionar animais</p>

            {/* Filtro tipo */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {([
                ['categoria', 'Por categoria'],
                ['lote', 'Por lote'],
                ['roca', 'Por roça'],
                ['manual', 'Manual'],
              ] as const).map(([v, l]) => (
                <button key={v} onClick={() => { setFiltroTipo(v); setFiltroValor(''); setAnimaisLote([]); setSelectedIds(new Set()) }}
                  className={`h-[34px] shrink-0 px-3 rounded-full text-xs font-semibold transition-colors ${filtroTipo === v ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* Seletor conforme tipo */}
            {filtroTipo === 'categoria' && (
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"
                value={filtroValor}
                onChange={e => setFiltroValor(e.target.value)}
              >
                <option value="">— escolha a categoria —</option>
                {Object.entries(CATEGORIAS_LABEL).filter(([k]) => k).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            )}
            {filtroTipo === 'lote' && (
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"
                value={filtroValor}
                onChange={e => setFiltroValor(e.target.value)}
              >
                <option value="">— escolha o lote —</option>
                {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            )}
            {filtroTipo === 'roca' && (
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"
                value={filtroValor}
                onChange={e => setFiltroValor(e.target.value)}
              >
                <option value="">— escolha a roça —</option>
                {rocas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            )}
            {filtroTipo === 'manual' && (
              <div className="mb-2">
                <Input placeholder="Buscar por brinco..." value={busca}
                  onChange={e => setBusca(e.target.value)} />
                {buscaResults.length > 0 && (
                  <div className="border border-gray-200 rounded-lg mt-1 divide-y divide-gray-100 shadow-sm max-h-36 overflow-y-auto">
                    {buscaResults.map(a => (
                      <button key={a.id} type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 flex items-center justify-between"
                        onClick={() => {
                          setSelectedIds(prev => { const n = new Set(prev); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n })
                          setAnimaisLote(prev => prev.some(x => x.id === a.id) ? prev : [...prev, a])
                        }}>
                        <span>
                          <span className="font-medium">{a.brinco}</span>
                          {a.nome && <span className="text-gray-400 ml-2">{a.nome}</span>}
                        </span>
                        {selectedIds.has(a.id) && <span className="text-green-600 font-bold text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {loadingLote && <p className="text-xs text-gray-400 text-center py-2">Carregando animais...</p>}

            {!loadingLote && animaisLote.length > 0 && filtroTipo !== 'manual' && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600">{animaisLote.length} animal(is) encontrado(s)</p>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedIds(new Set(animaisLote.map(a => a.id)))}
                      className="text-xs text-green-700 font-semibold">Selecionar todos</button>
                    <span className="text-gray-300">·</span>
                    <button onClick={() => setSelectedIds(new Set())}
                      className="text-xs text-gray-500">Limpar</button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {animaisLote.map(a => (
                    <label key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={selectedIds.has(a.id)}
                        onChange={() => setSelectedIds(prev => { const n = new Set(prev); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n })}
                        className="rounded border-gray-300 text-green-600" />
                      <span className="text-sm font-medium text-gray-900">{a.brinco}</span>
                      {a.nome && <span className="text-xs text-gray-400">{a.nome}</span>}
                      <span className="text-[10px] text-gray-400 ml-auto">{a.categoria}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {filtroTipo === 'manual' && selectedIds.size > 0 && (
              <p className="text-xs font-semibold text-green-700 mt-2">{selectedIds.size} animal(is) selecionado(s)</p>
            )}
          </div>

          {/* Dados da aplicação */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Dados da aplicação</p>

            {/* Usar calendário */}
            {calendario.length > 0 && (
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-500 block mb-1">Preencher do calendário (opcional)</label>
                <div className="flex flex-wrap gap-2">
                  {calendario.map(c => (
                    <button key={c.id} onClick={() => usarCalendarioNoLote(c)}
                      className="text-xs border border-gray-200 text-gray-600 px-2.5 py-1 rounded-full hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors">
                      {c.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Tipo</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(TIPOS).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setFL('tipo', k)}
                      className={`h-[34px] px-3 rounded-full border text-xs font-semibold transition-colors ${formLote.tipo === k ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Produto *</label>
                <Input placeholder="Ex: Vacina FMD, Ivermectina..." value={formLote.produto} onChange={e => setFL('produto', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Dose</label>
                  <Input placeholder="Ex: 2mL" value={formLote.dose} onChange={e => setFL('dose', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Via</label>
                  <Input placeholder="SC, IM, VO..." value={formLote.via} onChange={e => setFL('via', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Data da aplicação *</label>
                  <Input type="date" value={formLote.data_aplicacao} onChange={e => setFL('data_aplicacao', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Próxima aplicação</label>
                  <Input type="date" value={formLote.proxima_aplicacao} onChange={e => setFL('proxima_aplicacao', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Responsável</label>
                <Input placeholder="Opcional" value={formLote.responsavel} onChange={e => setFL('responsavel', e.target.value)} />
              </div>
            </div>
          </div>

          <Button
            className="w-full bg-green-700 hover:bg-green-800 h-12"
            onClick={salvarLote}
            disabled={savingLote || animaisParaAplicar.length === 0 || !formLote.produto.trim()}
          >
            {savingLote
              ? 'Salvando...'
              : `Registrar para ${animaisParaAplicar.length} animal(is)`}
          </Button>
        </>
      )}

      {/* ── Dialog: Nova aplicação individual ── */}
      <Dialog open={openNova} onOpenChange={setOpenNova}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova aplicação</DialogTitle></DialogHeader>
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 -mt-1">
            Para vários animais de uma vez, use a aba "Aplicar em lote".
          </p>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Animal * (obrigatório)</label>
              <Input placeholder="Buscar brinco..." value={formNova.animal_search}
                onChange={e => { setFN('animal_search', e.target.value); if (!e.target.value) setFN('animal_id', '') }} />
              {animalResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 divide-y divide-gray-100 shadow-sm max-h-32 overflow-y-auto">
                  {animalResults.map(a => (
                    <button key={a.id} type="button" className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm"
                      onClick={() => { setFN('animal_id', a.id); setFN('animal_search', a.brinco); setAnimalResults([]) }}>
                      <span className="font-medium">{a.brinco}</span>
                      {a.nome && <span className="text-gray-500 ml-2">{a.nome}</span>}
                    </button>
                  ))}
                </div>
              )}
              {formNova.animal_id && (
                <p className="text-xs text-green-700 mt-1 font-medium">Animal selecionado: {formNova.animal_search}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Tipo</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TIPOS).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setFN('tipo', k)}
                    className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${formNova.tipo === k ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Produto *</label>
              <Input placeholder="Ex: Vacina FMD, Ivermectina..." value={formNova.produto} onChange={e => setFN('produto', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Dose</label>
                <Input placeholder="Ex: 2mL" value={formNova.dose} onChange={e => setFN('dose', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Via</label>
                <Input placeholder="SC, IM..." value={formNova.via} onChange={e => setFN('via', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Data *</label>
                <Input type="date" value={formNova.data_aplicacao} onChange={e => setFN('data_aplicacao', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Próxima aplicação</label>
                <Input type="date" value={formNova.proxima_aplicacao} onChange={e => setFN('proxima_aplicacao', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Responsável</label>
              <Input placeholder="Opcional" value={formNova.responsavel} onChange={e => setFN('responsavel', e.target.value)} />
            </div>
            <Button className="w-full bg-green-700 hover:bg-green-800" onClick={salvarNova} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Calendário CRUD ── */}
      <Dialog open={openCal} onOpenChange={setOpenCal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCal ? 'Editar item do calendário' : 'Novo item do calendário'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Nome *</label>
              <Input placeholder="Ex: Aftosa semestral, Vermifugação trimestral..."
                value={formCal.nome} onChange={e => setFC('nome', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Tipo</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TIPOS).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setFC('tipo', k)}
                    className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${formCal.tipo === k ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Produto *</label>
              <Input placeholder="Ex: Vacina FMD, Ivermectina..."
                value={formCal.produto} onChange={e => setFC('produto', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Dose</label>
                <Input placeholder="Ex: 2mL" value={formCal.dose} onChange={e => setFC('dose', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Via</label>
                <Input placeholder="SC, IM, VO..." value={formCal.via} onChange={e => setFC('via', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Categoria de animal</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={formCal.categoria_animal} onChange={e => setFC('categoria_animal', e.target.value)}>
                {Object.entries(CATEGORIAS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Periodicidade (meses)</label>
              <Input type="number" placeholder="Ex: 6 = semestral, 12 = anual (deixe vazio para único)"
                value={formCal.periodicidade_meses} onChange={e => setFC('periodicidade_meses', e.target.value)} />
            </div>
            <Button className="w-full bg-green-700 hover:bg-green-800" onClick={salvarCal} disabled={saving}>
              {saving ? 'Salvando...' : editCal ? 'Salvar alterações' : 'Adicionar ao calendário'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
