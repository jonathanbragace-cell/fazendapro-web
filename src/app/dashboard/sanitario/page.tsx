'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, AlertTriangle, Trash2 } from 'lucide-react'

type Registro = {
  id: string; tipo: string; produto: string; dose?: string; via?: string
  data_aplicacao: string; proxima_aplicacao?: string; responsavel?: string; observacao?: string
  animal?: { brinco: string; nome?: string } | null
  lote?: { nome: string } | null
}
type Animal  = { id: string; brinco: string; nome?: string }
type Fazenda = { id: string; nome: string }

const TIPOS: Record<string, string> = {
  vacina:'Vacina', vermifugo:'Vermífugo', carrapaticida:'Carrapaticida', tratamento:'Tratamento', outro:'Outro',
}
const tipoColor: Record<string, string> = {
  vacina:'bg-blue-100 text-blue-700', vermifugo:'bg-purple-100 text-purple-700',
  carrapaticida:'bg-amber-100 text-amber-700', tratamento:'bg-red-100 text-red-700', outro:'bg-gray-100 text-gray-600',
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function toISO(str: string) {
  if (!str || !str.includes('/')) return str
  const [d, m, y] = str.split('/')
  return `${y}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}`
}

export default function SanitarioPage() {
  const supabase = createClient()
  const [registros, setRegistros] = useState<Registro[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [loading, setLoading] = useState(true)
  const [tipoFilter, setTipoFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fazenda_id: '', tipo: 'vacina', produto: '', dose: '', via: '',
    data_aplicacao: new Date().toISOString().split('T')[0].split('-').reverse().join('/'),
    proxima_aplicacao: '', responsavel: '', observacao: '',
    animal_search: '', animal_id: '',
  })
  const [animalResults, setAnimalResults] = useState<Animal[]>([])

  async function load() {
    setLoading(true)
    const { data: faz } = await supabase.from('fazendas').select('id, nome').order('nome')
    let q = supabase.from('sanitario')
      .select('*, animal:animais(brinco, nome), lote:lotes(nome)')
      .order('data_aplicacao', { ascending: false }).limit(200)
    if (tipoFilter) q = q.eq('tipo', tipoFilter)
    const { data } = await q
    setFazendas(faz ?? [])
    setRegistros((data ?? []) as Registro[])
    setLoading(false)
  }

  useEffect(() => { load() }, [tipoFilter])

  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  useEffect(() => {
    const channel = supabase
      .channel('sanitario-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sanitario' }, () => {
        loadRef.current()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const hoje = new Date().toISOString().split('T')[0]
  const vencidos  = registros.filter(r => r.proxima_aplicacao && r.proxima_aplicacao <= hoje)
  const proximos  = registros.filter(r => r.proxima_aplicacao && r.proxima_aplicacao > hoje)

  async function searchAnimais(q: string) {
    if (!q) { setAnimalResults([]); return }
    const { data } = await supabase.from('animais').select('id, brinco, nome')
      .eq('status', 'ativo').ilike('brinco', `%${q}%`).limit(8)
    setAnimalResults(data ?? [])
  }

  useEffect(() => {
    const t = setTimeout(() => searchAnimais(form.animal_search), 300)
    return () => clearTimeout(t)
  }, [form.animal_search])

  function setF(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSave() {
    if (!form.produto.trim()) return
    setSaving(true)
    await supabase.from('sanitario').insert({
      fazenda_id: form.fazenda_id || fazendas[0]?.id,
      tipo: form.tipo, produto: form.produto.trim(),
      dose: form.dose.trim() || null, via: form.via.trim() || null,
      data_aplicacao: toISO(form.data_aplicacao),
      proxima_aplicacao: form.proxima_aplicacao ? toISO(form.proxima_aplicacao) : null,
      responsavel: form.responsavel.trim() || null,
      observacao: form.observacao.trim() || null,
      animal_id: form.animal_id || null,
    })
    setSaving(false)
    setOpen(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro?')) return
    await supabase.from('sanitario').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sanitário</h1>
          <p className="text-gray-500 text-sm mt-1">{registros.length} registros · {vencidos.length} vencidos</p>
        </div>
        <Button onClick={() => { setForm(prev => ({ ...prev, fazenda_id: fazendas[0]?.id ?? '' })); setOpen(true) }}
          className="bg-green-700 hover:bg-green-800 text-white gap-2">
          <Plus size={16} /> Nova aplicação
        </Button>
      </div>

      {vencidos.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="text-red-600 mt-0.5 shrink-0" size={18} />
          <div>
            <p className="font-semibold text-red-800 text-sm">{vencidos.length} aplicação(ões) vencida(s)</p>
            <p className="text-red-700 text-xs mt-0.5">{vencidos.slice(0,3).map(r => r.produto).join(', ')}{vencidos.length > 3 ? '...' : ''}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['', ...Object.keys(TIPOS)].map(t => (
          <button key={t} onClick={() => setTipoFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${tipoFilter === t ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'}`}>
            {t ? TIPOS[t] : 'Todos'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading
          ? <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          : registros.length === 0
            ? <div className="p-8 text-center text-gray-400 text-sm">Nenhum registro.</div>
            : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Data', 'Animal/Lote', 'Tipo', 'Produto', 'Próxima aplicação', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {registros.map(r => {
                    const vencido  = r.proxima_aplicacao && r.proxima_aplicacao <= hoje
                    const emDia    = !r.proxima_aplicacao
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(r.data_aplicacao)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {r.animal?.brinco ?? r.lote?.nome ?? 'Geral'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipoColor[r.tipo] ?? 'bg-gray-100 text-gray-600'}`}>{TIPOS[r.tipo]}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{r.produto}{r.dose ? ` · ${r.dose}` : ''}</td>
                        <td className="px-4 py-3 text-gray-500">{r.proxima_aplicacao ? fmtDate(r.proxima_aplicacao) : '—'}</td>
                        <td className="px-4 py-3">
                          {emDia
                            ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Único</span>
                            : vencido
                              ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Vencido</span>
                              : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Em dia</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
        }
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova aplicação sanitária</DialogTitle></DialogHeader>
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
              <label className="text-sm font-medium text-gray-700 block mb-1">Tipo *</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TIPOS).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setF('tipo', k)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${form.tipo === k ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Animal (opcional)</label>
              <Input placeholder="Buscar brinco..." value={form.animal_search}
                onChange={e => { setF('animal_search', e.target.value); if (!e.target.value) setF('animal_id', '') }} />
              {animalResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 divide-y divide-gray-100 shadow-sm max-h-32 overflow-y-auto">
                  {animalResults.map(a => (
                    <button key={a.id} type="button" className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm"
                      onClick={() => { setF('animal_id', a.id); setF('animal_search', a.brinco); setAnimalResults([]) }}>
                      <span className="font-medium">{a.brinco}</span>
                      {a.nome && <span className="text-gray-500 ml-2">{a.nome}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Produto *</label>
              <Input placeholder="Ex: Vacina FMD, Ivermectina..." value={form.produto} onChange={e => setF('produto', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Dose</label>
                <Input placeholder="Ex: 5mL" value={form.dose} onChange={e => setF('dose', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Via</label>
                <Input placeholder="Ex: SC, IM" value={form.via} onChange={e => setF('via', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Data *</label>
                <Input placeholder="DD/MM/AAAA" value={form.data_aplicacao} onChange={e => setF('data_aplicacao', e.target.value)} maxLength={10} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Próxima aplicação</label>
                <Input placeholder="DD/MM/AAAA" value={form.proxima_aplicacao} onChange={e => setF('proxima_aplicacao', e.target.value)} maxLength={10} />
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
