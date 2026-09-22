'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Plus, TrendingUp, TrendingDown, Wallet, Trash2, X, Check, Clock,
  ChevronDown, ChevronRight, Paperclip, Eye, Pencil,
} from 'lucide-react'

type Mov = {
  id: string; tipo: 'entrada' | 'saida'; categoria: string
  valor: number; data: string; descricao: string
  status: 'pago' | 'recebido' | 'pendente'; data_vencimento: string | null
  lote_id?: string | null
}
type Pagamento = {
  id: string; financeiro_id: string
  valor: number; data: string
  comprovante_url: string | null; created_at: string
}
type Fazenda = { id: string; nome: string }
type Cat     = { id: string; tipo: string; nome: string }
type Lote    = { id: string; nome: string }
type Filter  = '' | 'entrada' | 'saida' | 'a_pagar' | 'a_receber'

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
  const [movs, setMovs]             = useState<Mov[]>([])
  const [editing, setEditing]       = useState<Mov | null>(null)
  const [kpiTotals, setKpiTotals]   = useState({ entradas: 0, saidas: 0, aPagar: 0, aReceber: 0 })
  const [pagamentosMap, setPagamentosMap] = useState<Record<string, Pagamento[]>>({})
  const [expandedMov, setExpandedMov] = useState<string | null>(null)
  const [fazendas, setFazendas]     = useState<Fazenda[]>([])
  const [lotes, setLotes]           = useState<Lote[]>([])
  const [cats, setCats]             = useState<Cat[]>([])
  const [filter, setFilter]         = useState<Filter>('')
  const [loading, setLoading]       = useState(true)
  const [setupSql, setSetupSql]     = useState('')
  const [open, setOpen]             = useState(false)
  const [saving, setSaving]         = useState(false)
  const [novaCat, setNovaCat]       = useState('')
  const [addingCat, setAddingCat]   = useState(false)

  // Payment dialog
  const [payDialog, setPayDialog]   = useState<{ mov: Mov } | null>(null)
  const [payValor, setPayValor]     = useState('')
  const [payData, setPayData]       = useState('')
  const [payFile, setPayFile]       = useState<File | null>(null)
  const [payUploading, setPayUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    tipo: 'entrada' as 'entrada' | 'saida',
    categoria: '',
    valor: '',
    data: new Date().toLocaleDateString('pt-BR'),
    descricao: '',
    fazenda_id: '',
    pendente: false,
    data_vencimento: '',
    lote_id: '',
    ratear: false,
    rateioLotes: [] as string[],
    rateioMethod: 'igual' as 'igual' | 'cabeca',
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
    const { data: lots } = await supabase.from('lotes').select('id, nome').order('nome')
    setLotes(lots ?? [])
    await carregarCats()

    // Carregar totais para KPIs sempre sem filtro
    const { data: allKpi } = await supabase.from('financeiro').select('tipo, valor, status')
    const kpiPagos = (allKpi ?? []).filter((m: any) => m.status !== 'pendente')
    setKpiTotals({
      entradas:  kpiPagos.filter((m: any) => m.tipo === 'entrada').reduce((s: number, m: any) => s + Number(m.valor), 0),
      saidas:    kpiPagos.filter((m: any) => m.tipo === 'saida').reduce((s: number, m: any) => s + Number(m.valor), 0),
      aPagar:    (allKpi ?? []).filter((m: any) => m.status === 'pendente' && m.tipo === 'saida').reduce((s: number, m: any) => s + Number(m.valor), 0),
      aReceber:  (allKpi ?? []).filter((m: any) => m.status === 'pendente' && m.tipo === 'entrada').reduce((s: number, m: any) => s + Number(m.valor), 0),
    })

    let q = supabase.from('financeiro').select('*').order('data', { ascending: false }).limit(200)
    if (filter === 'entrada')   q = q.eq('tipo', 'entrada').neq('status', 'pendente')
    if (filter === 'saida')     q = q.eq('tipo', 'saida').neq('status', 'pendente')
    if (filter === 'a_pagar')   q = q.eq('tipo', 'saida').eq('status', 'pendente')
    if (filter === 'a_receber') q = q.eq('tipo', 'entrada').eq('status', 'pendente')

    const { data } = await q
    setFazendas(faz ?? [])
    setMovs(data ?? [])

    // Load pagamentos for all shown movs
    const movIds = (data ?? []).map((m: any) => m.id)
    if (movIds.length > 0) {
      const { data: pags } = await supabase
        .from('financeiro_pagamentos')
        .select('*')
        .in('financeiro_id', movIds)
        .order('data', { ascending: true })
      const newMap: Record<string, Pagamento[]> = {}
      for (const p of pags ?? []) {
        if (!newMap[p.financeiro_id]) newMap[p.financeiro_id] = []
        newMap[p.financeiro_id].push(p as Pagamento)
      }
      setPagamentosMap(newMap)
    } else {
      setPagamentosMap({})
    }

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

  function getSaldo(mov: Mov) {
    const pags = pagamentosMap[mov.id] ?? []
    const pago = pags.reduce((s, p) => s + Number(p.valor), 0)
    return Math.max(0, mov.valor - pago)
  }

  function openPayDialog(mov: Mov) {
    const saldo = getSaldo(mov)
    setPayValor(saldo.toFixed(2).replace('.', ','))
    setPayData(hoje())
    setPayFile(null)
    setPayDialog({ mov })
  }

  async function handlePagamento() {
    if (!payDialog) return
    const mov = payDialog.mov
    const valorPago = parseFloat(payValor.replace(',', '.'))
    if (!valorPago || valorPago <= 0) { alert('Informe um valor válido.'); return }

    setPayUploading(true)

    // Upload comprovante if provided
    let comprovanteUrl: string | null = null
    if (payFile) {
      const ext = payFile.name.split('.').pop() ?? 'jpg'
      const path = `${mov.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('comprovantes')
        .upload(path, payFile, { contentType: payFile.type, upsert: false })
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('comprovantes').getPublicUrl(path)
        comprovanteUrl = urlData.publicUrl
      }
    }

    // Insert pagamento record
    const { error } = await supabase.from('financeiro_pagamentos').insert({
      financeiro_id: mov.id,
      valor: valorPago,
      data: payData || hoje(),
      comprovante_url: comprovanteUrl,
    })
    if (error) { alert(`Erro ao registrar pagamento: ${error.message}`); setPayUploading(false); return }

    // Check if fully paid
    const existingPags = pagamentosMap[mov.id] ?? []
    const totalJaPago = existingPags.reduce((s, p) => s + Number(p.valor), 0)
    const totalPago = totalJaPago + valorPago

    if (totalPago >= mov.valor) {
      const novoStatus = mov.tipo === 'entrada' ? 'recebido' : 'pago'
      await supabase.from('financeiro').update({
        status: novoStatus,
        data: payData || hoje(),
      }).eq('id', mov.id)

      if (mov.lote_id) {
        if (mov.categoria === 'Compra — lote comercial') {
          await supabase.from('lotes').update({ pago: true, data_pago_efetivo: payData || hoje() }).eq('id', mov.lote_id)
        } else if (mov.categoria === 'Venda — lote comercial') {
          await supabase.from('lotes').update({ recebido: true, data_recebido_efetivo: payData || hoje() }).eq('id', mov.lote_id)
        }
      }
    }

    setPayUploading(false)
    setPayDialog(null)
    load()
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

    if (editing) {
      const { error } = await supabase.from('financeiro').update({
        tipo: form.tipo, categoria: form.categoria, valor: val,
        data: iso, descricao: form.descricao.trim() || form.categoria,
        status, data_vencimento: form.pendente && form.data_vencimento ? form.data_vencimento : null,
        lote_id: form.lote_id || null,
      }).eq('id', editing.id)
      if (error) { alert(`Erro ao editar: ${error.message}`); setSaving(false); return }
      setEditing(null); setSaving(false); setOpen(false); load()
      return
    }
    const basePayload: any = {
      fazenda_id: form.fazenda_id || fazendas[0]?.id,
      tipo: form.tipo, categoria: form.categoria,
      data: iso, descricao: form.descricao.trim() || form.categoria,
    }

    const insertFin = async (p: any) => {
      const payload = { ...p, status, data_vencimento: form.pendente && form.data_vencimento ? form.data_vencimento : null }
      const { error } = await supabase.from('financeiro').insert(payload)
      return error
    }

    if (form.ratear && form.rateioLotes.length > 0) {
      let amounts: Record<string, number> = {}
      if (form.rateioMethod === 'cabeca') {
        const { data: aCounts } = await supabase.from('animais').select('lote_id').in('lote_id', form.rateioLotes).eq('status', 'ativo')
        const total = aCounts?.length || 0
        form.rateioLotes.forEach(lid => {
          const n = aCounts?.filter((a: any) => a.lote_id === lid).length ?? 0
          amounts[lid] = total > 0 ? val * (n / total) : val / form.rateioLotes.length
        })
      } else {
        const per = val / form.rateioLotes.length
        form.rateioLotes.forEach(lid => { amounts[lid] = per })
      }
      for (const [lid, amount] of Object.entries(amounts)) {
        const error = await insertFin({ ...basePayload, valor: Math.round(amount * 100) / 100, lote_id: lid })
        if (error) { alert(`Erro ao salvar rateio: ${error.message}`); setSaving(false); return }
      }
    } else {
      const loteId = form.lote_id || null
      const error = await insertFin({ ...basePayload, valor: val, lote_id: loteId })
      if (error) {
        alert(`Erro ao salvar:\n${error.message}\nCódigo: ${error.code}\n${error.details ?? ''}`)
        setSaving(false)
        return
      }
    }
    setSaving(false)
    setOpen(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    await supabase.from('financeiro').delete().eq('id', id)
    load()
  }

  function abrirNovo() {
    const p = cats.find(c => c.tipo === 'entrada')
    setEditing(null)
    setForm({ tipo: 'entrada', categoria: p?.nome ?? '', valor: '', data: new Date().toLocaleDateString('pt-BR'), descricao: '', fazenda_id: fazendas[0]?.id ?? '', pendente: false, data_vencimento: '', lote_id: '', ratear: false, rateioLotes: [], rateioMethod: 'igual' })
    setAddingCat(false); setNovaCat(''); setOpen(true)
  }

  function abrirEdicao(mov: Mov) {
    setEditing(mov)
    const [y, mo, d] = mov.data.split('-')
    setForm({
      tipo: mov.tipo,
      categoria: mov.categoria,
      valor: Number(mov.valor).toFixed(2).replace('.', ','),
      data: `${d}/${mo}/${y}`,
      descricao: mov.descricao,
      fazenda_id: fazendas[0]?.id ?? '',
      pendente: mov.status === 'pendente',
      data_vencimento: mov.data_vencimento ?? '',
      lote_id: mov.lote_id ?? '',
      ratear: false, rateioLotes: [], rateioMethod: 'igual',
    })
    setAddingCat(false); setNovaCat(''); setOpen(true)
  }

  // KPIs sempre do total geral (independente do filtro ativo)
  const totEntradas = kpiTotals.entradas
  const totSaidas   = kpiTotals.saidas
  const totAPagar   = kpiTotals.aPagar
  const totAReceber = kpiTotals.aReceber
  const saldo = totEntradas - totSaidas

  const FILTERS: { key: Filter; label: string }[] = [
    { key: '',          label: 'Todos' },
    { key: 'entrada',   label: 'Entradas' },
    { key: 'saida',     label: 'Saídas' },
    { key: 'a_pagar',   label: 'Contas a pagar' },
    { key: 'a_receber', label: 'Contas a receber' },
  ]

  const isVencido = (mov: Mov) => mov.data_vencimento && mov.data_vencimento < hoje()

  // Compute pay dialog values
  const payMov = payDialog?.mov ?? null
  const payExistingPags = payMov ? (pagamentosMap[payMov.id] ?? []) : []
  const payTotalJaPago  = payExistingPags.reduce((s, p) => s + Number(p.valor), 0)
  const paySaldo        = payMov ? Math.max(0, payMov.valor - payTotalJaPago) : 0

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
                    const pags = pagamentosMap[m.id] ?? []
                    const totalPago = pags.reduce((s, p) => s + Number(p.valor), 0)
                    const saldoMov = Math.max(0, m.valor - totalPago)
                    const temPagamentoParcial = pags.length > 0 && m.status === 'pendente'
                    const temHistorico = pags.length > 0
                    const isExpanded = expandedMov === m.id
                    const temComprovante = pags.some(p => p.comprovante_url)

                    return [
                      <tr key={m.id} className={`hover:bg-gray-50 ${m.status === 'pendente' ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs md:text-sm">
                          {fmtDate(m.data)}
                          {m.data_vencimento && m.status === 'pendente' && (
                            <div className={`text-[10px] mt-0.5 ${vencido ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                              {vencido ? '⚠' : ''} Venc. {fmtDate(m.data_vencimento)}
                            </div>
                          )}
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
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs md:text-sm">
                          {m.status === 'pendente' ? (
                            <div>
                              <span className={`font-semibold ${vencido ? 'text-red-600' : 'text-gray-700'}`}>
                                {m.tipo === 'entrada' ? '+' : '-'}{fmt(saldoMov)}
                              </span>
                              {temPagamentoParcial && (
                                <div className="text-[10px] text-gray-400 mt-0.5">
                                  pago: {fmt(totalPago)} / {fmt(m.valor)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className={`font-semibold ${m.tipo === 'entrada' ? 'text-green-700' : 'text-red-600'}`}>
                              {m.tipo === 'entrada' ? '+' : '-'}{fmt(m.valor)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5 justify-end">
                            {/* Expand history toggle */}
                            {temHistorico && (
                              <button
                                onClick={() => setExpandedMov(isExpanded ? null : m.id)}
                                className="text-gray-300 hover:text-gray-600 p-1 relative"
                                title={`${pags.length} pagamento${pags.length > 1 ? 's' : ''}${temComprovante ? ' · comprovante' : ''}`}
                              >
                                {temComprovante ? <Paperclip size={13} className="text-blue-400 hover:text-blue-600" /> : (isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
                              </button>
                            )}
                            {m.status === 'pendente' && (
                              <button onClick={() => openPayDialog(m)}
                                className="flex items-center gap-1 text-xs text-green-700 font-medium hover:underline whitespace-nowrap">
                                <Check size={13} />
                                <span className="hidden sm:inline">{m.tipo === 'entrada' ? 'Receber' : 'Pagar'}</span>
                              </button>
                            )}
                            <button onClick={() => abrirEdicao(m)} className="text-gray-300 hover:text-blue-500 p-1" title="Editar">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => handleDelete(m.id)} className="text-gray-300 hover:text-red-500 p-1">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>,
                      // Expanded history row
                      isExpanded && (
                        <tr key={`${m.id}-hist`} className={m.status === 'pendente' ? 'bg-amber-50/20' : 'bg-gray-50/60'}>
                          <td colSpan={6} className="px-4 pb-3 pt-0">
                            <div className="bg-white rounded-lg border border-gray-100 p-3 mt-1">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Histórico de pagamentos</p>
                              <div className="space-y-1.5">
                                {pags.map((p, i) => (
                                  <div key={p.id} className="flex items-center gap-3 text-xs">
                                    <span className="text-gray-400 w-16 shrink-0">{fmtDate(p.data)}</span>
                                    <span className="font-semibold text-gray-800 tabular-nums">{fmt(Number(p.valor))}</span>
                                    {p.comprovante_url ? (
                                      <a href={p.comprovante_url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 ml-auto shrink-0">
                                        <Eye size={11} />
                                        <span>Comprovante</span>
                                      </a>
                                    ) : (
                                      <span className="text-gray-300 ml-auto text-[10px]">sem comprovante</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {m.status === 'pendente' && (
                                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                                  <span className="text-gray-500">Saldo restante</span>
                                  <span className="font-bold text-orange-600">{fmt(saldoMov)}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ),
                    ]
                  })}
                </tbody>
              </table>
              </div>
            )
        }
      </div>

      {/* Modal novo / editar lançamento */}
      <Dialog open={open} onOpenChange={v => { if (!v) { setOpen(false); setEditing(null) } }}>
        <DialogContent className="w-full max-w-md max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-14 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:translate-x-0 max-sm:translate-y-0 max-sm:left-0 max-sm:max-w-none overflow-y-auto max-h-[90vh] max-sm:max-h-full">
          <DialogHeader><DialogTitle>{editing ? 'Editar lançamento' : 'Novo lançamento'}</DialogTitle></DialogHeader>
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

            {lotes.length > 0 && !form.ratear && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Lote</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.lote_id} onChange={e => setF('lote_id', e.target.value)}>
                  <option value="">Nenhum</option>
                  {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </div>
            )}

            {lotes.length > 1 && (
              <div>
                <button type="button" onClick={() => setF('ratear', !form.ratear)}
                  className={`flex items-center gap-2 text-xs font-semibold transition-colors ${form.ratear ? 'text-green-700' : 'text-gray-400 hover:text-gray-700'}`}>
                  <span className={`w-7 h-3.5 rounded-full transition-colors relative shrink-0 ${form.ratear ? 'bg-green-600' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-transform ${form.ratear ? 'left-3.5' : 'left-0.5'}`} />
                  </span>
                  Ratear entre lotes
                </button>
                {form.ratear && (
                  <div className="mt-2 bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex gap-2">
                      {(['igual', 'cabeca'] as const).map(m => (
                        <button key={m} type="button" onClick={() => setF('rateioMethod', m)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${form.rateioMethod === m ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'}`}>
                          {m === 'igual' ? 'Igual' : 'Por cabeça'}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {lotes.map(l => {
                        const checked = form.rateioLotes.includes(l.id)
                        return (
                          <label key={l.id} className="flex items-center gap-2 cursor-pointer hover:bg-white rounded px-1 py-0.5">
                            <input type="checkbox" checked={checked}
                              onChange={e => {
                                const next = e.target.checked
                                  ? [...form.rateioLotes, l.id]
                                  : form.rateioLotes.filter(id => id !== l.id)
                                setF('rateioLotes', next)
                              }}
                              className="rounded border-gray-300" />
                            <span className="text-xs text-gray-800">{l.nome}</span>
                            {checked && form.rateioLotes.length > 0 && (() => {
                              const v = parseFloat(form.valor.replace(',', '.'))
                              if (!v || isNaN(v)) return null
                              const per = v / form.rateioLotes.length
                              return <span className="text-xs text-gray-400 ml-auto">R$ {per.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            })()}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800 text-white" onClick={handleSave} disabled={saving || !form.categoria}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal pagamento parcial */}
      <Dialog open={!!payDialog} onOpenChange={v => { if (!v) setPayDialog(null) }}>
        <DialogContent className="w-full max-w-sm max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:translate-x-0 max-sm:translate-y-0 max-sm:left-0 max-sm:max-w-none overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {payMov?.tipo === 'entrada' ? 'Registrar recebimento' : 'Registrar pagamento'}
            </DialogTitle>
          </DialogHeader>

          {payMov && (
            <div className="space-y-4 pt-1">
              {/* Resumo do lançamento */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                <p className="font-medium text-gray-800 truncate">{payMov.descricao}</p>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Valor total</span>
                  <span className="tabular-nums font-medium text-gray-700">{fmt(payMov.valor)}</span>
                </div>
                {payTotalJaPago > 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Já {payMov.tipo === 'entrada' ? 'recebido' : 'pago'}</span>
                    <span className="tabular-nums font-medium text-green-600">{fmt(payTotalJaPago)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs pt-1 border-t border-gray-200">
                  <span className="font-semibold text-gray-700">Saldo restante</span>
                  <span className="tabular-nums font-bold text-orange-600">{fmt(paySaldo)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Valor pago (R$) *</label>
                  <Input
                    placeholder="0,00"
                    value={payValor}
                    onChange={e => setPayValor(e.target.value)}
                    inputMode="decimal"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Data *</label>
                  <Input
                    type="date"
                    value={payData}
                    onChange={e => setPayData(e.target.value)}
                  />
                </div>
              </div>

              {/* Comprovante upload */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Comprovante (opcional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={e => setPayFile(e.target.files?.[0] ?? null)}
                />
                {payFile ? (
                  <div className="flex items-center gap-2 border border-green-200 bg-green-50 rounded-lg px-3 py-2">
                    <Paperclip size={14} className="text-green-600 shrink-0" />
                    <span className="text-xs text-green-800 flex-1 truncate">{payFile.name}</span>
                    <button type="button" onClick={() => setPayFile(null)} className="text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-200 rounded-lg px-3 py-3 text-xs text-gray-400 hover:border-green-300 hover:text-green-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Paperclip size={14} />
                    Anexar foto ou PDF
                  </button>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setPayDialog(null)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-green-700 hover:bg-green-800 text-white"
                  onClick={handlePagamento}
                  disabled={payUploading}
                >
                  {payUploading ? 'Salvando...' : 'Confirmar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
