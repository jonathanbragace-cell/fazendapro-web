'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2, X, Check, Clock, AlertCircle } from 'lucide-react'

type Mov = {
  id: string; tipo: 'entrada' | 'saida'; categoria: string
  valor: number; data: string; descricao: string
  status: 'pago' | 'recebido' | 'pendente'; data_vencimento: string | null
}
type Fazenda = { id: string; nome: string }
type Cat = { id: string; tipo: string; nome: string }
type Filter = '' | 'entrada' | 'saida' | 'a_pagar' | 'a_receber'

const SQL_CATS = `CREATE TABLE IF NOT EXISTS financeiro_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL, nome text NOT NULL, created_at timestamptz DEFAULT now()
);
INSERT INTO financeiro_categorias (tipo, nome) VALUES
  ('entrada','Venda de animal'),('entrada','Venda de leite'),('entrada','Outro'),
  ('saida','Ração'),('saida','Sal mineral'),('saida','Medicamento'),
  ('saida','Funcionário'),('saida','Manutenção'),('saida','Combustível'),('saida','Outro');
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pago';
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS data_vencimento date;`

const supabase = createClient()
const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (iso: string) => { if (!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}` }
const hoje = () => new Date().toISOString().split('T')[0]

export default function FinanceiroPage() {
  const [movs, setMovs]         = useState<Mov[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [cats, setCats]         = useState<Cat[]>([])
  const [filter, setFilter]     = useState<Filter>('')
  const [loading, setLoading]   = useState(true)
  const [setupSql, setSetupSql] = useState('')
  const [open, setOpen]         = useState(false)
  const [saving, setSaving]     = useState(false)
  const [novaCat, setNovaCat]   = useState('')
  const [addingCat, setAddingCat] = useState(false)

  const [form, setForm] = useState({
    tipo: 'entrada' as 'entrada' | 'saida',
    categoria: '',
    valor: '',
    data: new Date().toLocaleDateString('pt-BR'),
    descricao: '',
    fazenda_id: '',
    pendente: false,
    data_vencimento: '',
  })

  async function carregarCats() {
    const { data, error } = await supabase.from('financeiro_categorias').select('*').order('created_at')
    if (error) { setSetupSql(SQL_CATS); return [] }
    setSetupSql('')
    setCats(data ?? [])
    return data ?? []
  }

  async function load() {
    setLoading(true)
    const { data: faz } = await supabase.from('fazendas').select('id, nome').order('nome')
    await carregarCats()

    let q = supabase.from('financeiro').select('*').order('data', { ascending: false }).limit(200)
    if (filter === 'entrada')    q = q.eq('tipo', 'entrada').neq('status', 'pendente')
    if (filter === 'saida')      q = q.eq('tipo', 'saida').neq('status', 'pendente')
    if (filter === 'a_pagar')    q = q.eq('tipo', 'saida').eq('status', 'pendente')
    if (filter === 'a_receber')  q = q.eq('tipo', 'entrada').eq('status', 'pendente')

    const { data } = await q
    setFazendas(faz ?? [])
    setMovs(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  useEffect(() => {
    const channel = supabase
      .channel('financeiro-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro' }, () => {
        loadRef.current()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const catsDoTipo = cats.filter(c => c.tipo === form.tipo)

  function setF(k: string, v: any) {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      if (k === 'tipo') {
        const p = cats.find(c => c.tipo === v)
        next.categoria = p?.nome ?? ''
      }
      return next
    })
  }

  async function adicionarCat() {
    if (!novaCat.trim()) return
    await supabase.from('financeiro_categorias').insert({ tipo: form.tipo, nome: novaCat.trim() })
    const nome = novaCat.trim()
    setNovaCat(''); setAddingCat(false)
    await carregarCats()
    setForm(p => ({ ...p, categoria: nome }))
  }

  async function deletarCat(cat: Cat) {
    await supabase.from('financeiro_categorias').delete().eq('id', cat.id)
    const novas = await carregarCats()
    if (form.categoria === cat.nome) {
      const outra = novas.find((c: Cat) => c.tipo === form.tipo)
      setForm(p => ({ ...p, categoria: outra?.nome ?? '' }))
    }
  }

  async function handleSave() {
    const val = parseFloat(form.valor.replace(',', '.'))
    if (!val || val <= 0) { alert('Informe um valor válido.'); return }
    const [d, m, y] = form.data.split('/')
    const iso = y && m && d ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : new Date().toISOString().split('T')[0]
    setSaving(true)
    const status = form.pendente ? 'pendente' : (form.tipo === 'entrada' ? 'recebido' : 'pago')
    const payload: any = {
      fazenda_id: form.fazenda_id || fazendas[0]?.id,
      tipo: form.tipo, categoria: form.categoria,
      valor: val, data: iso,
      descricao: form.descricao.trim() || form.categoria,
    }

    // tenta com status/data_vencimento; se coluna não existir, tenta sem
    let { error } = await supabase.from('financeiro').insert({ ...payload, status, data_vencimento: form.pendente && form.data_vencimento ? form.data_vencimento : null })
    if (error && /status|data_vencimento|PGRST204/.test(error.message + (error.code ?? ''))) {
      ;({ error } = await supabase.from('financeiro').insert(payload))
    }
    if (error) {
      alert(`Erro ao salvar:\n${error.message}\nCódigo: ${error.code}\n${error.details ?? ''}`)
      setSaving(false)
      return
    }
    setSaving(false)
    setOpen(false)
    load()
  }

  async function marcarPago(mov: Mov) {
    const novoStatus = mov.tipo === 'entrada' ? 'recebido' : 'pago'
    await supabase.from('financeiro').update({ status: novoStatus, data: hoje() }).eq('id', mov.id)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    await supabase.from('financeiro').delete().eq('id', id)
    load()
  }

  function abrirNovo() {
    const p = cats.find(c => c.tipo === 'entrada')
    setForm({ tipo: 'entrada', categoria: p?.nome ?? '', valor: '', data: new Date().toLocaleDateString('pt-BR'), descricao: '', fazenda_id: fazendas[0]?.id ?? '', pendente: false, data_vencimento: '' })
    setAddingCat(false); setNovaCat(''); setOpen(true)
  }

  const pagos     = movs.filter(m => m.status !== 'pendente')
  const pendentes = movs.filter(m => m.status === 'pendente')
  const totEntradas = pagos.filter(m => m.tipo === 'entrada').reduce((s,m) => s + m.valor, 0)
  const totSaidas   = pagos.filter(m => m.tipo === 'saida').reduce((s,m) => s + m.valor, 0)
  const totAPagar   = movs.filter(m => m.status === 'pendente' && m.tipo === 'saida').reduce((s,m) => s + m.valor, 0)
  const totAReceber = movs.filter(m => m.status === 'pendente' && m.tipo === 'entrada').reduce((s,m) => s + m.valor, 0)
  const saldo = totEntradas - totSaidas

  const FILTERS: { key: Filter; label: string }[] = [
    { key: '',          label: 'Todos' },
    { key: 'entrada',   label: 'Entradas' },
    { key: 'saida',     label: 'Saídas' },
    { key: 'a_pagar',   label: 'Contas a pagar' },
    { key: 'a_receber', label: 'Contas a receber' },
  ]

  const isVencido = (mov: Mov) => mov.data_vencimento && mov.data_vencimento < hoje()

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5">{movs.length} lançamentos</p>
        </div>
        <Button onClick={abrirNovo} className="bg-green-700 hover:bg-green-800 text-white gap-1.5 text-sm px-3 py-2">
          <Plus size={15} /> Lançamento
        </Button>
      </div>

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
            className="mt-2 text-xs text-amber-700 font-semibold hover:underline">Copiar SQL</button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 mb-4 md:mb-6">
        <div className="bg-white rounded-xl border border-green-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><Wallet size={14} className="text-green-600" /><span className="text-xs text-gray-500 font-medium uppercase">Saldo</span></div>
          <p className={`text-lg font-bold ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(saldo)}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-blue-600" /><span className="text-xs text-gray-500 font-medium uppercase">Entradas</span></div>
          <p className="text-lg font-bold text-blue-700">{fmt(totEntradas)}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><TrendingDown size={14} className="text-red-600" /><span className="text-xs text-gray-500 font-medium uppercase">Saídas</span></div>
          <p className="text-lg font-bold text-red-600">{fmt(totSaidas)}</p>
        </div>
        <div className="bg-white rounded-xl border border-orange-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><Clock size={14} className="text-orange-500" /><span className="text-xs text-gray-500 font-medium uppercase">A pagar</span></div>
          <p className="text-lg font-bold text-orange-600">{fmt(totAPagar)}</p>
        </div>
        <div className="bg-white rounded-xl border border-purple-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><Clock size={14} className="text-purple-500" /><span className="text-xs text-gray-500 font-medium uppercase">A receber</span></div>
          <p className="text-lg font-bold text-purple-600">{fmt(totAReceber)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap scrollbar-none">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${filter === f.key ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>
            {f.label}
            {f.key === 'a_pagar' && totAPagar > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                {movs.filter(m => m.status === 'pendente' && m.tipo === 'saida').length}
              </span>
            )}
            {f.key === 'a_receber' && totAReceber > 0 && (
              <span className="ml-1.5 bg-purple-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                {movs.filter(m => m.status === 'pendente' && m.tipo === 'entrada').length}
              </span>
            )}
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
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Descrição</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Categoria</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Status</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movs.map(m => {
                    const vencido = isVencido(m)
                    return (
                      <tr key={m.id} className={`hover:bg-gray-50 ${m.status === 'pendente' ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs md:text-sm">
                          {fmtDate(m.data)}
                          {m.data_vencimento && m.status === 'pendente' && (
                            <div className={`text-[10px] mt-0.5 ${vencido ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                              {vencido ? '⚠' : ''} Venc. {fmtDate(m.data_vencimento)}
                            </div>
                          )}
                          {/* Status visível só no mobile */}
                          <div className="sm:hidden mt-1">
                            {m.status === 'pendente'
                              ? <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${vencido ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{vencido ? '⚠ Vencido' : 'Pendente'}</span>
                              : <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${m.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.tipo === 'entrada' ? '↑' : '↓'}</span>
                            }
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-gray-900 text-xs md:text-sm">
                          <p>{m.descricao}</p>
                          <p className="text-gray-400 text-[10px] sm:hidden">{m.categoria}</p>
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 hidden sm:table-cell">{m.categoria}</td>
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          {m.status === 'pendente' ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${vencido ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {vencido ? '⚠ Vencido' : '⏳ Pendente'}
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {m.tipo === 'entrada' ? '↑ Recebido' : '↓ Pago'}
                            </span>
                          )}
                        </td>
                        <td className={`px-3 py-2.5 font-semibold whitespace-nowrap text-xs md:text-sm ${m.status === 'pendente' ? 'text-gray-500' : m.tipo === 'entrada' ? 'text-green-700' : 'text-red-600'}`}>
                          {m.tipo === 'entrada' ? '+' : '-'}{fmt(m.valor)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5 justify-end">
                            {m.status === 'pendente' && (
                              <button onClick={() => marcarPago(m)}
                                className="flex items-center gap-1 text-xs text-green-700 font-medium hover:underline whitespace-nowrap">
                                <Check size={13} />
                                <span className="hidden sm:inline">{m.tipo === 'entrada' ? 'Receber' : 'Pagar'}</span>
                              </button>
                            )}
                            <button onClick={() => handleDelete(m.id)} className="text-gray-300 hover:text-red-500 p-1">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            )
        }
      </div>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-md max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-14 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:translate-x-0 max-sm:translate-y-0 max-sm:left-0 max-sm:max-w-none overflow-y-auto max-h-[90vh] max-sm:max-h-full">
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
                    <button type="button" onClick={() => setF('categoria', c.nome)}>{c.nome}</button>
                    <button type="button" onClick={() => deletarCat(c)}
                      className={`rounded-full p-0.5 ml-0.5 transition-colors ${form.categoria === c.nome ? 'hover:bg-green-600 text-green-200 hover:text-white' : 'text-gray-300 hover:text-red-400 hover:bg-red-50'}`}>
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {addingCat ? (
                  <div className="flex items-center gap-1">
                    <input autoFocus
                      className="border border-green-400 rounded-full px-3 py-1.5 text-xs outline-none w-32"
                      placeholder="Nova categoria..."
                      value={novaCat} onChange={e => setNovaCat(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') adicionarCat(); if (e.key === 'Escape') { setAddingCat(false); setNovaCat('') } }} />
                    <button type="button" onClick={adicionarCat} className="p-1.5 bg-green-700 text-white rounded-full hover:bg-green-800"><Check size={10} /></button>
                    <button type="button" onClick={() => { setAddingCat(false); setNovaCat('') }} className="p-1.5 text-gray-400 rounded-full border border-gray-200"><X size={10} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddingCat(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-xs text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors">
                    <Plus size={10} /> Nova
                  </button>
                )}
              </div>
            </div>

            {/* Pendente toggle */}
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <button type="button" onClick={() => setF('pendente', !form.pendente)}
                className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${form.pendente ? 'bg-amber-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.pendente ? 'left-5' : 'left-0.5'}`} />
              </button>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {form.tipo === 'entrada' ? 'Conta a receber' : 'Conta a pagar'}
                </p>
                <p className="text-xs text-gray-500">Lançar como pendente (ainda não {form.tipo === 'entrada' ? 'recebido' : 'pago'})</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  {form.pendente ? 'Data de lançamento' : 'Data *'}
                </label>
                <Input placeholder="DD/MM/AAAA" value={form.data} onChange={e => setF('data', e.target.value)} maxLength={10} />
              </div>
              {form.pendente ? (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Vencimento</label>
                  <Input type="date" value={form.data_vencimento} onChange={e => setF('data_vencimento', e.target.value)} />
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Valor (R$) *</label>
                  <Input placeholder="0,00" value={form.valor} onChange={e => setF('valor', e.target.value)} inputMode="decimal" />
                </div>
              )}
            </div>

            {form.pendente && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Valor (R$) *</label>
                <Input placeholder="0,00" value={form.valor} onChange={e => setF('valor', e.target.value)} inputMode="decimal" />
              </div>
            )}

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
