'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react'

type Animal = {
  id: string; fazenda_id: string; brinco: string; nome?: string
  data_nascimento: string; sexo: string; raca: string; categoria: string
  origem: string; status: string; status_reprodutivo?: string; observacao?: string
  lote?: { id: string; nome: string } | null
}
type Fazenda = { id: string; nome: string }
type Lote    = { id: string; nome: string }

const CATS     = ['matriz', 'bezerro', 'novilha', 'touro', 'boi']
const SEXOS    = ['femea', 'macho']
const ORIGENS  = ['nascimento', 'compra']
const RACAS    = ['Nelore', 'Girolando', 'Gir', 'Angus', 'Brahman', 'Tabapuã', 'Mestiço', 'Outra']
const LABELS: Record<string, string> = {
  matriz:'Matriz', bezerro:'Bezerro', novilha:'Novilha', touro:'Touro', boi:'Boi',
  femea:'Fêmea', macho:'Macho', nascimento:'Nascimento', compra:'Compra',
  ativo:'Ativo', vendido:'Vendido', morto:'Morto',
  gestante:'Gestante', lactando:'Lactando', vazia:'Vazia', em_diagnostico:'Em diag.',
}

const catColor: Record<string, string> = {
  matriz:'bg-green-100 text-green-800', bezerro:'bg-blue-100 text-blue-800',
  novilha:'bg-yellow-100 text-yellow-800', touro:'bg-gray-100 text-gray-800', boi:'bg-gray-100 text-gray-700',
  ativo:'bg-green-100 text-green-800', vendido:'bg-gray-100 text-gray-600', morto:'bg-red-100 text-red-700',
}

const EMPTY = {
  brinco:'', nome:'', data_nascimento:'', sexo:'femea', raca:'Nelore',
  categoria:'bezerro', origem:'nascimento', observacao:'', lote_id:'', fazenda_id:'',
}

export default function RebanhoPage() {
  const supabase = createClient()
  const [animais, setAnimais] = useState<Animal[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Animal | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<Animal | null>(null)
  const [cargo, setCargo] = useState<string>('')

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
    let q = supabase.from('animais').select('*, lote:lotes(id, nome)').eq('status', 'ativo').order('brinco')
    if (catFilter) q = q.eq('categoria', catFilter)
    if (search) q = q.ilike('brinco', `%${search}%`)
    const { data: anim } = await q
    setFazendas(faz ?? [])
    setLotes(lots ?? [])
    setAnimais(anim ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [catFilter])
  useEffect(() => {
    const t = setTimeout(() => load(), 350)
    return () => clearTimeout(t)
  }, [search])

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
      origem: form.origem, observacao: form.observacao.trim() || null,
      lote_id: form.lote_id || null, fazenda_id: fid,
      status: 'ativo',
    }
    let error
    if (editing) {
      ({ error } = await supabase.from('animais').update(payload).eq('id', editing.id))
    } else {
      ({ error } = await supabase.from('animais').insert(payload))
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

  const f = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rebanho</h1>
          <p className="text-gray-500 text-sm mt-1">{animais.length} animal(is) ativo(s)</p>
        </div>
        <Button onClick={openNew} className="bg-green-700 hover:bg-green-800 text-white gap-2">
          <Plus size={16} /> Novo animal
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Buscar brinco..." className="pl-9 w-52" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['', ...CATS].map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${catFilter === c ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>
            {c ? LABELS[c] : 'Todos'}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading
          ? <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          : animais.length === 0
            ? <div className="p-8 text-center text-gray-400 text-sm">Nenhum animal encontrado.</div>
            : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Brinco', 'Nome', 'Categoria', 'Raça', 'Lote', 'Status', 'Ações'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {animais.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        <button onClick={() => setDetail(a)} className="hover:text-green-700 hover:underline">{a.brinco}</button>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{a.nome ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catColor[a.categoria] ?? 'bg-gray-100 text-gray-600'}`}>{LABELS[a.categoria]}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{a.raca}</td>
                      <td className="px-4 py-3 text-gray-500">{(a.lote as any)?.nome ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catColor[a.status] ?? ''}`}>{LABELS[a.status]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(a)} className="text-gray-400 hover:text-green-600"><Pencil size={15} /></button>
                          {cargo === 'admin' && (
                            <button onClick={() => handleDelete(a)} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        }
      </div>

      {/* Modal cadastro/edição */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                {CATS.map(c => <button key={c} type="button" onClick={() => f('categoria', c)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${form.categoria === c ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                  {LABELS[c]}
                </button>)}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Origem *</label>
              <div className="flex gap-2">
                {ORIGENS.map(o => <button key={o} type="button" onClick={() => f('origem', o)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${form.origem === o ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                  {LABELS[o]}
                </button>)}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Raça *</label>
              <div className="flex flex-wrap gap-2">
                {RACAS.map(r => <button key={r} type="button" onClick={() => f('raca', r)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${form.raca === r ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                  {r}
                </button>)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
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
              <Button variant="outline" className="flex-1 gap-1" onClick={() => openEdit(detail)}><Pencil size={14}/>Editar</Button>
              <Button variant="outline" className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => handleBaixa(detail, 'vendido')}>Vendido</Button>
              <Button variant="outline" className="flex-1 border-red-200 text-red-700 hover:bg-red-50" onClick={() => handleBaixa(detail, 'morto')}>Morto</Button>
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
