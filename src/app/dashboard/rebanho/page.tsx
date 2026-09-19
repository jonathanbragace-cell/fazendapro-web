'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Pencil, Trash2, X, Scissors, Skull, AlertTriangle, Baby } from 'lucide-react'

type Animal = {
  id: string; fazenda_id: string; brinco: string; nome?: string
  data_nascimento: string; sexo: string; raca: string; categoria: string
  origem: string; status: string; marcacao?: string | null; status_reprodutivo?: string; valor_compra?: number | null; observacao?: string
  lote?: { id: string; nome: string } | null
  mae_id?: string | null
  mae?: { id: string; brinco: string } | null
}
type Fazenda = { id: string; nome: string }
type Lote    = { id: string; nome: string }
type Roca    = { id: string; nome: string }

const CATS          = ['matriz', 'bezerro', 'novilha', 'touro', 'boi']
const SEXOS         = ['femea', 'macho']
const ORIGENS       = ['nascimento', 'compra']
const DEFAULT_RACAS = ['Nelore', 'Girolando', 'Gir', 'Angus', 'Brahman', 'Tabapuã', 'Mestiço', 'Outra']
const LABELS: Record<string, string> = {
  matriz:'Matriz', bezerro:'Bezerro', novilha:'Novilha', touro:'Touro', boi:'Boi',
  femea:'Fêmea', macho:'Macho', nascimento:'Nascimento', compra:'Compra',
  ativo:'Ativo', vendido:'Vendido', morto:'Morto', descarte:'Descarte', atencao:'Atenção',
  gestante:'Prenha', lactando:'Lactando', vazia:'Vazia', em_diagnostico:'Em diag.',
}

const catColor: Record<string, string> = {
  matriz:'bg-green-100 text-green-800', bezerro:'bg-blue-100 text-blue-800',
  novilha:'bg-yellow-100 text-yellow-800', touro:'bg-gray-100 text-gray-800', boi:'bg-gray-100 text-gray-700',
  ativo:'bg-green-100 text-green-800', vendido:'bg-gray-100 text-gray-600', morto:'bg-red-100 text-red-700', descarte:'bg-orange-100 text-orange-700', atencao:'bg-yellow-100 text-yellow-700',
  gestante:'bg-pink-100 text-pink-800', vazia:'bg-gray-100 text-gray-500', lactando:'bg-blue-100 text-blue-700', em_diagnostico:'bg-yellow-100 text-yellow-700',
}

const EMPTY = {
  brinco:'', nome:'', data_nascimento:'', sexo:'femea', raca:'Nelore',
  categoria:'bezerro', origem:'nascimento', valor_compra:'', status_reprodutivo:'', observacao:'', lote_id:'', fazenda_id:'',
}

