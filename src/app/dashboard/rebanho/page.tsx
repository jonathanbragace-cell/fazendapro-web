'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Pencil, Trash2, X, Scissors, Skull, AlertTriangle } from 'lucide-react'

type Animal = {
  id: string; fazenda_id: string; brinco: string; nome?: string
  data_nascimento: string; sexo: string; raca: string; categoria: string
  origem: string; status: string; status_reprodutivo?: string; preco_compra?: number | null; observacao?: string
  lote?: { id: string; nome: string } | null
}
type Fazenda = { id: string; nome: string }
type Lote    = { id: string; nome: string }

const CATS          = ['matriz', 'bezerro', 'novilha', 'touro', 'boi']
const SEXOS         = ['femea', 'macho']
const ORIGENS       = ['nascimento', 'compra']
const DEFAULT_RACAS = ['Nelore', 'Girolando', 'Gir', 'Angus', 'Brahman', 'Tabapuã', 'Mestiço', 'Outra']
const LS_KEY        = 'fazendapro_racas'
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
  categoria:'bezerro', origem:'nascimento', preco_compra:'', status_reprodutivo:'', observacao:'', lote_id:'', fazenda_id:'',
}

export default function RebanhoPage() {
  const supabase = createClient()
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

  function addRaca() {
    const r = novaRaca.trim()
    if (!r || racas.includes(r)) { setNovaRaca(''); return }
    const updated = [...racas, r]
    setRacas(updated)
    localStorage.setItem(LS_KEY, JSON.stringify(updated))
    setForm(prev => ({ ...prev, raca: r }))
    setNovaRaca('')
  }

  function removeRaca(raca: string) {
    const updated = racas.filter(r => r !== raca)
    setRacas(updated)
    localStorage.setItem(LS_KEY, JSON.stringify(updated))
    setForm(prev => ({ ...prev, raca: prev.raca === raca ? (updated[0] ?? '') : prev.raca }))
  }

  useEffect(() => {
    try { const s = localStorage.getItem(LS_KEY); if (s) setRacas(JSON.parse(s)) } catch {}
  }, [])

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

    // Contagens para os filtros (sem filtro de categoria/repro/sexo)
    let cq = supabase.from('animais').select('categoria, status_reprodutivo, sexo, status').in('status', ['ativo', 'descarte', 'morto', 'atencao'])
    if (search) cq = cq.ilike('brinco', `%${search}%`)
    const { data: all } = await cq
    const newCounts: Record<string, number> = { '': 0 }
    const newRepro: Record<string, number> = { '': 0 }
    const newSexo: Record<string, number> = { '': 0 }
    let newDescarte = 0, newPerda = 0, newAtencao = 0
    for (const a of all ?? []) {
      if (a.status === 'descarte') { newDescarte++; continue }
      if (a.status === 'morto') { newPerda++; continue }
      if (a.status === 'atencao') { newAtencao++; continue }
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

    let q = supabase.from('animais').select('*, lote:lotes(id, nome)').order('brinco')
    if (catFilter === 'descarte') {
      q = q.eq('status', 'descarte')
    } else if (catFilter === 'perda') {
      q = q.eq('status', 'morto')
    } else if (catFilter === 'atencao') {
      q = q.eq('status', 'atencao')
    } else {
      q = q.eq('status', 'ativo')
      if (catFilter) q = q.eq('categoria', catFilter)
      if (reproFilter) q = q.eq('status_reprodutivo', reproFilter)
      if (sexoFilter && catFilter === 'bezerro') q = q.eq('sexo', sexoFilter)
    }
    if (search) q = q.ilike('brinco', `%${search}%`)
    const { data: anim } = await q
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

  useEffect(() => { load() }, [catFilter, reproFilter, sexoFilter])
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
      status_reprodutivo: a.status_reprodutivo ?? '', preco_compra: a.preco_compra ? String(a.preco_compra) : '',
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

    const payload: any = {
      brinco,
      nome: form.nome.trim() || null,
      data_nascimento: dataNasc,
      sexo: form.sexo, raca: form.raca, categoria: form.categoria,
      origem: form.origem, status_reprodutivo: form.categoria === 'matriz' ? (form.status_reprodutivo || null) : null,
      preco_compra: form.origem === 'compra' && form.preco_compra ? parseFloat(form.preco_compra.replace(',', '.')) : null,
      observacao: form.observacao.trim() || null,
      lote_id: form.lote_id || null, fazenda_id: fid,
      status: 'ativo',
    }
    let error
    // Try save, if schema missing (e.g. preco_compra) retry without that field
    if (editing) {
      ({ error } = await supabase.from('animais').update(payload).eq('id', editing.id))
      if (error && /Could not find the 'preco_compra' column|PGRST204/.test(error.message + (error.code ?? ''))) {
        const p = { ...payload }
        delete p.preco_compra
        ;({ error } = await supabase.from('animais').update(p).eq('id', editing.id))
      }
    } else {
      ({ error } = await supabase.from('animais').insert(payload))
      if (error && /Could not find the 'preco_compra' column|PGRST204/.test(error.message + (error.code ?? ''))) {
        const p = { ...payload }
        delete p.preco_compra
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

  async function handleBaixa(a: Animal, tipo: 'vendido' | 'morto') {
    if (!confirm(`Confirma marcar ${a.brinco} como ${tipo}?`)) return
    await supabase.from('animais').update({ status: tipo }).eq('id', a.id)
    setDetail(null)
    load()
  }

  async function handleDescarte(a: Animal) {
    if (a.status === 'descarte') {
      await supabase.from('animais').update({ status: 'ativo' }).eq('id', a.id)
    } else {
      if (!confirm(`Marcar animal ${a.brinco} para descarte?`)) return
      await supabase.from('animais').update({ status: 'descarte' }).eq('id', a.id)
    }
    setDetail(null)
    load()
  }

  async function handleAtencao(a: Animal) {
    if (a.status === 'atencao') {
      await supabase.from('animais').update({ status: 'ativo' }).eq('id', a.id)
    } else {
      await supabase.from('animais').update({ status: 'atencao' }).eq('id', a.id)
    }
    setDetail(null)
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
        <Input placeholder="Buscar brinco..." className="pl-9 w-full" value={search} onChange={e => setSearch(e.target.value)} />
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
                  {animais.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
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
                          {a.status !== 'descarte' && (
                            <button onClick={() => openEdit(a)} className="text-gray-400 hover:text-green-600 p-1"><Pencil size={14} /></button>
                          )}
                          <button onClick={() => handleDescarte(a)}
                            title={a.status === 'descarte' ? 'Remover descarte' : 'Marcar para descarte'}
                            className={`p-1 transition-colors ${a.status === 'descarte' ? 'text-orange-400' : 'text-gray-300 hover:text-orange-500'}`}>
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
                              title={a.status === 'atencao' ? 'Remover atenção' : 'Colocar sob atenção'}
                              className={`p-1 transition-colors ${a.status === 'atencao' ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'}`}>
                              <AlertTriangle size={13} />
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
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catColor[a.status] ?? ''}`}>{LABELS[a.status]}</span>
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
                {ORIGENS.map(o => <button key={o} type="button" onClick={() => setForm(prev => ({ ...prev, origem: o, preco_compra: o === 'compra' ? prev.preco_compra : '' }))}
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
                  value={form.preco_compra}
                  onChange={e => f('preco_compra', e.target.value)}
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
              <div>
                <p className="font-bold text-gray-900 text-lg">{detail.brinco}</p>
                {detail.nome && <p className="text-gray-500 text-sm">{detail.nome}</p>}
              </div>
            </div>
            <div className="space-y-2 text-sm mb-5">
              {[
                ['Categoria', LABELS[detail.categoria]],
                ['Raça', detail.raca],
                ['Sexo', LABELS[detail.sexo]],
                ['Origem', LABELS[detail.origem]],
                ['Nascimento', fmtDate(detail.data_nascimento)],
                ['Lote', (detail.lote as any)?.nome ?? '—'],
                detail.origem === 'compra' && detail.preco_compra ? ['Preço de compra', fmtMoney(detail.preco_compra)] : null,
                detail.status_reprodutivo ? ['Status reprod.', LABELS[detail.status_reprodutivo] ?? detail.status_reprodutivo] : null,
                detail.observacao ? ['Obs', detail.observacao] : null,
              ].filter(Boolean).map(([k, v]: any) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-900">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {detail.status !== 'descarte' && (
                <Button variant="outline" className="flex-1 gap-1" onClick={() => openEdit(detail)}><Pencil size={14}/>Editar</Button>
              )}
              <Button variant="outline"
                className={`flex-1 gap-1 ${detail.status === 'descarte' ? 'border-gray-200 text-gray-600 hover:bg-gray-50' : 'border-orange-200 text-orange-600 hover:bg-orange-50'}`}
                onClick={() => handleDescarte(detail)}>
                <Scissors size={14}/>{detail.status === 'descarte' ? 'Remover descarte' : 'Descarte'}
              </Button>
              {detail.status !== 'morto' && (
                <Button variant="outline"
                  className={`flex-1 gap-1 ${detail.status === 'atencao' ? 'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100' : 'border-yellow-200 text-yellow-600 hover:bg-yellow-50'}`}
                  onClick={() => handleAtencao(detail)}>
                  <AlertTriangle size={14}/>{detail.status === 'atencao' ? 'Remover atenção' : 'Atenção'}
                </Button>
              )}
              {detail.status !== 'descarte' && detail.status !== 'morto' && (
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
    </div>
  )
}
