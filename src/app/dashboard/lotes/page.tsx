'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ChevronLeft, Pencil, Plus, Search, Trash2, X } from 'lucide-react'

const supabase = createClient()

type Fazenda  = { id: string; nome: string }
type Lote = {
  id: string
  fazenda_id: string | null
  nome: string
  tipo: string | null
  situacao: string
  data_criacao: string | null
  descricao: string | null
  observacao: string | null
  total_animais?: number
  custo_total?: number
}
type Animal = {
  id: string; brinco: string; nome: string | null
  categoria: string; sexo: string; raca: string
}
type Lancamento = {
  id: string; descricao: string | null; tipo: string
  valor: number; data: string | null; categoria: string | null
}

const TIPOS = ['cria', 'recria', 'engorda', 'comercial', 'descarte']
const TIPO_LABEL: Record<string, string> = {
  cria: 'Cria', recria: 'Recria', engorda: 'Engorda',
  comercial: 'Comercial', descarte: 'Descarte',
}
const TIPO_COLOR: Record<string, string> = {
  cria:      'bg-yellow-100 text-yellow-700',
  recria:    'bg-blue-100 text-blue-700',
  engorda:   'bg-green-100 text-green-700',
  comercial: 'bg-violet-100 text-violet-700',
  descarte:  'bg-red-100 text-red-700',
}
const CAT_LABEL: Record<string, string> = {
  matriz:'Matriz', bezerro:'Bezerro', novilha:'Novilha', touro:'Touro', boi:'Boi',
}

const fmt    = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
const hoje = () => new Date().toISOString().split('T')[0]

const EMPTY_LOTE = {
  nome: '', tipo: 'recria', situacao: 'ativo', fazenda_id: '', data_criacao: hoje(),
}

