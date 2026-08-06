'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Search, Trash2 } from 'lucide-react'

type Pesagem = {
  id: string; animal_id: string; data: string; peso_kg: number
  responsavel?: string; observacao?: string
  animal?: { brinco: string; nome?: string; raca: string; categoria: string } | null
}
type Animal  = { id: string; brinco: string; nome?: string; raca: string; categoria: string }
type Fazenda = { id: string; nome: string }

const LABELS: Record<string, string> = {
  matriz:'Matriz', bezerro:'Bezerro', novilha:'Novilha', touro:'Touro', boi:'Boi',
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function PesagemPage() {
  const supabase = createClient()
  const [pesagens, setPesagens] = useState<Pesagem[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    animal_id: '', peso_kg: '', data: new Date().toISOString().split('T')[0].split('-').reverse().join('/'),
    responsavel: '', observacao: '', fazenda_id: '',
  })
  const [animalSearch, setAnimalSearch] = useState('')
  const [animalResults, setAnimalResults] = useState<Animal[]>([])

  async function load() {
    setLoading(true)
    const { data: faz } = await supabase.from('fazendas').select('id, nome').order('nome')
    let q = supabase.from('pesagens').select('*, animal:animais(brinco, nome, raca, categoria)')
      .order('data', { ascending: false }).limit(200)
    if (search) q = q.ilike('animais.brinco', `%${search}%`)
    const { data } = await q
    setFazendas(faz ?? [])
    setPesagens((data ?? []) as Pesagem[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  useEffect(() => {
    const channel = supabase
      .channel('pesagem-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pesagens' }, () => {
        loadRef.current()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function searchAnimais(q: string) {
    if (!q) { setAnimalResults([]); return }
    const { data } = await supabase.from('animais').select('id, brinco, nome, raca, categoria')
      .eq('status', 'ativo').ilike('brinco', `%${q}%`).limit(10)
    setAnimalResults(data ?? [])
  }

  useEffect(() => {
    const t = setTimeout(() => searchAnimais(animalSearch), 300)
    return () => clearTimeout(t)
  }, [animalSearch])

  function setF(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  function toISO(str: string) {
    const [d, m, y] = str.split('/')
    return `${y}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}`
  }

  async function handleSave() {
    const peso = parseFloat(form.peso_kg.replace(',', '.'))
    if (!form.animal_id || !peso || peso <= 0) return
    setSaving(true)
    await supabase.from('pesagens').insert({
      fazenda_id: form.fazenda_id || fazendas[0]?.id,
      animal_id: form.animal_id,
      peso_kg: peso,
      data: form.data.includes('/') ? toISO(form.data) : form.data,
      responsavel: form.responsavel.trim() || null,
      observacao: form.observacao.trim() || null,
    })
    setSaving(false)
    setOpen(false)
    setForm(prev => ({ ...prev, animal_id: '', peso_kg: '', responsavel: '', observacao: '' }))
    setAnimalSearch('')
    setAnimalResults([])
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta pesagem?')) return
    await supabase.from('pesagens').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pesagem</h1>
          <p className="text-gray-500 text-sm mt-1">{pesagens.length} registros</p>
        </div>
        <Button onClick={() => { setForm(prev => ({ ...prev, fazenda_id: fazendas[0]?.id ?? '' })); setOpen(true) }}
          className="bg-green-700 hover:bg-green-800 text-white gap-2">
          <Plus size={16} /> Nova pesagem
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading
          ? <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          : pesagens.length === 0
            ? <div className="p-8 text-center text-gray-400 text-sm">Nenhuma pesagem registrada.</div>
            : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Data', 'Brinco', 'Nome', 'Categoria', 'Raça', 'Peso (kg)', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pesagens.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(p.data)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{p.animal?.brinco ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{p.animal?.nome ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{p.animal?.categoria ? (LABELS[p.animal.categoria] ?? p.animal.categoria) : '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{p.animal?.raca ?? '—'}</td>
                      <td className="px-4 py-3 font-bold text-green-700">{p.peso_kg} kg</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(p.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        }
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova pesagem</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {fazendas.length > 1 && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Fazenda</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.fazenda_id} onChange={e => setF('fazenda_id', e.target.value)}>
                  {fazendas.map(fz => <option key={fz.id} value={fz.id}>{fz.nome}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Animal (brinco) *</label>
              <Input placeholder="Buscar brinco..." value={animalSearch}
                onChange={e => { setAnimalSearch(e.target.value); if (!e.target.value) setF('animal_id', '') }} />
              {animalResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 divide-y divide-gray-100 shadow-sm max-h-40 overflow-y-auto">
                  {animalResults.map(a => (
                    <button key={a.id} type="button" className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm"
                      onClick={() => { setF('animal_id', a.id); setAnimalSearch(`${a.brinco}${a.nome ? ` — ${a.nome}` : ''}`); setAnimalResults([]) }}>
                      <span className="font-medium text-gray-900">{a.brinco}</span>
                      {a.nome && <span className="text-gray-500 ml-2">{a.nome}</span>}
                      <span className="text-gray-400 ml-2 text-xs">{LABELS[a.categoria]} · {a.raca}</span>
                    </button>
                  ))}
                </div>
              )}
              {form.animal_id && <p className="text-xs text-green-600 mt-1">✓ Animal selecionado</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Peso (kg) *</label>
                <Input placeholder="Ex: 350,5" value={form.peso_kg} onChange={e => setF('peso_kg', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Data *</label>
                <Input placeholder="DD/MM/AAAA" value={form.data} onChange={e => setF('data', e.target.value)} maxLength={10} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Responsável</label>
              <Input placeholder="Opcional" value={form.responsavel} onChange={e => setF('responsavel', e.target.value)} />
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
    </div>
  )
}