export default function RebanhoPage() {
  const supabase = createClient()
  const router = useRouter()
  const [animais, setAnimais] = useState<Animal[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [reproFilter, setReproFilter] = useState('')
  const [sexoFilter, setSexoFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Animal | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<Animal | null>(null)
  const [cargo, setCargo] = useState<string>('')
  const [racas, setRacas] = useState<string[]>(DEFAULT_RACAS)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [reproCounts, setReproCounts] = useState<Record<string, number>>({})
  const [sexoCounts, setSexoCounts] = useState<Record<string, number>>({})
  const [descarteCount, setDescarteCount] = useState(0)
  const [perdaCount, setPerdaCount] = useState(0)
  const [atencaoCount, setAtencaoCount] = useState(0)
  const [novaRaca, setNovaRaca] = useState('')
  const [rocas, setRocas] = useState<Roca[]>([])
  const [loteFilter, setLoteFilter] = useState<string>('')
  const [rocaFilter, setRocaFilter] = useState<string>('')
  const [openAddLote, setOpenAddLote] = useState(false)
  const [availAnimals, setAvailAnimals] = useState<Animal[]>([])
  const [addIds, setAddIds] = useState<Set<string>>(new Set())
  const [savingAdd, setSavingAdd] = useState(false)
  const [openParto, setOpenParto] = useState(false)
  const [partoMae, setPartoMae] = useState<Animal | null>(null)
  const [formParto, setFormParto] = useState({ brinco: '', sexo: 'femea', raca: '', data_nascimento: '' })
  const [savingParto, setSavingParto] = useState(false)
  // Bloco 4: multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastClickIdx, setLastClickIdx] = useState(-1)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState('')
  const [bulkLoteId, setBulkLoteId] = useState('')
  const [bulkRocaId, setBulkRocaId] = useState('')
  const [bulkPeso, setBulkPeso] = useState('')
  const [bulkPesoData, setBulkPesoData] = useState('')
  const [bulkSanitario, setBulkSanitario] = useState({ produto: '', data: '', proxima: '', via: 'injetavel' })
  const [savingBulk, setSavingBulk] = useState(false)

  async function addRaca() {
    const r = novaRaca.trim()
    if (!r || racas.includes(r)) { setNovaRaca(''); return }
    await supabase.from('racas').insert({ nome: r })
    setRacas(prev => [...prev, r])
    setForm(prev => ({ ...prev, raca: r }))
    setNovaRaca('')
  }

  async function removeRaca(raca: string) {
    await supabase.from('racas').delete().eq('nome', raca)
    setRacas(prev => prev.filter(r => r !== raca))
    setForm(prev => ({ ...prev, raca: prev.raca === raca ? (racas.filter(r => r !== raca)[0] ?? '') : prev.raca }))
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('cargo').eq('id', user.id).single()
        .then(({ data }) => { if (data?.cargo) setCargo(data.cargo) })
    })
  }, [])

  async function load() {
    setLoading(true)
    const { data: faz } = await supabase.from('fazendas').select('id, nome').order('nome')
    const { data: lots } = await supabase.from('lotes').select('id, nome, fazenda_id').order('nome')
    const { data: rocasDb2 } = await supabase.from('rocas').select('id, nome').order('nome')
    setRocas(rocasDb2 ?? [])
    const { data: racasDb } = await supabase.from('racas').select('nome').order('nome')
    if (racasDb && racasDb.length > 0) setRacas(racasDb.map(r => r.nome))
    else setRacas(DEFAULT_RACAS)

    // Contagens para os filtros (sem filtro de categoria/repro/sexo)
    let cq = supabase.from('animais').select('categoria, status_reprodutivo, sexo, status, marcacao').in('status', ['ativo', 'morto'])
    if (search) cq = cq.ilike('brinco', `%${search}%`)
    const { data: all } = await cq
    const newCounts: Record<string, number> = { '': 0 }
    const newRepro: Record<string, number> = { '': 0 }
    const newSexo: Record<string, number> = { '': 0 }
    let newDescarte = 0, newPerda = 0, newAtencao = 0
    for (const a of all ?? []) {
      if (a.status === 'morto') { newPerda++; continue }
      if (a.marcacao === 'descarte') newDescarte++
      if (a.marcacao === 'atencao') newAtencao++
      newCounts[''] = (newCounts[''] ?? 0) + 1
      newCounts[a.categoria] = (newCounts[a.categoria] ?? 0) + 1
      if (a.status_reprodutivo) newRepro[a.status_reprodutivo] = (newRepro[a.status_reprodutivo] ?? 0) + 1
      if (a.categoria === 'bezerro') {
        newSexo[''] = (newSexo[''] ?? 0) + 1
        newSexo[a.sexo] = (newSexo[a.sexo] ?? 0) + 1
      }
    }
    newRepro[''] = newCounts['matriz'] ?? 0
    setCounts(newCounts)
    setReproCounts(newRepro)
    setSexoCounts(newSexo)
    setDescarteCount(newDescarte)
    setPerdaCount(newPerda)
    setAtencaoCount(newAtencao)

    let q = supabase.from('animais').select('*, lote:lotes(id, nome), mae:animais!mae_id(id, brinco)').order('brinco')
    if (catFilter === 'descarte') {
      q = q.eq('status', 'ativo').eq('marcacao', 'descarte')
    } else if (catFilter === 'perda') {
      q = q.eq('status', 'morto')
    } else if (catFilter === 'atencao') {
      q = q.eq('status', 'ativo').eq('marcacao', 'atencao')
    } else {
      q = q.eq('status', 'ativo')
      if (catFilter) q = q.eq('categoria', catFilter)
      if (reproFilter) q = q.eq('status_reprodutivo', reproFilter)
      if (sexoFilter && catFilter === 'bezerro') q = q.eq('sexo', sexoFilter)
    }
    if (search) q = q.ilike('brinco', `%${search}%`)
    if (loteFilter === 'sem_lote') {
      q = q.is('lote_id', null)
    } else if (loteFilter) {
      q = q.eq('lote_id', loteFilter)
    }
    if (rocaFilter === 'sem_roca') {
      q = (q as any).is('roca_id', null)
    } else if (rocaFilter) {
      q = (q as any).eq('roca_id', rocaFilter)
    }
    let { data: anim, error: qErr } = await q
    if (qErr && /roca_id|PGRST204/.test(qErr.message + (qErr.code ?? ''))) {
      setRocaFilter('')
      const { data: anim2 } = await supabase.from('animais').select('*, lote:lotes(id, nome), mae:animais!mae_id(id, brinco)').order('brinco').eq('status', 'ativo')
      anim = anim2
    }
    const sorted = (anim ?? []).sort((a, b) => {
      const na = parseInt(a.brinco.replace(/\D/g, '')) || 0
      const nb = parseInt(b.brinco.replace(/\D/g, '')) || 0
      return na - nb
    })
    setFazendas(faz ?? [])
    setLotes(lots ?? [])
    setAnimais(sorted)
    setLoading(false)
  }

  useEffect(() => { load() }, [catFilter, reproFilter, sexoFilter, loteFilter, rocaFilter])
  useEffect(() => {
    const t = setTimeout(() => load(), 350)
    return () => clearTimeout(t)
  }, [search])

  // Realtime: atualiza automaticamente em todos os aparelhos
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  useEffect(() => {
    const channel = supabase
      .channel('rebanho-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'animais' }, () => {
        loadRef.current()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY, fazenda_id: fazendas[0]?.id ?? '' })
    setOpen(true)
  }

  function openEdit(a: Animal) {
    setEditing(a)
    setForm({
      brinco: a.brinco, nome: a.nome ?? '', data_nascimento: a.data_nascimento,
      sexo: a.sexo, raca: a.raca, categoria: a.categoria, origem: a.origem,
      status_reprodutivo: a.status_reprodutivo ?? '', valor_compra: a.valor_compra ? String(a.valor_compra) : '',
      observacao: a.observacao ?? '', lote_id: (a.lote as any)?.id ?? '', fazenda_id: a.fazenda_id,
    })
    setOpen(true)
    setDetail(null)
  }

  function fmtDate(iso: string) {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  function toISO(str: string) {
    const [d, m, y] = str.split('/')
    return `${y}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}`
  }

  function fmtMoney(value: number | string) {
    if (value === undefined || value === null || value === '') return ''
    const amount = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
    return Number.isNaN(amount) ? '' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
  }

  async function gerarBrinco(): Promise<string> {
    const { count } = await supabase.from('animais').select('*', { count: 'exact', head: true })
    const num = String((count ?? 0) + 1).padStart(4, '0')
    return `S/N-${num}`
  }

  async function handleSave() {
    setSaving(true)
    const fid = form.fazenda_id || fazendas[0]?.id
    const brinco = form.brinco.trim()
      ? form.brinco.trim().toUpperCase()
      : await gerarBrinco()
    const dataNasc = form.data_nascimento
      ? (form.data_nascimento.includes('/') ? toISO(form.data_nascimento) : form.data_nascimento)
      : new Date().toISOString().split('T')[0]

    // Verifica duplicidade de brinco
    const { data: dup } = await supabase.from('animais').select('id').ilike('brinco', brinco).limit(1)
    const isDup = dup && dup.length > 0 && (!editing || dup[0].id !== editing.id)
    if (isDup) {
      alert(`Brinco "${brinco}" já está cadastrado. Escolha outro número.`)
      setSaving(false)
      return
    }

    const payload: any = {
      brinco,
      nome: form.nome.trim() || null,
      data_nascimento: dataNasc,
      sexo: form.sexo, raca: form.raca, categoria: form.categoria,
      origem: form.origem, status_reprodutivo: form.categoria === 'matriz' ? (form.status_reprodutivo || null) : null,
      valor_compra: form.origem === 'compra' && form.valor_compra ? parseFloat(form.valor_compra.replace(',', '.')) : null,
      observacao: form.observacao.trim() || null,
      lote_id: form.lote_id || null, fazenda_id: fid,
      status: 'ativo',
    }
    let error
    // Try save, if schema missing (e.g. valor_compra) retry without that field
    if (editing) {
      ({ error } = await supabase.from('animais').update(payload).eq('id', editing.id))
      if (error && /Could not find the 'valor_compra' column|PGRST204/.test(error.message + (error.code ?? ''))) {
        const p = { ...payload }
        delete p.valor_compra
        ;({ error } = await supabase.from('animais').update(p).eq('id', editing.id))
      }
    } else {
      ({ error } = await supabase.from('animais').insert(payload))
      if (error && /Could not find the 'valor_compra' column|PGRST204/.test(error.message + (error.code ?? ''))) {
        const p = { ...payload }
        delete p.valor_compra
        ;({ error } = await supabase.from('animais').insert(p))
      }
    }
    if (error) {
      alert(`Erro ao salvar: ${error.message}\nCódigo: ${error.code}\nDetalhe: ${error.details ?? '—'}`)
      setSaving(false)
      return
    }
    setSaving(false)
    setOpen(false)
    load()
  }

  async function handleDelete(a: Animal) {
    if (!confirm(`Excluir permanentemente o animal ${a.brinco}? Esta ação não pode ser desfeita.`)) return
    await supabase.from('animais').delete().eq('id', a.id)
    setDetail(null)
    load()
  }

  function abrirParto(mae: Animal) {
    const hoje = new Date().toISOString().split('T')[0].split('-').reverse().join('/')
    setPartoMae(mae)
    setFormParto({ brinco: '', sexo: 'femea', raca: mae.raca, data_nascimento: hoje })
    setDetail(null)
    setOpenParto(true)
  }

  async function handleSaveParto() {
    if (!partoMae) return
    setSavingParto(true)
    const brinco = formParto.brinco.trim().toUpperCase()
    if (brinco) {
      const { data: dup } = await supabase.from('animais').select('id').ilike('brinco', brinco).limit(1)
      if (dup && dup.length > 0) {
        alert(`Brinco "${brinco}" já está cadastrado. Escolha outro número.`)
        setSavingParto(false)
        return
      }
    }
    const dataNasc = formParto.data_nascimento
      ? (formParto.data_nascimento.includes('/') ? toISO(formParto.data_nascimento) : formParto.data_nascimento)
      : new Date().toISOString().split('T')[0]
    const finalBrinco = brinco || await gerarBrinco()
    const { error } = await supabase.from('animais').insert({
      brinco: finalBrinco, categoria: 'bezerro', sexo: formParto.sexo,
      raca: formParto.raca, origem: 'nascimento', data_nascimento: dataNasc,
      fazenda_id: partoMae.fazenda_id, status: 'ativo', mae_id: partoMae.id,
    })
    if (error) { alert('Erro ao registrar parto: ' + error.message); setSavingParto(false); return }
    // Atualiza status da mãe para lactando
    await supabase.from('animais').update({ status_reprodutivo: 'lactando' }).eq('id', partoMae.id)
    setSavingParto(false)
    setOpenParto(false)
    load()
  }

  async function handleBaixa(a: Animal, tipo: 'vendido' | 'morto') {
    if (!confirm(`Confirma marcar ${a.brinco} como ${tipo}?`)) return
    await supabase.from('animais').update({ status: tipo }).eq('id', a.id)
    setDetail(null)
    load()
  }

  async function handleDescarte(a: Animal) {
    if (a.marcacao === 'descarte') {
      const { error } = await supabase.from('animais').update({ marcacao: null }).eq('id', a.id)
      if (error) { alert('Erro ao remover descarte: ' + error.message); return }
    } else {
      if (!confirm(`Marcar animal ${a.brinco} para descarte?`)) return
      const { error } = await supabase.from('animais').update({ marcacao: 'descarte' }).eq('id', a.id)
      if (error) { alert('Erro ao marcar descarte: ' + error.message); return }
    }
    setDetail(null)
    load()
  }

  async function handleAtencao(a: Animal) {
    if (a.marcacao === 'atencao') {
      const { error } = await supabase.from('animais').update({ marcacao: null }).eq('id', a.id)
      if (error) { alert('Erro: ' + error.message); return }
    } else {
      const { error } = await supabase.from('animais').update({ marcacao: 'atencao' }).eq('id', a.id)
      if (error) { alert('Erro ao marcar atenção: ' + error.message); return }
    }
    setDetail(null)
    load()
  }

  function toggleSelect(id: string, idx: number, shift: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      if (shift && lastClickIdx >= 0) {
        const [from, to] = lastClickIdx < idx ? [lastClickIdx, idx] : [idx, lastClickIdx]
        animais.slice(from, to + 1).forEach(a => next.add(a.id))
      } else {
        next.has(id) ? next.delete(id) : next.add(id)
        setLastClickIdx(idx)
      }
      return next
    })
  }

  function toggleAll() {
    if (selected.size > 0) setSelected(new Set())
    else setSelected(new Set(animais.map(a => a.id)))
  }

  function openBulk(action: string) {
    const hoje = new Date().toISOString().split('T')[0]
    if (action === 'pesagem') { setBulkPeso(''); setBulkPesoData(hoje) }
    if (action === 'sanitario') setBulkSanitario({ produto: '', data: hoje, proxima: '', via: 'injetavel' })
    if (action === 'lote') setBulkLoteId('')
    if (action === 'roca') setBulkRocaId('')
    setBulkAction(action)
    setBulkOpen(true)
  }

  async function executeBulkAction() {
    const ids = [...selected]
    if (ids.length === 0) return
    setSavingBulk(true)
    switch (bulkAction) {
      case 'lote':
        await supabase.from('animais').update({ lote_id: bulkLoteId || null }).in('id', ids)
        break
      case 'roca':
        await (supabase.from('animais') as any).update({ roca_id: bulkRocaId || null }).in('id', ids)
        break
      case 'descarte':
        await supabase.from('animais').update({ marcacao: 'descarte' } as any).in('id', ids)
        break
      case 'undescarte':
      case 'unatencao':
        await supabase.from('animais').update({ marcacao: null } as any).in('id', ids)
        break
      case 'atencao':
        await supabase.from('animais').update({ marcacao: 'atencao' } as any).in('id', ids)
        break
      case 'pesagem': {
        const kg = parseFloat(bulkPeso.replace(',', '.'))
        if (isNaN(kg) || kg <= 0) { alert('Informe o peso.'); setSavingBulk(false); return }
        await supabase.from('pesagens').insert(ids.map(id => ({
          animal_id: id, peso_kg: kg, data: bulkPesoData || new Date().toISOString().split('T')[0],
        })))
        break
      }
      case 'sanitario': {
        if (!bulkSanitario.produto.trim()) { alert('Informe o produto.'); setSavingBulk(false); return }
        await supabase.from('sanitario').insert(ids.map(id => ({
          animal_id: id, produto: bulkSanitario.produto.trim(),
          data: bulkSanitario.data || new Date().toISOString().split('T')[0],
          proxima_aplicacao: bulkSanitario.proxima || null, via: bulkSanitario.via,
        })))
        break
      }
    }
    setSavingBulk(false)
    setBulkOpen(false)
    setSelected(new Set())
    setLastClickIdx(-1)
    load()
  }

  async function openAddToLote() {
    const { data } = await supabase.from('animais').select('*').eq('status', 'ativo').is('lote_id', null).order('brinco')
    const sorted = (data ?? []).sort((a, b) => {
      const na = parseInt(a.brinco.replace(/\D/g, '')) || 0
      const nb = parseInt(b.brinco.replace(/\D/g, '')) || 0
      return na - nb
    })
    setAvailAnimals(sorted)
    setAddIds(new Set())
    setOpenAddLote(true)
  }

  async function handleAddToLote() {
    if (addIds.size === 0 || !loteFilter || loteFilter === 'sem_lote') return
    setSavingAdd(true)
    await supabase.from('animais').update({ lote_id: loteFilter }).in('id', [...addIds])
    setSavingAdd(false)
    setOpenAddLote(false)
    load()
  }

  async function handleRemoveFromLote(animalId: string) {
    await supabase.from('animais').update({ lote_id: null }).eq('id', animalId)
    load()
  }

  const f = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Rebanho</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5">{counts[''] ?? animais.length} ativo(s)</p>
        </div>
        <Button onClick={openNew} className="bg-green-700 hover:bg-green-800 text-white gap-1.5 text-sm px-3 py-2">
          <Plus size={15} /> <span className="hidden sm:inline">Novo animal</span><span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {/* Busca */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input placeholder="Buscar brinco..." className={`pl-9 w-full ${search ? 'pr-8' : ''}`} value={search} onChange={e => setSearch(e.target.value)} />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filtros — scroll horizontal no mobile */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap scrollbar-none">
        {['', ...CATS].map(c => (
          <button key={c} onClick={() => { setCatFilter(c); setReproFilter(''); setSexoFilter('') }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${catFilter === c ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'}`}>
            {c ? LABELS[c] : 'Todos'}{counts[c] != null ? ` (${counts[c]})` : ''}
          </button>
        ))}
        {catFilter === 'matriz' && (['', 'gestante', 'vazia'] as const).map(r => (
          <button key={r} onClick={() => setReproFilter(r)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${reproFilter === r ? (r === 'gestante' ? 'bg-pink-500 text-white border-pink-500' : r === 'vazia' ? 'bg-gray-500 text-white border-gray-500' : 'bg-green-700 text-white border-green-700') : 'bg-white text-gray-600 border-gray-200'}`}>
            {r === '' ? 'Todas' : r === 'gestante' ? 'Prenha' : 'Vazia'}{reproCounts[r] != null ? ` (${reproCounts[r]})` : ''}
          </button>
        ))}
        {catFilter === 'bezerro' && (['', 'femea', 'macho'] as const).map(s => (
          <button key={s} onClick={() => setSexoFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${sexoFilter === s ? (s === 'femea' ? 'bg-pink-400 text-white border-pink-400' : s === 'macho' ? 'bg-blue-500 text-white border-blue-500' : 'bg-green-700 text-white border-green-700') : 'bg-white text-gray-600 border-gray-200'}`}>
            {s === '' ? 'Todos' : s === 'femea' ? '♀ Fêmea' : '♂ Macho'}{sexoCounts[s] != null ? ` (${sexoCounts[s]})` : ''}
          </button>
        ))}
        <button onClick={() => { setCatFilter('descarte'); setReproFilter(''); setSexoFilter('') }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${catFilter === 'descarte' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-orange-600 border-orange-200'}`}>
          <Scissors size={11} /> Descarte{descarteCount > 0 ? ` (${descarteCount})` : ''}
        </button>
        <button onClick={() => { setCatFilter('perda'); setReproFilter(''); setSexoFilter('') }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${catFilter === 'perda' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-500 border-red-200'}`}>
          <Skull size={11} /> Perda{perdaCount > 0 ? ` (${perdaCount})` : ''}
        </button>
        <button onClick={() => { setCatFilter('atencao'); setReproFilter(''); setSexoFilter('') }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${catFilter === 'atencao' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-yellow-600 border-yellow-300'}`}>
          <AlertTriangle size={11} /> Atenção{atencaoCount > 0 ? ` (${atencaoCount})` : ''}
        </button>
      </div>

      {/* Filtro por lote */}
      {lotes.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
          <button onClick={() => setLoteFilter('')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${loteFilter === '' ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
            Todo lote
          </button>
          <button onClick={() => setLoteFilter('sem_lote')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${loteFilter === 'sem_lote' ? 'bg-gray-600 text-white border-gray-600' : 'bg-white text-gray-500 border-gray-200'}`}>
            Sem lote
          </button>
          {lotes.map(l => (
            <button key={l.id} onClick={() => setLoteFilter(l.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${loteFilter === l.id ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
              {l.nome}
            </button>
          ))}
        </div>
      )}

      {/* Filtro por roça */}
      {rocas.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
          <button onClick={() => setRocaFilter('')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${rocaFilter === '' ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
            Toda roça
          </button>
          <button onClick={() => setRocaFilter('sem_roca')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${rocaFilter === 'sem_roca' ? 'bg-gray-600 text-white border-gray-600' : 'bg-white text-gray-500 border-gray-200'}`}>
            Sem roça
          </button>
          {rocas.map(r => (
            <button key={r.id} onClick={() => setRocaFilter(r.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${rocaFilter === r.id ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
              {r.nome}
            </button>
          ))}
        </div>
      )}

      {/* Detalhe do lote selecionado */}
      {loteFilter && loteFilter !== 'sem_lote' && (() => {
        const lot = lotes.find(l => l.id === loteFilter)
        if (!lot) return null
        const semValor = animais.filter(a => !a.valor_compra).length
        const totalValor = animais.reduce((s, a) => s + (a.valor_compra ?? 0), 0)
        return (
          <div className="bg-white rounded-xl border border-green-200 p-3 mb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{lot.nome}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {animais.length} animal(is){totalValor > 0 ? ` · ${fmtMoney(totalValor)}` : ''}
                </p>
              </div>
              <button onClick={openAddToLote}
                className="flex items-center gap-1 text-xs font-semibold text-green-700 border border-green-300 rounded-lg px-2.5 py-1.5 hover:bg-green-50 transition-colors shrink-0">
                <Plus size={12} /> Adicionar
              </button>
            </div>
            {semValor > 0 && (
              <div className="mt-2 flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">{semValor} animal(is) sem valor de compra informado</p>
              </div>
            )}
          </div>
        )
      })()}

      {/* Barra de ações em massa */}
      {selected.size > 0 && (
        <div className="fixed md:relative bottom-16 md:bottom-auto left-0 right-0 md:left-auto md:right-auto z-30 bg-white border border-gray-200 md:rounded-xl shadow-xl md:shadow-sm px-4 py-3 mb-3 flex items-center gap-3 overflow-x-auto">
          <span className="text-sm font-bold text-gray-900 shrink-0">{selected.size} selecionado{selected.size !== 1 ? 's' : ''}</span>
          <button onClick={() => { setSelected(new Set()); setLastClickIdx(-1) }} className="text-gray-400 hover:text-gray-700 shrink-0 p-1 rounded-full hover:bg-gray-100 transition-colors">
            <X size={14} />
          </button>
          <div className="flex gap-2 overflow-x-auto">
            {lotes.length > 0 && (
              <button onClick={() => openBulk('lote')} className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 whitespace-nowrap transition-colors">
                Mover para lote
              </button>
            )}
            {rocas.length > 0 && (
              <button onClick={() => openBulk('roca')} className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 whitespace-nowrap transition-colors">
                Mover para roça
              </button>
            )}
            <button onClick={() => openBulk('descarte')} className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 whitespace-nowrap transition-colors">
              Marcar descarte
            </button>
            <button onClick={() => openBulk('undescarte')} className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 whitespace-nowrap transition-colors">
              Remover descarte
            </button>
            <button onClick={() => openBulk('atencao')} className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 whitespace-nowrap transition-colors">
              Marcar atenção
            </button>
            <button onClick={() => openBulk('unatencao')} className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 whitespace-nowrap transition-colors">
              Remover atenção
            </button>
            <button onClick={() => openBulk('pesagem')} className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 whitespace-nowrap transition-colors">
              Pesagem em lote
            </button>
            <button onClick={() => openBulk('sanitario')} className="px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 whitespace-nowrap transition-colors">
              Sanitário em lote
            </button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading
          ? <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          : animais.length === 0
            ? <div className="p-8 text-center text-gray-400 text-sm">Nenhum animal encontrado.</div>
            : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 w-8">
                      <input type="checkbox"
                        checked={animais.length > 0 && selected.size === animais.length}
                        ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < animais.length }}
                        onChange={toggleAll}
                        className="rounded border-gray-300 cursor-pointer" />
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Brinco</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoria</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reprod.</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Raça</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Lote</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {animais.map((a, idx) => (
                    <tr key={a.id} className={`hover:bg-gray-50 transition-colors ${selected.has(a.id) ? 'bg-green-50/60' : ''}`}>
                      <td className="px-3 py-2 w-8">
                        <input type="checkbox"
                          checked={selected.has(a.id)}
                          onClick={e => { e.stopPropagation(); toggleSelect(a.id, idx, (e as React.MouseEvent).shiftKey) }}
                          onChange={() => {}}
                          className="rounded border-gray-300 cursor-pointer" />
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-900">
                        <button onClick={() => setDetail(a)} className="hover:text-green-700 hover:underline">{a.brinco}</button>
                        {a.nome && <p className="text-xs text-gray-400 font-normal">{a.nome}</p>}
                      </td>
                      <td className="px-3 py-2">
                        {a.categoria === 'bezerro'
                          ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.sexo === 'femea' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                              {a.sexo === 'femea' ? '♀ Bez.' : '♂ Bez.'}
                            </span>
                          : <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catColor[a.categoria] ?? 'bg-gray-100 text-gray-600'}`}>{LABELS[a.categoria]}</span>
                        }
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {a.categoria === 'matriz' && a.status_reprodutivo === 'gestante' && (
                            <button onClick={() => abrirParto(a)}
                              title="Registrar parto"
                              className="p-1 text-pink-400 hover:text-pink-600 transition-colors">
                              <Baby size={14} />
                            </button>
                          )}
                          {a.marcacao !== 'descarte' && (
                            <button onClick={() => openEdit(a)} className="text-gray-400 hover:text-green-600 p-1"><Pencil size={14} /></button>
                          )}
                          <button onClick={() => handleDescarte(a)}
                            title={a.marcacao === 'descarte' ? 'Remover descarte' : 'Marcar para descarte'}
                            className={`p-1 transition-colors ${a.marcacao === 'descarte' ? 'text-orange-400' : 'text-gray-300 hover:text-orange-500'}`}>
                            <Scissors size={13} />
                          </button>
                          {a.status !== 'morto' && (
                            <button onClick={() => { if (confirm(`Registrar perda do animal ${a.brinco}?`)) { supabase.from('animais').update({ status: 'morto' }).eq('id', a.id).then(() => load()) } }}
                              title="Registrar perda (morte)"
                              className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                              <Skull size={13} />
                            </button>
                          )}
                          {a.status !== 'morto' && (
                            <button onClick={() => handleAtencao(a)}
                              title={a.marcacao === 'atencao' ? 'Remover atenção' : 'Colocar sob atenção'}
                              className={`p-1 transition-colors ${a.marcacao === 'atencao' ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'}`}>
                              <AlertTriangle size={13} />
                            </button>
                          )}
                          {loteFilter && loteFilter !== 'sem_lote' && (
                            <button onClick={() => handleRemoveFromLote(a.id)}
                              title="Remover do lote"
                              className="p-1 text-gray-300 hover:text-orange-400 transition-colors">
                              <X size={13} />
                            </button>
                          )}
                          {cargo === 'admin' && (
                            <button onClick={() => handleDelete(a)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {a.status_reprodutivo
                          ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catColor[a.status_reprodutivo] ?? 'bg-gray-100 text-gray-500'}`}>{LABELS[a.status_reprodutivo] ?? a.status_reprodutivo}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600 hidden sm:table-cell">{a.raca}</td>
                      <td className="px-3 py-2">
                        {(() => {
                          const key = a.marcacao === 'descarte' ? 'descarte' : a.marcacao === 'atencao' ? 'atencao' : a.status
                          return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catColor[key] ?? ''}`}>{LABELS[key] ?? key}</span>
                        })()}
                      </td>
                      <td className="px-3 py-2 text-gray-500 hidden md:table-cell">{(a.lote as any)?.nome ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )
        }
      </div>

      {/* Modal cadastro/edição */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-lg max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-14 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:translate-x-0 max-sm:translate-y-0 max-sm:left-0 max-sm:max-w-none overflow-y-auto max-h-[90vh] max-sm:max-h-full">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar animal' : 'Novo animal'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {fazendas.length > 1 && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Fazenda *</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.fazenda_id} onChange={e => f('fazenda_id', e.target.value)}>
                  {fazendas.map(fz => <option key={fz.id} value={fz.id}>{fz.nome}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Brinco <span className="text-gray-400 font-normal">(opcional)</span></label>
                <Input placeholder="Gerado automaticamente" value={form.brinco} onChange={e => f('brinco', e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Nome/Apelido</label>
                <Input placeholder="Opcional" value={form.nome} onChange={e => f('nome', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Nascimento <span className="text-gray-400 font-normal">(opcional)</span></label>
              <Input placeholder="DD/MM/AAAA" value={form.data_nascimento.includes('-') ? fmtDate(form.data_nascimento) : form.data_nascimento}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '')
                  let s = v
                  if (v.length > 2) s = v.slice(0, 2) + '/' + v.slice(2)
                  if (v.length > 4) s = s.slice(0, 5) + '/' + v.slice(4, 8)
                  f('data_nascimento', s)
                }} maxLength={10} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Sexo *</label>
              <div className="flex gap-2">
                {SEXOS.map(s => <button key={s} type="button" onClick={() => f('sexo', s)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${form.sexo === s ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                  {LABELS[s]}
                </button>)}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Categoria *</label>
              <div className="flex flex-wrap gap-2">
                {CATS.map(c => <button key={c} type="button" onClick={() => setForm(prev => ({ ...prev, categoria: c, status_reprodutivo: c === 'matriz' ? prev.status_reprodutivo : '' }))}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${form.categoria === c ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                  {LABELS[c]}
                </button>)}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Origem *</label>
              <div className="flex gap-2">
                {ORIGENS.map(o => <button key={o} type="button" onClick={() => setForm(prev => ({ ...prev, origem: o, valor_compra: o === 'compra' ? prev.valor_compra : '' }))}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${form.origem === o ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                  {LABELS[o]}
                </button>)}
              </div>
            </div>
            {form.origem === 'compra' && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Preço de compra</label>
                <Input
                  placeholder="0,00"
                  value={form.valor_compra}
                  onChange={e => f('valor_compra', e.target.value)}
                  inputMode="decimal"
                />
              </div>
            )}
            {form.categoria === 'matriz' && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Matriz</label>
                <div className="flex gap-2">
                  {(['gestante', 'vazia'] as const).map(s => (
                    <button key={s} type="button" onClick={() => f('status_reprodutivo', s)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${form.status_reprodutivo === s ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                      {LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Raça *</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {racas.map(r => (
                  <div key={r} className={`flex items-center gap-1 pl-3 pr-1 py-1.5 rounded-full border text-xs font-medium transition-colors ${form.raca === r ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                    <button type="button" onClick={() => f('raca', r)}>{r}</button>
                    <button type="button" onClick={() => removeRaca(r)}
                      className={`rounded-full p-0.5 hover:bg-black/10 ${form.raca === r ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-red-500'}`}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Nova raça..."
                  value={novaRaca}
                  onChange={e => setNovaRaca(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRaca() } }}
                />
                <button type="button" onClick={addRaca}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:border-green-400 hover:text-green-700 transition-colors whitespace-nowrap">
                  + Adicionar
                </button>
              </div>
            </div>
            {lotes.filter(l => !form.fazenda_id || (l as any).fazenda_id === form.fazenda_id).length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Lote</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.lote_id} onChange={e => f('lote_id', e.target.value)}>
                  <option value="">Sem lote</option>
                  {lotes.filter(l => !form.fazenda_id || (l as any).fazenda_id === form.fazenda_id).map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Observações</label>
              <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" rows={2} placeholder="Anotações..." value={form.observacao} onChange={e => f('observacao', e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800 text-white" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal detalhe */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) setDetail(null) }}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full max-w-md p-5 md:p-6 relative max-h-[85vh] overflow-y-auto">
            <button onClick={() => setDetail(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-50 rounded-xl w-12 h-12 flex items-center justify-center">
                <span className="text-green-700 font-bold text-sm">{detail.brinco.slice(0,3)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-lg">{detail.brinco}</p>
                {detail.nome && <p className="text-gray-500 text-sm">{detail.nome}</p>}
              </div>
              <button onClick={() => { setDetail(null); router.push(`/dashboard/rebanho/${detail.id}`) }} className="text-xs font-semibold text-green-700 border border-green-200 rounded-lg px-2.5 py-1.5 hover:bg-green-50 transition-colors whitespace-nowrap">
                Ver ficha →
              </button>
            </div>
            <div className="space-y-2 text-sm mb-5">
              {[
                ['Categoria', LABELS[detail.categoria]],
                ['Raça', detail.raca],
                ['Sexo', LABELS[detail.sexo]],
                ['Origem', LABELS[detail.origem]],
                ['Nascimento', fmtDate(detail.data_nascimento)],
                ['Lote', (detail.lote as any)?.nome ?? '—'],
                detail.origem === 'compra' && detail.valor_compra ? ['Preço de compra', fmtMoney(detail.valor_compra)] : null,
                detail.status_reprodutivo ? ['Status reprod.', LABELS[detail.status_reprodutivo] ?? detail.status_reprodutivo] : null,
                detail.mae?.brinco ? ['Mãe (brinco)', detail.mae.brinco] : null,
                detail.observacao ? ['Obs', detail.observacao] : null,
              ].filter(Boolean).map(([k, v]: any) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-900">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {detail.categoria === 'matriz' && detail.status_reprodutivo === 'gestante' && (
                <Button className="w-full bg-pink-600 hover:bg-pink-700 text-white gap-2" onClick={() => abrirParto(detail)}>
                  <Baby size={15}/> Registrar parto
                </Button>
              )}
              {detail.marcacao !== 'descarte' && (
                <Button variant="outline" className="flex-1 gap-1" onClick={() => openEdit(detail)}><Pencil size={14}/>Editar</Button>
              )}
              <Button variant="outline"
                className={`flex-1 gap-1 ${detail.marcacao === 'descarte' ? 'border-gray-200 text-gray-600 hover:bg-gray-50' : 'border-orange-200 text-orange-600 hover:bg-orange-50'}`}
                onClick={() => handleDescarte(detail)}>
                <Scissors size={14}/>{detail.marcacao === 'descarte' ? 'Remover descarte' : 'Descarte'}
              </Button>
              {detail.status !== 'morto' && (
                <Button variant="outline"
                  className={`flex-1 gap-1 ${detail.marcacao === 'atencao' ? 'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100' : 'border-yellow-200 text-yellow-600 hover:bg-yellow-50'}`}
                  onClick={() => handleAtencao(detail)}>
                  <AlertTriangle size={14}/>{detail.marcacao === 'atencao' ? 'Remover atenção' : 'Atenção'}
                </Button>
              )}
              {detail.marcacao !== 'descarte' && detail.status !== 'morto' && (
                <>
                  <Button variant="outline" className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => handleBaixa(detail, 'vendido')}>Vendido</Button>
                  <Button variant="outline" className="flex-1 gap-1 border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleBaixa(detail, 'morto')}>
                    <Skull size={13}/> Perda
                  </Button>
                </>
              )}
              {cargo === 'admin' && (
                <Button variant="outline" className="w-full border-red-300 text-red-600 hover:bg-red-50 gap-1" onClick={() => handleDelete(detail)}>
                  <Trash2 size={14}/> Excluir permanentemente
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dialog: Confirmação de ação em massa */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {bulkAction === 'lote' && 'Mover para lote'}
              {bulkAction === 'roca' && 'Mover para roça'}
              {bulkAction === 'descarte' && 'Marcar como descarte'}
              {bulkAction === 'undescarte' && 'Remover marcação descarte'}
              {bulkAction === 'atencao' && 'Marcar como atenção'}
              {bulkAction === 'unatencao' && 'Remover marcação atenção'}
              {bulkAction === 'pesagem' && 'Registrar pesagem em lote'}
              {bulkAction === 'sanitario' && 'Aplicação sanitária em lote'}
            </DialogTitle>
          </DialogHeader>
          <div className="pt-1 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <p className="text-sm font-semibold text-green-800">{selected.size} animal{selected.size !== 1 ? 'is' : ''} serão afetados</p>
            </div>

            {bulkAction === 'lote' && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Lote de destino</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={bulkLoteId} onChange={e => setBulkLoteId(e.target.value)}>
                  <option value="">Remover do lote (sem lote)</option>
                  {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </div>
            )}

            {bulkAction === 'roca' && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Roça de destino</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={bulkRocaId} onChange={e => setBulkRocaId(e.target.value)}>
                  <option value="">Remover da roça (sem roça)</option>
                  {rocas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </div>
            )}

            {bulkAction === 'pesagem' && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Peso (kg) *</label>
                  <Input type="number" placeholder="Ex: 350" value={bulkPeso} onChange={e => setBulkPeso(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Data</label>
                  <Input type="date" value={bulkPesoData} onChange={e => setBulkPesoData(e.target.value)} />
                </div>
              </>
            )}

            {bulkAction === 'sanitario' && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Produto *</label>
                  <Input placeholder="Ex: Vacina Aftosa, Ivermectina" value={bulkSanitario.produto} onChange={e => setBulkSanitario(p => ({ ...p, produto: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Data aplicação</label>
                    <Input type="date" value={bulkSanitario.data} onChange={e => setBulkSanitario(p => ({ ...p, data: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Próxima aplicação</label>
                    <Input type="date" value={bulkSanitario.proxima} onChange={e => setBulkSanitario(p => ({ ...p, proxima: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Via</label>
                  <div className="flex gap-2">
                    {['injetavel', 'oral', 'topica'].map(v => (
                      <button key={v} type="button" onClick={() => setBulkSanitario(p => ({ ...p, via: v }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize ${bulkSanitario.via === v ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'}`}>
                        {v === 'injetavel' ? 'Injetável' : v === 'oral' ? 'Oral' : 'Tópica'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setBulkOpen(false)}>Cancelar</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800" onClick={executeBulkAction} disabled={savingBulk}>
                {savingBulk ? 'Processando...' : `Confirmar (${selected.size})`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Adicionar animais ao lote */}
      <Dialog open={openAddLote} onOpenChange={setOpenAddLote}>
        <DialogContent className="max-h-[85vh] overflow-y-auto w-full max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar ao lote — {lotes.find(l => l.id === loteFilter)?.nome}</DialogTitle>
          </DialogHeader>
          <div className="pt-1">
            {availAnimals.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Todos os animais já estão em lotes.</p>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">{availAnimals.length} animal(is) sem lote disponível — selecione os que deseja adicionar</p>
                <div className="space-y-0 border border-gray-200 rounded-xl overflow-hidden mb-3">
                  {availAnimals.map((a, i) => (
                    <label key={a.id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                      <input type="checkbox" checked={addIds.has(a.id)}
                        onChange={e => setAddIds(prev => {
                          const next = new Set(prev)
                          e.target.checked ? next.add(a.id) : next.delete(a.id)
                          return next
                        })}
                        className="rounded border-gray-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{a.brinco}</p>
                        <p className="text-xs text-gray-500">{LABELS[a.categoria] ?? a.categoria} · {a.raca}</p>
                      </div>
                      {a.valor_compra && (
                        <p className="text-xs text-gray-500 shrink-0">{fmtMoney(a.valor_compra)}</p>
                      )}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setOpenAddLote(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-green-700 hover:bg-green-800" onClick={handleAddToLote} disabled={savingAdd || addIds.size === 0}>
                    {savingAdd ? 'Adicionando...' : `Adicionar${addIds.size > 0 ? ` ${addIds.size}` : ''}`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal registro de parto */}
      <Dialog open={openParto} onOpenChange={setOpenParto}>
        <DialogContent className="w-full max-w-sm max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:max-w-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Baby size={16} className="text-pink-600" />
              Registrar parto — {partoMae?.brinco}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-pink-50 border border-pink-200 rounded-lg px-3 py-2 text-xs text-pink-800">
              Mãe: <strong>{partoMae?.brinco}</strong>{partoMae?.nome ? ` (${partoMae.nome})` : ''} · Raça: {partoMae?.raca}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Brinco do bezerro</label>
                <Input placeholder="Gerado auto" value={formParto.brinco}
                  onChange={e => setFormParto(p => ({ ...p, brinco: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Nascimento</label>
                <Input placeholder="DD/MM/AAAA" value={formParto.data_nascimento}
                  onChange={e => setFormParto(p => ({ ...p, data_nascimento: e.target.value }))} maxLength={10} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Sexo *</label>
              <div className="grid grid-cols-2 gap-2">
                {['femea', 'macho'].map(s => (
                  <button key={s} type="button"
                    onClick={() => setFormParto(p => ({ ...p, sexo: s }))}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${formParto.sexo === s ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>
                    {s === 'femea' ? 'Fêmea' : 'Macho'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Raça</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={formParto.raca} onChange={e => setFormParto(p => ({ ...p, raca: e.target.value }))}>
                {racas.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <p className="text-xs text-gray-400">A mãe será automaticamente marcada como <strong>Lactando</strong> após salvar.</p>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setOpenParto(false)}>Cancelar</Button>
              <Button className="flex-1 bg-pink-600 hover:bg-pink-700 text-white" onClick={handleSaveParto} disabled={savingParto}>
                {savingParto ? 'Salvando...' : 'Registrar parto'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