function TipoChip({ tipo }: { tipo: string | null }) {
  if (!tipo) return <span className="text-gray-400">—</span>
  const label = TIPO_LABEL[tipo] ?? tipo
  const color = TIPO_COLOR[tipo] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center h-[34px] px-3 rounded-full text-xs font-semibold ${color}`}>
      {label}
    </span>
  )
}

export default function LotesPage() {
  const [lotes, setLotes]       = useState<Lote[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [loading, setLoading]   = useState(true)
  const [situFiltro, setSituFiltro] = useState<'ativo' | 'encerrado' | ''>('ativo')

  const [selected, setSelected] = useState<Lote | null>(null)
  const [animais, setAnimais]   = useState<Animal[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [openNew, setOpenNew]   = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({ ...EMPTY_LOTE })

  // Add animals dialog
  const [openAdd, setOpenAdd]         = useState(false)
  const [addSearch, setAddSearch]     = useState('')
  const [addCatFilter, setAddCatFilter] = useState('')
  const [availAnimais, setAvailAnimais] = useState<Animal[]>([])
  const [addIds, setAddIds]           = useState<Set<string>>(new Set())
  const [savingAdd, setSavingAdd]     = useState(false)
  const [loadingAvail, setLoadingAvail] = useState(false)

  async function load() {
    setLoading(true)
    const { data: faz } = await supabase.from('fazendas').select('id, nome').order('nome')
    setFazendas(faz ?? [])

    let q = supabase
      .from('lotes')
      .select('id, fazenda_id, nome, tipo, situacao, data_criacao, descricao, observacao')
      .order('nome')
    if (situFiltro) q = (q as any).eq('situacao', situFiltro)

    const { data } = await q
    if (!data) { setLoading(false); return }

    const ids = data.map((l: any) => l.id)
    let custos: Record<string, number>  = {}
    let counts: Record<string, number>  = {}
    if (ids.length > 0) {
      const [{ data: fin }, { data: an }] = await Promise.all([
        supabase.from('financeiro').select('lote_id, tipo, valor').in('lote_id', ids),
        supabase.from('animais').select('lote_id').in('lote_id', ids).eq('status', 'ativo'),
      ])
      for (const f of fin ?? []) {
        if (f.tipo === 'saida') custos[f.lote_id] = (custos[f.lote_id] ?? 0) + Number(f.valor)
      }
      for (const a of an ?? []) {
        counts[a.lote_id] = (counts[a.lote_id] ?? 0) + 1
      }
    }

    setLotes(
      data.map((l: any) => ({
        id: l.id, fazenda_id: l.fazenda_id, nome: l.nome, tipo: l.tipo,
        situacao: l.situacao, data_criacao: l.data_criacao,
        descricao: l.descricao, observacao: l.observacao,
        total_animais: counts[l.id] ?? 0, custo_total: custos[l.id] ?? 0,
      }))
    )
    setLoading(false)
  }

  async function openDetail(lote: Lote) {
    setLoadingDetail(true)
    setSelected(lote)
    window.scrollTo(0, 0)

    const [{ data: an }, { data: fin }] = await Promise.all([
      supabase
        .from('animais')
        .select('id, brinco, nome, categoria, sexo, raca')
        .eq('lote_id', lote.id)
        .eq('status', 'ativo')
        .order('brinco'),
      supabase
        .from('financeiro')
        .select('id, descricao, tipo, valor, data, categoria')
        .eq('lote_id', lote.id)
        .order('data', { ascending: false }),
    ])
    setAnimais(an ?? [])
    setLancamentos(fin ?? [])
    setLoadingDetail(false)
  }

  useEffect(() => { load() }, [situFiltro]) // eslint-disable-line react-hooks/exhaustive-deps

  function setF(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  function openNewDialog() {
    setForm({ ...EMPTY_LOTE, fazenda_id: fazendas[0]?.id ?? '' })
    setOpenNew(true)
  }

  function openEditDialog() {
    if (!selected) return
    setForm({
      nome: selected.nome,
      tipo: selected.tipo ?? 'recria',
      situacao: selected.situacao,
      fazenda_id: selected.fazenda_id ?? fazendas[0]?.id ?? '',
      data_criacao: selected.data_criacao ?? hoje(),
    })
    setOpenEdit(true)
  }

  function buildPayload(f: typeof form) {
    return {
      nome: f.nome.trim(),
      tipo: f.tipo || null,
      situacao: f.situacao,
      fazenda_id: f.fazenda_id || fazendas[0]?.id || null,
      data_criacao: f.data_criacao || hoje(),
    }
  }

  async function salvar() {
    if (!form.nome.trim()) { alert('Nome é obrigatório.'); return }
    setSaving(true)
    const { error } = await supabase.from('lotes').insert(buildPayload(form))
    if (!error) { setOpenNew(false); load() }
    else alert(`Erro: ${error.message}`)
    setSaving(false)
  }

  async function salvarEdit() {
    if (!selected || !form.nome.trim()) { alert('Nome é obrigatório.'); return }
    setSaving(true)
    const payload = buildPayload(form)
    const { error } = await supabase.from('lotes').update(payload).eq('id', selected.id)
    if (!error) {
      setSelected(prev => prev ? { ...prev, ...payload } : prev)
      setOpenEdit(false)
      load()
    } else {
      alert(`Erro: ${error.message}`)
    }
    setSaving(false)
  }

  async function refreshAnimais(loteId: string) {
    const { data } = await supabase
      .from('animais').select('id, brinco, nome, categoria, sexo, raca')
      .eq('lote_id', loteId).eq('status', 'ativo').order('brinco')
    setAnimais(data ?? [])
  }

  async function loadAvailAnimais(search: string, cat: string) {
    setLoadingAvail(true)
    let q = supabase.from('animais')
      .select('id, brinco, nome, categoria, sexo, raca')
      .eq('status', 'ativo').order('brinco').limit(60)
    if (search) q = q.ilike('brinco', `%${search}%`)
    if (cat) q = q.eq('categoria', cat)
    const { data } = await q
    setAvailAnimais(data ?? [])
    setLoadingAvail(false)
  }

  async function handleAddAnimais() {
    if (!selected || addIds.size === 0) return
    setSavingAdd(true)
    await supabase.from('animais').update({ lote_id: selected.id } as any).in('id', [...addIds])
    setSavingAdd(false)
    setOpenAdd(false)
    setAddIds(new Set())
    await refreshAnimais(selected.id)
    load()
  }

  async function handleRemoverAnimal(animalId: string) {
    if (!confirm('Remover este animal do lote?')) return
    await supabase.from('animais').update({ lote_id: null } as any).eq('id', animalId)
    setAnimais(prev => prev.filter(a => a.id !== animalId))
    load()
  }

  async function excluirLote() {
    if (!selected) return
    if (!confirm(`Excluir "${selected.nome}"? Os animais neste lote ficam sem lote.`)) return
    await supabase.from('lotes').delete().eq('id', selected.id)
    setSelected(null)
    load()
  }

  // ── DETALHE ──
  if (selected) {
    const custosTotal = lancamentos
      .filter(l => l.tipo === 'saida')
      .reduce((s, l) => s + Number(l.valor), 0)
    const custoPorCabeca = animais.length > 0 ? custosTotal / animais.length : null

    return (
      <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => setSelected(null)}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 leading-tight">{selected.nome}</h1>
            <p className="text-xs text-gray-500">Criado em {fmtDate(selected.data_criacao)}</p>
          </div>
          {selected.tipo && <TipoChip tipo={selected.tipo} />}
          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
            selected.situacao === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {selected.situacao === 'ativo' ? 'Ativo' : 'Encerrado'}
          </span>
          <button
            onClick={openEditDialog}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 shrink-0"
          >
            <Pencil size={16} />
          </button>
        </div>

        {loadingDetail && <p className="text-sm text-gray-400 text-center py-12">Carregando...</p>}

        {!loadingDetail && (
          <>
            {/* Resumo */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Resumo</p>
              <div className="space-y-2">
                <div className="flex justify-between items-baseline gap-3">
                  <span className="text-sm text-gray-500 shrink-0">Animais no lote</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {animais.length > 0 ? `${animais.length} cab.` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-baseline gap-3">
                  <span className="text-sm text-gray-500 shrink-0">Custo total</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {custosTotal > 0 ? fmt(custosTotal) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-baseline gap-3">
                  <span className="text-sm text-gray-500 shrink-0">Custo / cabeça</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {custoPorCabeca != null ? fmt(custoPorCabeca) : '—'}
                  </span>
                </div>
                {selected.descricao && (
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="text-sm text-gray-500 shrink-0">Descrição</span>
                    <span className="text-sm text-gray-800 text-right">{selected.descricao}</span>
                  </div>
                )}
                {selected.observacao && (
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="text-sm text-gray-500 shrink-0">Observação</span>
                    <span className="text-sm text-gray-800 text-right">{selected.observacao}</span>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={excluirLote}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Excluir lote
                </button>
              </div>
            </div>

            {/* Animais */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  Animais {animais.length > 0 ? `(${animais.length})` : ''}
                </p>
                <button
                  onClick={() => {
                    setAddSearch(''); setAddCatFilter(''); setAvailAnimais([]); setAddIds(new Set())
                    setOpenAdd(true); loadAvailAnimais('', '')
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-green-700 border border-green-200 rounded-lg px-2.5 py-1.5 hover:bg-green-50 transition-colors"
                >
                  <Plus size={12} /> Adicionar
                </button>
              </div>
              {animais.length === 0 && (
                <p className="text-sm text-gray-400">Nenhum animal neste lote.</p>
              )}
              {animais.map((a, i) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 ${i > 0 ? 'pt-3 mt-3 border-t border-gray-100' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{a.brinco}</p>
                    {a.nome && <p className="text-xs text-gray-500">{a.nome}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="text-xs text-gray-500">{CAT_LABEL[a.categoria] ?? a.categoria}</span>
                    <span className="text-xs text-gray-400">{a.sexo === 'femea' ? 'Fêmea' : 'Macho'}</span>
                    <span className="text-xs text-gray-400">{a.raca}</span>
                    <button
                      onClick={() => handleRemoverAnimal(a.id)}
                      title="Remover do lote"
                      className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Histórico financeiro */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Histórico financeiro
              </p>
              {lancamentos.length === 0 && (
                <p className="text-sm text-gray-400">Nenhum lançamento vinculado.</p>
              )}
              {lancamentos.map((l, i) => (
                <div
                  key={l.id}
                  className={`flex items-start gap-3 ${i > 0 ? 'pt-3 mt-3 border-t border-gray-100' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{l.descricao || l.categoria || '—'}</p>
                    <p className="text-xs text-gray-400">{fmtDate(l.data)}</p>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${
                    l.tipo === 'saida' ? 'text-red-600' : 'text-green-700'
                  }`}>
                    {l.tipo === 'saida' ? '− ' : '+ '}{fmt(Number(l.valor))}
                  </span>
                </div>
              ))}
              {lancamentos.length > 0 && custosTotal > 0 && (
                <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">Total custos</span>
                  <span className="text-sm font-bold text-red-600">{fmt(custosTotal)}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Dialog: Adicionar animais */}
        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogContent className="max-h-[85vh] overflow-y-auto w-full max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar ao lote — {selected?.nome}</DialogTitle>
            </DialogHeader>
            <div className="pt-1 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar brinco..."
                  className="pl-9"
                  value={addSearch}
                  onChange={e => { setAddSearch(e.target.value); loadAvailAnimais(e.target.value, addCatFilter) }}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(['', 'matriz', 'bezerro', 'novilha', 'touro', 'boi'] as const).map(c => (
                  <button key={c} onClick={() => { setAddCatFilter(c); loadAvailAnimais(addSearch, c) }}
                    className={`h-[34px] px-3 rounded-full text-xs font-semibold transition-colors ${addCatFilter === c ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {c ? (CAT_LABEL[c] ?? c) : 'Todos'}
                  </button>
                ))}
              </div>
              {loadingAvail && <p className="text-xs text-gray-400 text-center py-4">Carregando...</p>}
              {!loadingAvail && availAnimais.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Nenhum animal encontrado.</p>
              )}
              {!loadingAvail && availAnimais.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  {availAnimais.map((a, i) => {
                    const jaNoLote = animais.some(x => x.id === a.id)
                    return (
                      <label key={a.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 ${i > 0 ? 'border-t border-gray-100' : ''} ${jaNoLote ? 'opacity-40' : ''}`}>
                        <input type="checkbox" checked={addIds.has(a.id) || jaNoLote} disabled={jaNoLote}
                          onChange={e => setAddIds(prev => {
                            const next = new Set(prev)
                            e.target.checked ? next.add(a.id) : next.delete(a.id)
                            return next
                          })}
                          className="rounded border-gray-300 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{a.brinco}</p>
                          <p className="text-xs text-gray-500">
                            {CAT_LABEL[a.categoria] ?? a.categoria} · {a.sexo === 'femea' ? 'Fêmea' : 'Macho'}
                            {jaNoLote && ' · já neste lote'}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setOpenAdd(false)}>Cancelar</Button>
                <Button className="flex-1 bg-green-700 hover:bg-green-800" onClick={handleAddAnimais}
                  disabled={savingAdd || addIds.size === 0}>
                  {savingAdd ? 'Adicionando...' : `Adicionar${addIds.size > 0 ? ` (${addIds.size})` : ''}`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog editar */}
        <Dialog open={openEdit} onOpenChange={setOpenEdit}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Editar Lote</DialogTitle></DialogHeader>
            <LoteForm form={form} setF={setF} fazendas={fazendas} saving={saving} onSave={salvarEdit} label="Salvar alterações" />
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ── LISTA ──
  const ativos     = lotes.filter(l => l.situacao === 'ativo').length
  const encerrados = lotes.filter(l => l.situacao !== 'ativo').length

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-bold text-xl text-gray-900">Lotes</h1>
          <p className="text-sm text-gray-400">Gestão de lotes do rebanho</p>
        </div>
        <button
          onClick={openNewDialog}
          className="flex items-center gap-1.5 bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded-xl hover:bg-green-800 transition-colors shrink-0"
        >
          <Plus size={16} /> Novo
        </button>
      </div>

      {/* Filtro situação */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {([['', `Todos (${ativos + encerrados})`], ['ativo', `Ativos (${ativos})`], ['encerrado', `Encerrados (${encerrados})`]] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setSituFiltro(val)}
            className={`h-[34px] shrink-0 px-3 rounded-full text-xs font-semibold transition-colors ${
              situFiltro === val
                ? 'bg-green-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-gray-400 py-12">Carregando...</p>}

      {!loading && lotes.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base font-medium mb-1">Nenhum lote encontrado</p>
          <p className="text-sm">Crie o primeiro lote para organizar o rebanho.</p>
        </div>
      )}

      {!loading && lotes.length > 0 && (
        <div className="space-y-3">
          {lotes.map(l => (
            <button
              key={l.id}
              onClick={() => openDetail(l)}
              className="w-full text-left bg-white rounded-2xl border border-gray-200 p-4 hover:border-green-300 hover:shadow-sm transition-all active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{l.nome}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Criado em {fmtDate(l.data_criacao)}</p>
                </div>
                {l.tipo && <TipoChip tipo={l.tipo} />}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-gray-600">
                  {(l.total_animais ?? 0) > 0 ? `${l.total_animais} cab.` : '— animais'}
                </span>
                {(l.custo_total ?? 0) > 0 && (
                  <span className="text-red-500 font-medium">custo: {fmt(l.custo_total!)}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Dialog novo lote */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Lote</DialogTitle></DialogHeader>
          <LoteForm form={form} setF={setF} fazendas={fazendas} saving={saving} onSave={salvar} label="Criar Lote" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LoteForm({
  form, setF, fazendas, saving, onSave, label,
}: {
  form: Record<string, any>
  setF: (k: string, v: any) => void
  fazendas: Fazenda[]
  saving: boolean
  onSave: () => void
  label: string
}) {
  return (
    <div className="space-y-3 pt-2">
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Nome do lote</label>
        <Input placeholder="Ex: Lote Recria, Engorda, Gado do Cícero..."
          value={form.nome} onChange={e => setF('nome', e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Tipo</label>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map(t => (
            <button key={t} type="button" onClick={() => setF('tipo', t)}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${form.tipo === t ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
              {TIPO_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Situação</label>
        <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={form.situacao} onChange={e => setF('situacao', e.target.value)}>
          <option value="ativo">Ativo</option>
          <option value="encerrado">Encerrado</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Data de criação</label>
        <Input type="date" value={form.data_criacao} onChange={e => setF('data_criacao', e.target.value)} />
      </div>
      {fazendas.length > 1 && (
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Fazenda</label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={form.fazenda_id} onChange={e => setF('fazenda_id', e.target.value)}>
            {fazendas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
      )}
      <Button className="w-full bg-green-700 hover:bg-green-800" onClick={onSave} disabled={saving}>
        {saving ? 'Salvando...' : label}
      </Button>
    </div>
  )
}
