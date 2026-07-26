'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2 } from 'lucide-react'

type Mov = {
  id: string; tipo: 'entrada' | 'saida'; categoria: string
  valor: number; data: string; descricao: string
}
type Fazenda = { id: string; nome: string }

const CATS_ENTRADA = ['venda_animal', 'venda_leite', 'outro']
const CATS_SAIDA   = ['racao', 'sal_mineral', 'medicamento', 'funcionario', 'manutencao', 'combustivel', 'outro']
const LABELS: Record<string, string> = {
  venda_animal:'Venda de animal', venda_leite:'Venda de leite',
  racao:'Ração', sal_mineral:'Sal mineral', medicamento:'Medicamento',
  funcionario:'Funcionário', manutencao:'Manutenção', combustivel:'Combustível', outro:'Outro',
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function FinanceiroPage() {
  const supabase = createClient()
  const [movs, setMovs] = useState<Mov[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [filter, setFilter] = useState<'' | 'entrada' | 'saida'>('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    tipo: 'entrada' as 'entrada' | 'saida',
    categoria: 'venda_animal',
    valor: '',
    data: new Date().toISOString().split('T')[0].split('-').reverse().join('/'),
    descricao: '',
    fazenda_id: '',
  })

  async function load() {
    setLoading(true)
    const { data: faz } = await supabase.from('fazendas').select('id, nome').order('nome')
    let q = supabase.from('financeiro').select('*').order('data', { ascending: false }).limit(200)
    if (filter) q = q.eq('tipo', filter)
    const { data } = await q
    setFazendas(faz ?? [])
    setMovs(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const totEntradas = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0)
  const totSaidas   = movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0)
  const saldo       = totEntradas - totSaidas

  function setF(k: string, v: string) {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      if (k === 'tipo') next.categoria = v === 'entrada' ? 'venda_animal' : 'racao'
      return next
    })
  }

  async function handleSave() {
    const val = parseFloat(form.valor.replace(',', '.'))
    if (!val || val <= 0) return
    const [d, m, y] = form.data.split('/')
    const iso = `${y}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}`
    setSaving(true)
    await supabase.from('financeiro').insert({
      fazenda_id: form.fazenda_id || fazendas[0]?.id,
      tipo: form.tipo, categoria: form.categoria,
      valor: val, data: iso, descricao: form.descricao.trim() || LABELS[form.categoria],
    })
    setSaving(false)
    setOpen(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    await supabase.from('financeiro').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-500 text-sm mt-1">{movs.length} lançamentos</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-green-700 hover:bg-green-800 text-white gap-2">
          <Plus size={16} /> Lançamento
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-green-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><Wallet size={16} className="text-green-600" /><span className="text-xs text-gray-500 font-medium uppercase">Saldo</span></div>
          <p className={`text-xl font-bold ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(saldo)}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><TrendingUp size={16} className="text-blue-600" /><span className="text-xs text-gray-500 font-medium uppercase">Entradas</span></div>
          <p className="text-xl font-bold text-blue-700">{fmt(totEntradas)}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><TrendingDown size={16} className="text-red-600" /><span className="text-xs text-gray-500 font-medium uppercase">Saídas</span></div>
          <p className="text-xl font-bold text-red-600">{fmt(totSaidas)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        {(['', 'entrada', 'saida'] as const).map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === t ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>
            {t === '' ? 'Todos' : t === 'entrada' ? 'Entradas' : 'Saídas'}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading
          ? <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          : movs.length === 0
            ? <div className="p-8 text-center text-gray-400 text-sm">Nenhum lançamento.</div>
            : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movs.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(m.data)}</td>
                      <td className="px-4 py-3 text-gray-900">{m.descricao}</td>
                      <td className="px-4 py-3 text-gray-500">{LABELS[m.categoria] ?? m.categoria}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {m.tipo === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-semibold whitespace-nowrap ${m.tipo === 'entrada' ? 'text-green-700' : 'text-red-600'}`}>
                        {m.tipo === 'entrada' ? '+' : '-'}{fmt(m.valor)}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(m.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        }
      </div>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
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
              <div className="flex gap-2">
                {(['entrada', 'saida'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setF('tipo', t)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${form.tipo === t ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600'}`}>
                    {t === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Categoria *</label>
              <div className="flex flex-wrap gap-2">
                {(form.tipo === 'entrada' ? CATS_ENTRADA : CATS_SAIDA).map(c => (
                  <button key={c} type="button" onClick={() => setF('categoria', c)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${form.categoria === c ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600'}`}>
                    {LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Valor (R$) *</label>
                <Input placeholder="0,00" value={form.valor} onChange={e => setF('valor', e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Data *</label>
                <Input placeholder="DD/MM/AAAA" value={form.data} onChange={e => setF('data', e.target.value)} maxLength={10} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Descrição</label>
              <Input placeholder="Opcional" value={form.descricao} onChange={e => setF('descricao', e.target.value)} />
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
