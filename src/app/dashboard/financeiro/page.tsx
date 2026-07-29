'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2, X, Check } from 'lucide-react'

type Mov = { id: string; tipo: 'entrada' | 'saida'; categoria: string; valor: number; data: string; descricao: string }
type Fazenda = { id: string; nome: string }
type Cat = { id: string; tipo: string; nome: string }

const SQL_SETUP = `CREATE TABLE IF NOT EXISTS financeiro_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  nome text NOT NULL,
  created_at timestamptz DEFAULT now()
);
INSERT INTO financeiro_categorias (tipo, nome) VALUES
  ('entrada', 'Venda de animal'),('entrada', 'Venda de leite'),('entrada', 'Outro'),
  ('saida', 'Ração'),('saida', 'Sal mineral'),('saida', 'Medicamento'),
  ('saida', 'Funcionário'),('saida', 'Manutenção'),('saida', 'Combustível'),('saida', 'Outro');`

const supabase = createClient()

function fmt(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }
function fmtDate(iso: string) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }

export default function FinanceiroPage() {
  const [movs, setMovs]       = useState<Mov[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [cats, setCats]       = useState<Cat[]>([])
  const [filter, setFilter]   = useState<'' | 'entrada' | 'saida'>('')
  const [loading, setLoading] = useState(true)
  const [setupSql, setSetupSql] = useState('')
  const [open, setOpen]       = useState(false)
  const [saving, setSaving]   = useState(false)
  const [novaCat, setNovaCat] = useState('')
  const [addingCat, setAddingCat] = useState(false)

  const [form, setForm] = useState({
    tipo: 'entrada' as 'entrada' | 'saida',
    categoria: '',
    valor: '',
    data: new Date().toLocaleDateString('pt-BR'),
    descricao: '',
    fazenda_id: '',
  })

  async function carregarCats() {
    const { data, error } = await supabase.from('financeiro_categorias').select('*').order('created_at')
    if (error) { setSetupSql(SQL_SETUP); return }
    setSetupSql('')
    setCats(data ?? [])
    return data ?? []
  }

  async function load() {
    setLoading(true)
    const { data: faz } = await supabase.from('fazendas').select('id, nome').order('nome')
    const catData = await carregarCats()
    let q = supabase.from('financeiro').select('*').order('data', { ascending: false }).limit(200)
    if (filter) q = q.eq('tipo', filter)
    const { data } = await q
    setFazendas(faz ?? [])
    setMovs(data ?? [])
    // Set default category
    if (catData?.length) {
      const primeira = catData.find(c => c.tipo === 'entrada')
      if (primeira) setForm(p => ({ ...p, categoria: primeira.nome }))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const catsDoTipo = cats.filter(c => c.tipo === form.tipo)

  function setF(k: string, v: string) {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      if (k === 'tipo') {
        const primeiraDeTipo = cats.find(c => c.tipo === v)
        next.categoria = primeiraDeTipo?.nome ?? ''
      }
      return next
    })
  }

  async function adicionarCat() {
    if (!novaCat.trim()) return
    await supabase.from('financeiro_categorias').insert({ tipo: form.tipo, nome: novaCat.trim() })
    setNovaCat('')
    setAddingCat(false)
    const novasCats = await carregarCats()
    setForm(p => ({ ...p, categoria: novaCat.trim() }))
  }

  async function deletarCat(cat: Cat) {
    await supabase.from('financeiro_categorias').delete().eq('id', cat.id)
    const novasCats = await carregarCats()
    if (form.categoria === cat.nome) {
      const outra = (novasCats ?? []).find(c => c.tipo === form.tipo)
      setForm(p => ({ ...p, categoria: outra?.nome ?? '' }))
    }
  }

  async function handleSave() {
    const val = parseFloat(form.valor.replace(',', '.'))
    if (!val || val <= 0) return
    const [d, m, y] = form.data.split('/')
    const iso = `${y}-${m?.padStart(2, '0')}-${d?.padStart(2, '0')}`
    setSaving(true)
    await supabase.from('financeiro').insert({
      fazenda_id: form.fazenda_id || fazendas[0]?.id,
      tipo: form.tipo,
      categoria: form.categoria,
      valor: val,
      data: iso,
      descricao: form.descricao.trim() || form.categoria,
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

  const totEntradas = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0)
  const totSaidas   = movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0)
  const saldo       = totEntradas - totSaidas

  function abrirNovo() {
    const primeiraCat = cats.find(c => c.tipo === 'entrada')
    setForm({
      tipo: 'entrada',
      categoria: primeiraCat?.nome ?? '',
      valor: '',
      data: new Date().toLocaleDateString('pt-BR'),
      descricao: '',
      fazenda_id: fazendas[0]?.id ?? '',
    })
    setAddingCat(false)
    setNovaCat('')
    setOpen(true)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-500 text-sm mt-1">{movs.length} lançamentos</p>
        </div>
        <Button onClick={abrirNovo} className="bg-green-700 hover:bg-green-800 text-white gap-2">
          <Plus size={16} /> Lançamento
        </Button>
      </div>

      {/* SQL setup banner */}
      {setupSql && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            Execute este SQL no{' '}
            <a href="https://supabase.com/dashboard/project/lcqmbuocthnqlwmqvcwj/sql/new" target="_blank" className="underline">
              Supabase → SQL Editor
            </a>:
          </p>
          <pre className="bg-white border border-amber-200 rounded p-3 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">{setupSql}</pre>
          <button onClick={() => { navigator.clipboard.writeText(setupSql); alert('SQL copiado!') }}
            className="mt-2 text-xs text-amber-700 font-semibold hover:underline">
            Copiar SQL
          </button>
        </div>
      )}

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
                      <td className="px-4 py-3 text-gray-500">{m.categoria}</td>
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
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={form.fazenda_id} onChange={e => setF('fazenda_id', e.target.value)}>
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
                {catsDoTipo.map(c => (
                  <div key={c.id} className={`group flex items-center gap-1 pl-3 pr-1 py-1.5 rounded-full border text-xs font-medium transition-colors ${form.categoria === c.nome ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                    <button type="button" onClick={() => setF('categoria', c.nome)} className="leading-none">
                      {c.nome}
                    </button>
                    <button type="button" onClick={() => deletarCat(c)}
                      className={`rounded-full p-0.5 transition-colors ml-0.5 ${form.categoria === c.nome ? 'hover:bg-green-600 text-green-200 hover:text-white' : 'text-gray-300 hover:text-red-400 hover:bg-red-50'}`}>
                      <X size={10} />
                    </button>
                  </div>
                ))}

                {/* Adicionar categoria */}
                {addingCat ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      className="border border-green-400 rounded-full px-3 py-1.5 text-xs outline-none w-32"
                      placeholder="Nova categoria..."
                      value={novaCat}
                      onChange={e => setNovaCat(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') adicionarCat(); if (e.key === 'Escape') { setAddingCat(false); setNovaCat('') } }}
                    />
                    <button type="button" onClick={adicionarCat} className="p-1.5 bg-green-700 text-white rounded-full hover:bg-green-800">
                      <Check size={10} />
                    </button>
                    <button type="button" onClick={() => { setAddingCat(false); setNovaCat('') }} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full border border-gray-200">
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddingCat(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-xs text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors">
                    <Plus size={10} /> Nova
                  </button>
                )}
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
              <Button className="flex-1 bg-green-700 hover:bg-green-800 text-white" onClick={handleSave} disabled={saving || !form.categoria}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
