'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Trash2 } from 'lucide-react'

type Reg = {
  id: string; animal_id: string; tipo_cobertura: string; data_cobertura: string
  diagnostico?: boolean | null; data_diagnostico?: string
  data_parto_prevista?: string; data_parto_real?: string
  resultado_parto?: string; observacao?: string
  animal?: { brinco: string; nome?: string } | null
}
type Animal  = { id: string; brinco: string; nome?: string }
type Fazenda = { id: string; nome: string }

const TIPOS_COB: Record<string, string> = {
  monta_natural:'Monta natural', inseminacao_artificial:'IA', fiv:'FIV',
}
const RESULTADOS: Record<string, string> = {
  vivo:'Vivo', natimorto:'Natimorto', gemelar:'Gemelar', aborto:'Aborto',
}

function fmtDate(iso?: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function toISO(str: string) {
  if (!str || !str.includes('/')) return str || undefined
  const [d, m, y] = str.split('/')
  return `${y}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}`
}

function statusPill(r: Reg) {
  if (r.data_parto_real) return { label: RESULTADOS[r.resultado_parto ?? ''] ?? 'Parida', cls: 'bg-blue-100 text-blue-700' }
  if (r.diagnostico === true) return { label: 'Gestante', cls: 'bg-amber-100 text-amber-700' }
  if (r.diagnostico === false) return { label: 'Vazia', cls: 'bg-red-100 text-red-700' }
  return { label: 'Aguardando diag.', cls: 'bg-gray-100 text-gray-600' }
}

export default function ReproducaoPage() {
  const supabase = createClient()
  const [regs, setRegs] = useState<Reg[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fazenda_id: '', animal_id: '', animal_search: '',
    tipo_cobertura: 'inseminacao_artificial',
    data_cobertura: new Date().toISOString().split('T')[0].split('-').reverse().join('/'),
    diagnostico: '' as '' | 'true' | 'false',
    data_diagnostico: '', data_parto_prevista: '',
    data_parto_real: '', resultado_parto: '', observacao: '',
  })
  const [animalResults, setAnimalResults] = useState<Animal[]>([])

  async function load() {
    setLoading(true)
    const { data: faz } = await supabase.from('fazendas').select('id, nome').order('nome')
    const { data } = await supabase.from('reproducao')
      .select('*, animal:animais(brinco, nome)')
      .order('data_cobertura', { ascending: false }).limit(200)
    setFazendas(faz ?? [])
    setRegs((data ?? []) as Reg[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function searchAnimais(q: string) {
    if (!q) { setAnimalResults([]); return }
    const { data } = await supabase.from('animais').select('id, brinco, nome')
      .eq('status', 'ativo').in('categoria', ['matriz'])
      .ilike('brinco', `%${q}%`).limit(8)
    setAnimalResults(data ?? [])
  }

  useEffect(() => {
    const t = setTimeout(() => searchAnimais(form.animal_search), 300)
    return () => clearTimeout(t)
  }, [form.animal_search])

  function setF(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSave() {
    if (!form.animal_id) return
    setSaving(true)
    await supabase.from('reproducao').insert({
      fazenda_id: form.fazenda_id || fazendas[0]?.id,
      animal_id: form.animal_id,
      tipo_cobertura: form.tipo_cobertura,
      data_cobertura: toISO(form.data_cobertura),
      diagnostico: form.diagnostico === '' ? null : form.diagnostico === 'true',
      data_diagnostico: form.data_diagnostico ? toISO(form.data_diagnostico) : null,
      data_parto_prevista: form.data_parto_prevista ? toISO(form.data_parto_prevista) : null,
      data_parto_real: form.data_parto_real ? toISO(form.data_parto_real) : null,
      resultado_parto: form.resultado_parto || null,
      observacao: form.observacao.trim() || null,
    })
    setSaving(false)
    setOpen(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro?')) return
    await supabase.from('reproducao').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reprodução</h1>
          <p className="text-gray-500 text-sm mt-1">
            {regs.filter(r => r.diagnostico === true && !r.data_parto_real).length} gestante(s) ·&nbsp;
            {regs.filter(r => !r.diagnostico && !r.data_parto_real).length} aguardando diagnóstico
          </p>
        </div>
        <Button onClick={() => { setForm(prev => ({ ...prev, fazenda_id: fazendas[0]?.id ?? '' })); setOpen(true) }}
          className="bg-green-700 hover:bg-green-800 text-white gap-2">
          <Plus size={16} /> Nova cobertura
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading
          ? <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          : regs.length === 0
            ? <div className="p-8 text-center text-gray-400 text-sm">Nenhum registro.</div>
            : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Data cobertura', 'Matriz', 'Tipo', 'Status', 'Parto previsto', 'Parto real', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {regs.map(r => {
                    const pill = statusPill(r)
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(r.data_cobertura)}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{r.animal?.brinco ?? '—'}{r.animal?.nome ? ` — ${r.animal.nome}` : ''}</td>
                        <td className="px-4 py-3 text-gray-500">{TIPOS_COB[r.tipo_cobertura]}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pill.cls}`}>{pill.label}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(r.data_parto_prevista)}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(r.data_parto_real)}</td>
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
          <DialogHeader><DialogTitle>Nova cobertura</DialogTitle></DialogHeader>
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
              <label className="text-sm font-medium text-gray-700 block mb-1">Matriz (brinco) *</label>
              <Input placeholder="Buscar brinco..." value={form.animal_search}
                onChange={e => { setF('animal_search', e.target.value); if (!e.target.value) setF('animal_id', '') }} />
              {animalResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 divide-y divide-gray-100 max-h-32 overflow-y-auto">
                  {animalResults.map(a => (
                    <button key={a.id} type="button" className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm"
                      onClick={() => { setF('animal_id', a.id); setF('animal_search', a.brinco); setAnimalResults([]) }}>
                      <span className="font-medium">{a.brinco}</span>
                      {a.nome && <span className="text-gray-500 ml-2">{a.nome}</span>}
                    </button>
                  ))}
                </div>
              )}
              {form.animal_id && <p className="text-xs text-green-600 mt-1">✓ Matriz selecionada</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Tipo de cobertura *</label>
              <div className="flex gap-2">
                {Object.entries(TIPOS_COB).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setF('tipo_cobertura', k)}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${form.tipo_cobertura === k ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Data da cobertura *</label>
              <Input placeholder="DD/MM/AAAA" value={form.data_cobertura} onChange={e => setF('data_cobertura', e.target.value)} maxLength={10} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Diagnóstico</label>
              <div className="flex gap-2">
                {([['', 'Aguardando'], ['true', 'Gestante'], ['false', 'Vazia']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setF('diagnostico', v)}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${form.diagnostico === v ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Parto previsto</label>
                <Input placeholder="DD/MM/AAAA" value={form.data_parto_prevista} onChange={e => setF('data_parto_prevista', e.target.value)} maxLength={10} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Parto real</label>
                <Input placeholder="DD/MM/AAAA" value={form.data_parto_real} onChange={e => setF('data_parto_real', e.target.value)} maxLength={10} />
              </div>
            </div>
            {form.data_parto_real && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Resultado do parto</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(RESULTADOS).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setF('resultado_parto', k)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium ${form.resultado_parto === k ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Observações</label>
              <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" rows={2}
                value={form.observacao} onChange={e => setF('observacao', e.target.value)} />
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
