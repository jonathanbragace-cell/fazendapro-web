'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, ChevronLeft, Trash2, Pencil } from 'lucide-react'

const supabase = createClient()

type Fazenda = { id: string; nome: string }

type Operacao = {
  id: string
  fazenda_id: string | null
  nome: string
  status: 'em_aberto' | 'encerrada'
  data_compra: string
  vendedor: string
  qtd_compra: number
  categoria: string
  peso_total_compra: number | null
  forma_compra: string
  valor_unit_compra: number | null
  valor_total_compra: number
  created_at: string
}

type Venda = {
  id: string
  operacao_id: string
  data_venda: string
  comprador: string
  qtd_vendida: number
  peso_total_venda: number | null
  forma_venda: string
  valor_unit_venda: number | null
  valor_total_venda: number
}

type Custo = {
  id: string
  operacao_id: string
  descricao: string
  valor: number
  data: string | null
}

const CATEGORIAS = ['boi', 'vaca', 'garrote', 'novilha', 'touro', 'bezerra', 'bezerro', 'misto']
const FORMAS = ['arroba', 'cabeca', 'kg']
const FORMA_LABEL: Record<string, string> = { arroba: '@', cabeca: 'cab', kg: 'kg' }
const FORMA_NOME: Record<string, string> = { arroba: 'Por arroba', cabeca: 'Por cabeça', kg: 'Por kg' }
const CAT_LABEL: Record<string, string> = {
  boi: 'Boi', vaca: 'Vaca', garrote: 'Garrote', novilha: 'Novilha',
  touro: 'Touro', bezerra: 'Bezerra', bezerro: 'Bezerro', misto: 'Misto',
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (iso: string) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }
const hoje = () => new Date().toISOString().split('T')[0]
const num = (v: string) => parseFloat(v.replace(',', '.')) || 0

const SQL_SETUP = `-- Execute no Supabase → SQL Editor antes de usar esta página

CREATE TABLE IF NOT EXISTS public.operacoes_comerciais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fazenda_id uuid REFERENCES public.fazendas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'em_aberto',
  data_compra date NOT NULL,
  vendedor text NOT NULL DEFAULT '',
  qtd_compra integer NOT NULL DEFAULT 0,
  categoria text NOT NULL DEFAULT 'boi',
  peso_total_compra numeric,
  forma_compra text NOT NULL DEFAULT 'arroba',
  valor_unit_compra numeric,
  valor_total_compra numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operacoes_vendas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  operacao_id uuid NOT NULL REFERENCES public.operacoes_comerciais(id) ON DELETE CASCADE,
  data_venda date NOT NULL,
  comprador text NOT NULL DEFAULT '',
  qtd_vendida integer NOT NULL DEFAULT 0,
  peso_total_venda numeric,
  forma_venda text NOT NULL DEFAULT 'arroba',
  valor_unit_venda numeric,
  valor_total_venda numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operacoes_custos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  operacao_id uuid NOT NULL REFERENCES public.operacoes_comerciais(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.operacoes_comerciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_custos ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_all ON public.operacoes_comerciais FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.operacoes_vendas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.operacoes_custos FOR ALL TO authenticated USING (true) WITH CHECK (true);`

function calcResultado(op: Operacao, vendas: Venda[], custos: Custo[]) {
  const qtdVendida = vendas.reduce((s, v) => s + v.qtd_vendida, 0)
  const saldo = op.qtd_compra - qtdVendida
  const totalVenda = vendas.reduce((s, v) => s + v.valor_total_venda, 0)
  const totalCustos = custos.reduce((s, c) => s + c.valor, 0)
  const proporcao = op.qtd_compra > 0 ? qtdVendida / op.qtd_compra : 0
  const custoCompraProp = proporcao * op.valor_total_compra
  const pesoCompraProps = proporcao * (op.peso_total_compra ?? 0)
  const pesoVendaTotal = vendas.reduce((s, v) => s + (v.peso_total_venda ?? 0), 0)
  const lucroBruto = totalVenda - custoCompraProp
  const lucroLiquido = lucroBruto - totalCustos
  const margem = totalVenda > 0 ? (lucroLiquido / totalVenda) * 100 : 0
  const lucroPerCabeca = qtdVendida > 0 ? lucroLiquido / qtdVendida : 0
  const quebraPeso = pesoCompraProps > 0 && pesoVendaTotal > 0 ? pesoCompraProps - pesoVendaTotal : null
  const quebraPesoPerc = quebraPeso != null && pesoCompraProps > 0 ? (quebraPeso / pesoCompraProps) * 100 : null
  const datas = vendas.map(v => Math.round(
    (new Date(v.data_venda).getTime() - new Date(op.data_compra).getTime()) / 86400000
  ))
  const diasMedio = datas.length > 0 ? Math.round(datas.reduce((s, d) => s + d, 0) / datas.length) : null
  return { qtdVendida, saldo, totalVenda, totalCustos, custoCompraProp, pesoCompraProps, pesoVendaTotal, quebraPeso, quebraPesoPerc, lucroBruto, lucroLiquido, margem, lucroPerCabeca, diasMedio }
}

const EMPTY_OP = {
  nome: '', fazenda_id: '', data_compra: hoje(), vendedor: '',
  qtd_compra: '', categoria: 'boi', peso_total_compra: '',
  forma_compra: 'arroba', valor_unit_compra: '', valor_total_compra: '',
}
const EMPTY_VENDA = {
  data_venda: hoje(), comprador: '', qtd_vendida: '',
  peso_total_venda: '', forma_venda: 'arroba', valor_unit_venda: '', valor_total_venda: '',
}
const EMPTY_CUSTO = { descricao: '', valor: '', data: hoje() }

function LabelValue({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className={`text-sm text-right ${bold ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>{value}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      {children}
    </div>
  )
}

export default function LotesPage() {
  const [operacoes, setOperacoes] = useState<Operacao[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [loading, setLoading] = useState(true)
  const [setupSql, setSetupSql] = useState('')

  const [selectedOp, setSelectedOp] = useState<Operacao | null>(null)
  const [vendas, setVendas] = useState<Venda[]>([])
  const [custos, setCustos] = useState<Custo[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [openNewOp, setOpenNewOp] = useState(false)
  const [openVenda, setOpenVenda] = useState(false)
  const [openCusto, setOpenCusto] = useState(false)
  const [openEditOp, setOpenEditOp] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formOp, setFormOp] = useState({ ...EMPTY_OP })
  const [formVenda, setFormVenda] = useState({ ...EMPTY_VENDA })
  const [formCusto, setFormCusto] = useState({ ...EMPTY_CUSTO })
  const [formEditOp, setFormEditOp] = useState({ ...EMPTY_OP })

  async function load() {
    setLoading(true)
    const { data: faz } = await supabase.from('fazendas').select('id, nome').order('nome')
    setFazendas(faz ?? [])
    const { data, error } = await supabase
      .from('operacoes_comerciais')
      .select('*')
      .order('data_compra', { ascending: false })
    if (error) { setSetupSql(SQL_SETUP); setLoading(false); return }
    setSetupSql('')
    setOperacoes(data ?? [])
    setLoading(false)
  }

  async function openDetail(op: Operacao) {
    setLoadingDetail(true)
    setSelectedOp(op)
    window.scrollTo(0, 0)
    const [{ data: vs }, { data: cs }] = await Promise.all([
      supabase.from('operacoes_vendas').select('*').eq('operacao_id', op.id).order('data_venda'),
      supabase.from('operacoes_custos').select('*').eq('operacao_id', op.id).order('created_at'),
    ])
    setVendas(vs ?? [])
    setCustos(cs ?? [])
    setLoadingDetail(false)
  }

  async function reloadDetail() {
    if (!selectedOp) return
    const [{ data: vs }, { data: cs }] = await Promise.all([
      supabase.from('operacoes_vendas').select('*').eq('operacao_id', selectedOp.id).order('data_venda'),
      supabase.from('operacoes_custos').select('*').eq('operacao_id', selectedOp.id).order('created_at'),
    ])
    setVendas(vs ?? [])
    setCustos(cs ?? [])
  }

  useEffect(() => { load() }, [])

  function fOp(k: string, v: string) { setFormOp(p => ({ ...p, [k]: v })) }
  function fVenda(k: string, v: string) { setFormVenda(p => ({ ...p, [k]: v })) }
  function fCusto(k: string, v: string) { setFormCusto(p => ({ ...p, [k]: v })) }
  function fEditOp(k: string, v: string) { setFormEditOp(p => ({ ...p, [k]: v })) }

  function openEdit() {
    if (!selectedOp) return
    setFormEditOp({
      nome: selectedOp.nome,
      fazenda_id: selectedOp.fazenda_id ?? '',
      data_compra: selectedOp.data_compra,
      vendedor: selectedOp.vendedor,
      qtd_compra: String(selectedOp.qtd_compra),
      categoria: selectedOp.categoria,
      peso_total_compra: selectedOp.peso_total_compra ? String(selectedOp.peso_total_compra) : '',
      forma_compra: selectedOp.forma_compra,
      valor_unit_compra: selectedOp.valor_unit_compra ? String(selectedOp.valor_unit_compra) : '',
      valor_total_compra: String(selectedOp.valor_total_compra),
    })
    setOpenEditOp(true)
  }

  async function insertFinanceiro(payload: Record<string, unknown>) {
    let { error } = await supabase.from('financeiro').insert({
      ...payload, status: payload.tipo === 'entrada' ? 'recebido' : 'pago', data_vencimento: null,
    })
    if (error && /status|data_vencimento|PGRST204/.test(error.message + (error.code ?? ''))) {
      await supabase.from('financeiro').insert(payload)
    }
  }

  async function salvarOperacao() {
    if (!formOp.nome.trim() || !formOp.vendedor.trim() || !formOp.qtd_compra || !formOp.valor_total_compra) {
      alert('Preencha nome, vendedor, quantidade e valor total.'); return
    }
    setSaving(true)
    const fazId = formOp.fazenda_id || fazendas[0]?.id || null
    const payload = {
      nome: formOp.nome.trim(),
      fazenda_id: fazId,
      data_compra: formOp.data_compra,
      vendedor: formOp.vendedor.trim(),
      qtd_compra: parseInt(formOp.qtd_compra),
      categoria: formOp.categoria,
      peso_total_compra: formOp.peso_total_compra ? num(formOp.peso_total_compra) : null,
      forma_compra: formOp.forma_compra,
      valor_unit_compra: formOp.valor_unit_compra ? num(formOp.valor_unit_compra) : null,
      valor_total_compra: num(formOp.valor_total_compra),
    }
    const { error } = await supabase.from('operacoes_comerciais').insert(payload)
    if (!error) {
      await insertFinanceiro({
        fazenda_id: fazId, tipo: 'saida', categoria: 'Compra gado comercial',
        valor: payload.valor_total_compra, data: payload.data_compra,
        descricao: `Compra - ${payload.nome} (${payload.vendedor})`,
      })
      setOpenNewOp(false)
      setFormOp({ ...EMPTY_OP })
      load()
    } else {
      alert(`Erro: ${error.message}`)
    }
    setSaving(false)
  }

  async function salvarVenda() {
    if (!selectedOp) return
    if (!formVenda.comprador.trim() || !formVenda.qtd_vendida || !formVenda.valor_total_venda) {
      alert('Preencha comprador, quantidade e valor total.'); return
    }
    const qtd = parseInt(formVenda.qtd_vendida)
    const saldoAtual = selectedOp.qtd_compra - vendas.reduce((s, v) => s + v.qtd_vendida, 0)
    if (qtd > saldoAtual) {
      alert(`Quantidade (${qtd}) maior que o saldo disponível (${saldoAtual} cab.).`); return
    }
    setSaving(true)
    const vtotal = num(formVenda.valor_total_venda)
    const { error } = await supabase.from('operacoes_vendas').insert({
      operacao_id: selectedOp.id,
      data_venda: formVenda.data_venda,
      comprador: formVenda.comprador.trim(),
      qtd_vendida: qtd,
      peso_total_venda: formVenda.peso_total_venda ? num(formVenda.peso_total_venda) : null,
      forma_venda: formVenda.forma_venda,
      valor_unit_venda: formVenda.valor_unit_venda ? num(formVenda.valor_unit_venda) : null,
      valor_total_venda: vtotal,
    })
    if (!error) {
      await insertFinanceiro({
        fazenda_id: selectedOp.fazenda_id, tipo: 'entrada', categoria: 'Venda gado comercial',
        valor: vtotal, data: formVenda.data_venda,
        descricao: `Venda - ${selectedOp.nome} → ${formVenda.comprador.trim()}`,
      })
      const { data: todasVendas } = await supabase
        .from('operacoes_vendas').select('qtd_vendida').eq('operacao_id', selectedOp.id)
      const totalVendido = (todasVendas ?? []).reduce((s: number, v: { qtd_vendida: number }) => s + v.qtd_vendida, 0)
      if (totalVendido >= selectedOp.qtd_compra) {
        await supabase.from('operacoes_comerciais').update({ status: 'encerrada' }).eq('id', selectedOp.id)
        setSelectedOp(prev => prev ? { ...prev, status: 'encerrada' } : prev)
      }
      setOpenVenda(false)
      setFormVenda({ ...EMPTY_VENDA })
      reloadDetail()
    } else {
      alert(`Erro: ${error.message}`)
    }
    setSaving(false)
  }

  async function salvarCusto() {
    if (!selectedOp) return
    if (!formCusto.descricao.trim() || !formCusto.valor) {
      alert('Preencha descrição e valor.'); return
    }
    setSaving(true)
    const valor = num(formCusto.valor)
    const { error } = await supabase.from('operacoes_custos').insert({
      operacao_id: selectedOp.id,
      descricao: formCusto.descricao.trim(),
      valor,
      data: formCusto.data || null,
    })
    if (!error) {
      await insertFinanceiro({
        fazenda_id: selectedOp.fazenda_id, tipo: 'saida', categoria: 'Custo gado comercial',
        valor, data: formCusto.data || hoje(),
        descricao: `${formCusto.descricao.trim()} - ${selectedOp.nome}`,
      })
      setOpenCusto(false)
      setFormCusto({ ...EMPTY_CUSTO })
      reloadDetail()
    } else {
      alert(`Erro: ${error.message}`)
    }
    setSaving(false)
  }

  async function excluirVenda(id: string) {
    if (!confirm('Excluir esta venda? O lançamento no financeiro não será removido automaticamente.')) return
    await supabase.from('operacoes_vendas').delete().eq('id', id)
    reloadDetail()
  }

  async function excluirCusto(id: string) {
    if (!confirm('Excluir este custo? O lançamento no financeiro não será removido automaticamente.')) return
    await supabase.from('operacoes_custos').delete().eq('id', id)
    reloadDetail()
  }

  async function excluirOperacao(id: string, nome: string) {
    if (!confirm(`Excluir "${nome}"? Todas as vendas e custos desta operação serão apagados.`)) return
    await supabase.from('operacoes_comerciais').delete().eq('id', id)
    setSelectedOp(null)
    load()
  }

  async function salvarEditOperacao() {
    if (!selectedOp) return
    if (!formEditOp.nome.trim()) { alert('Nome é obrigatório.'); return }
    setSaving(true)
    const payload = {
      nome: formEditOp.nome.trim(),
      vendedor: formEditOp.vendedor.trim(),
      data_compra: formEditOp.data_compra,
      qtd_compra: parseInt(formEditOp.qtd_compra) || selectedOp.qtd_compra,
      categoria: formEditOp.categoria,
      peso_total_compra: formEditOp.peso_total_compra ? num(formEditOp.peso_total_compra) : null,
      forma_compra: formEditOp.forma_compra,
      valor_unit_compra: formEditOp.valor_unit_compra ? num(formEditOp.valor_unit_compra) : null,
      valor_total_compra: num(formEditOp.valor_total_compra) || selectedOp.valor_total_compra,
    }
    const { error } = await supabase.from('operacoes_comerciais').update(payload).eq('id', selectedOp.id)
    if (!error) {
      setSelectedOp(prev => prev ? { ...prev, ...payload } : prev)
      setOpenEditOp(false)
      load()
    } else {
      alert(`Erro: ${error.message}`)
    }
    setSaving(false)
  }

  async function encerrarManual() {
    if (!selectedOp) return
    if (!confirm('Encerrar esta operação manualmente? Ela será marcada como finalizada.')) return
    const { error } = await supabase.from('operacoes_comerciais').update({ status: 'encerrada' }).eq('id', selectedOp.id)
    if (!error) {
      setSelectedOp(prev => prev ? { ...prev, status: 'encerrada' } : prev)
    } else {
      alert(`Erro: ${error.message}`)
    }
  }

  // ── SETUP SQL ──
  if (setupSql) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <h1 className="font-bold text-xl text-gray-900 mb-1">Lotes Comerciais</h1>
        <p className="text-sm text-red-600 mb-3">Execute o SQL abaixo no Supabase para criar as tabelas:</p>
        <pre className="bg-gray-900 text-green-300 text-xs rounded-xl p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">{setupSql}</pre>
        <Button className="mt-4 bg-green-700 hover:bg-green-800" onClick={load}>Tentar novamente</Button>
      </div>
    )
  }

  // ── DETAIL VIEW ──
  if (selectedOp) {
    const r = calcResultado(selectedOp, vendas, custos)
    const lucroPoz = r.lucroLiquido >= 0

    return (
      <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => setSelectedOp(null)}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 leading-tight truncate">{selectedOp.nome}</h1>
            <p className="text-xs text-gray-500">
              {CAT_LABEL[selectedOp.categoria] ?? selectedOp.categoria} · Comprado em {fmtDate(selectedOp.data_compra)}
            </p>
          </div>
          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
            selectedOp.status === 'em_aberto' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
          }`}>
            {selectedOp.status === 'em_aberto' ? 'Em aberto' : 'Encerrada'}
          </span>
          <button
            onClick={openEdit}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 shrink-0"
          >
            <Pencil size={16} />
          </button>
        </div>

        {loadingDetail && <p className="text-sm text-gray-400 text-center py-12">Carregando...</p>}

        {!loadingDetail && !selectedOp.valor_unit_compra && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex items-center justify-between gap-3">
            <p className="text-sm text-amber-700">Valor unitário de compra não informado — custo por cabeça pode estar impreciso.</p>
            <button
              onClick={openEdit}
              className="shrink-0 text-xs font-semibold text-amber-700 border border-amber-300 rounded-lg px-2.5 py-1 hover:bg-amber-100 transition-colors whitespace-nowrap"
            >
              Informar
            </button>
          </div>
        )}

        {!loadingDetail && (
          <>
            {/* COMPRA */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Compra</p>
              <div className="space-y-2">
                <LabelValue label="Vendedor" value={selectedOp.vendedor} />
                <LabelValue label="Data" value={fmtDate(selectedOp.data_compra)} />
                <LabelValue label="Cabeças compradas" value={`${selectedOp.qtd_compra} cab.`} />
                <LabelValue label="Categoria" value={CAT_LABEL[selectedOp.categoria] ?? selectedOp.categoria} />
                {selectedOp.peso_total_compra != null && (
                  <LabelValue label="Peso total compra" value={`${selectedOp.peso_total_compra.toLocaleString('pt-BR')} kg`} />
                )}
                <LabelValue label="Forma de compra" value={FORMA_NOME[selectedOp.forma_compra] ?? selectedOp.forma_compra} />
                {selectedOp.valor_unit_compra != null && (
                  <LabelValue label="Valor unit." value={`${fmt(selectedOp.valor_unit_compra)} / ${FORMA_LABEL[selectedOp.forma_compra]}`} />
                )}
                <LabelValue label="Valor total compra" value={fmt(selectedOp.valor_total_compra)} bold />
              </div>
              {r.saldo > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-sm font-semibold text-amber-600">
                    Saldo em estoque: {r.saldo} cab.
                  </p>
                  <p className="text-xs text-amber-400">
                    {Math.round((r.saldo / selectedOp.qtd_compra) * 100)}% restante
                  </p>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4">
                {selectedOp.status === 'em_aberto' && (
                  <button
                    onClick={encerrarManual}
                    className="text-xs text-amber-600 hover:text-amber-800 transition-colors font-medium"
                  >
                    Encerrar operação
                  </button>
                )}
                <button
                  onClick={() => excluirOperacao(selectedOp.id, selectedOp.nome)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Excluir operação
                </button>
              </div>
            </div>

            {/* VENDAS */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Vendas</p>
                <button
                  onClick={() => { setFormVenda({ ...EMPTY_VENDA }); setOpenVenda(true) }}
                  className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800 transition-colors"
                >
                  <Plus size={13} /> Registrar venda
                </button>
              </div>
              {vendas.length === 0 && (
                <p className="text-sm text-gray-400">Nenhuma venda registrada ainda.</p>
              )}
              {vendas.map((v, i) => (
                <div key={v.id} className={`flex items-start gap-3 ${i > 0 ? 'pt-3 mt-3 border-t border-gray-100' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{v.comprador}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{fmtDate(v.data_venda)} · {v.qtd_vendida} cab.</p>
                    {v.peso_total_venda != null && (
                      <p className="text-xs text-gray-400">
                        {v.peso_total_venda.toLocaleString('pt-BR')} kg
                        {v.valor_unit_venda != null && ` · ${fmt(v.valor_unit_venda)}/${FORMA_LABEL[v.forma_venda]}`}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm text-gray-900">{fmt(v.valor_total_venda)}</p>
                  </div>
                  <button
                    onClick={() => excluirVenda(v.id)}
                    className="p-1 text-gray-200 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {vendas.length > 0 && (
                <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">{r.qtdVendida} cab. vendidas</span>
                  <span className="text-sm font-bold text-gray-900">{fmt(r.totalVenda)}</span>
                </div>
              )}
            </div>

            {/* CUSTOS */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Custos da operação</p>
                <button
                  onClick={() => { setFormCusto({ ...EMPTY_CUSTO }); setOpenCusto(true) }}
                  className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800 transition-colors"
                >
                  <Plus size={13} /> Lançar custo
                </button>
              </div>
              {custos.length === 0 && (
                <p className="text-sm text-gray-400">Nenhum custo lançado.</p>
              )}
              {custos.map((c, i) => (
                <div key={c.id} className={`flex items-center gap-3 ${i > 0 ? 'pt-3 mt-3 border-t border-gray-100' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{c.descricao}</p>
                    {c.data && <p className="text-xs text-gray-400">{fmtDate(c.data)}</p>}
                  </div>
                  <p className="text-sm font-semibold text-red-600 shrink-0">{fmt(c.valor)}</p>
                  <button
                    onClick={() => excluirCusto(c.id)}
                    className="p-1 text-gray-200 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {custos.length > 0 && (
                <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">Total custos</span>
                  <span className="text-sm font-bold text-red-600">{fmt(r.totalCustos)}</span>
                </div>
              )}
            </div>

            {/* CUSTO TOTAL / CABEÇA */}
            {selectedOp.qtd_compra > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Custo acumulado</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="text-sm text-gray-600">Compra do lote</span>
                    <span className="text-sm font-medium text-gray-900">{fmt(selectedOp.valor_total_compra)}</span>
                  </div>
                  {custos.length > 0 && custos.reduce((acc, c) => {
                    acc[c.descricao] = (acc[c.descricao] ?? 0) + c.valor; return acc
                  }, {} as Record<string, number>) && Object.entries(custos.reduce((acc, c) => {
                    acc[c.descricao] = (acc[c.descricao] ?? 0) + c.valor; return acc
                  }, {} as Record<string, number>)).map(([desc, val]) => (
                    <div key={desc} className="flex justify-between items-baseline gap-3">
                      <span className="text-sm text-gray-500">{desc}</span>
                      <span className="text-sm font-medium text-red-600">+ {fmt(val)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-baseline gap-3 pt-2 border-t border-gray-200">
                    <span className="text-sm font-semibold text-gray-700">Custo total</span>
                    <span className="text-sm font-bold text-gray-900">{fmt(selectedOp.valor_total_compra + r.totalCustos)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Custo / cabeça</p>
                    <p className="text-lg font-bold text-gray-900">
                      {fmt((selectedOp.valor_total_compra + r.totalCustos) / selectedOp.qtd_compra)}
                    </p>
                    <p className="text-[10px] text-gray-400">{selectedOp.qtd_compra} cabeças no total</p>
                  </div>
                  {r.saldo > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">Em aberto</p>
                      <p className="text-lg font-bold text-amber-600">{r.saldo} cab.</p>
                      <p className="text-[10px] text-gray-400">{fmt((selectedOp.valor_total_compra + r.totalCustos) / selectedOp.qtd_compra * r.saldo)} custo proporcional</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RESULTADO */}
            {r.qtdVendida > 0 && (
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Resultado</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="text-sm text-gray-600">Receita de vendas</span>
                    <span className="text-sm font-medium text-gray-900">{fmt(r.totalVenda)}</span>
                  </div>
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="text-sm text-gray-600">
                      Custo compra ({r.qtdVendida}/{selectedOp.qtd_compra} cab.)
                    </span>
                    <span className="text-sm font-medium text-red-600">− {fmt(r.custoCompraProp)}</span>
                  </div>
                  <div className="flex justify-between items-baseline gap-3 pt-2 border-t border-gray-200">
                    <span className="text-sm font-semibold text-gray-700">Lucro bruto</span>
                    <span className={`text-sm font-bold ${r.lucroBruto >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                      {fmt(r.lucroBruto)}
                    </span>
                  </div>
                  {custos.length > 0 && (
                    <div className="flex justify-between items-baseline gap-3">
                      <span className="text-sm text-gray-600">Custos da operação</span>
                      <span className="text-sm font-medium text-red-600">− {fmt(r.totalCustos)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline gap-3 pt-2 border-t border-gray-300 pb-1">
                    <span className="text-base font-bold text-gray-900">Lucro líquido</span>
                    <span className={`text-base font-bold ${lucroPoz ? 'text-green-700' : 'text-red-600'}`}>
                      {fmt(r.lucroLiquido)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-white rounded-xl p-3 border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Margem</p>
                    <p className={`text-xl font-bold ${r.margem >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {r.margem.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Lucro / cabeça</p>
                    <p className={`text-xl font-bold ${r.lucroPerCabeca >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {fmt(r.lucroPerCabeca)}
                    </p>
                  </div>
                  {r.diasMedio != null && (
                    <div className="bg-white rounded-xl p-3 border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Dias em estoque</p>
                      <p className="text-xl font-bold text-gray-900">{r.diasMedio}d</p>
                    </div>
                  )}
                  {r.quebraPeso != null && (
                    <div className="bg-white rounded-xl p-3 border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Quebra de peso</p>
                      <p className="text-xl font-bold text-gray-900">
                        {r.quebraPeso.toFixed(0)} kg
                      </p>
                      <p className="text-xs text-gray-400">{r.quebraPesoPerc!.toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Dialog: Nova Venda */}
        <Dialog open={openVenda} onOpenChange={setOpenVenda}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Registrar Venda</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <Field label="Comprador">
                <Input placeholder="Nome do comprador / matadouro" value={formVenda.comprador}
                  onChange={e => fVenda('comprador', e.target.value)} />
              </Field>
              <Field label="Data da venda">
                <Input type="date" value={formVenda.data_venda}
                  onChange={e => fVenda('data_venda', e.target.value)} />
              </Field>
              <Field label={`Cabeças vendidas (saldo: ${r.saldo} cab.)`}>
                <Input type="number" min={1} max={r.saldo} placeholder="Quantidade"
                  value={formVenda.qtd_vendida} onChange={e => fVenda('qtd_vendida', e.target.value)} />
              </Field>
              <Field label="Peso total de venda (kg)">
                <Input type="number" placeholder="Opcional"
                  value={formVenda.peso_total_venda} onChange={e => fVenda('peso_total_venda', e.target.value)} />
              </Field>
              <Field label="Forma de venda">
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={formVenda.forma_venda} onChange={e => fVenda('forma_venda', e.target.value)}>
                  {FORMAS.map(f => <option key={f} value={f}>{FORMA_NOME[f]}</option>)}
                </select>
              </Field>
              <Field label="Valor unitário (opcional)">
                <Input type="number" placeholder={`R$ por ${FORMA_LABEL[formVenda.forma_venda]}`}
                  value={formVenda.valor_unit_venda} onChange={e => fVenda('valor_unit_venda', e.target.value)} />
              </Field>
              <Field label="Valor total da venda">
                <Input type="number" placeholder="R$"
                  value={formVenda.valor_total_venda} onChange={e => fVenda('valor_total_venda', e.target.value)} />
              </Field>
              <Button className="w-full bg-green-700 hover:bg-green-800" onClick={salvarVenda} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Venda'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Novo Custo */}
        <Dialog open={openCusto} onOpenChange={setOpenCusto}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Lançar Custo</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <Field label="Descrição">
                <Input placeholder="Ex: Frete, Comissão, Alimentação, Sanitário..."
                  value={formCusto.descricao} onChange={e => fCusto('descricao', e.target.value)} />
              </Field>
              <Field label="Valor">
                <Input type="number" placeholder="R$"
                  value={formCusto.valor} onChange={e => fCusto('valor', e.target.value)} />
              </Field>
              <Field label="Data">
                <Input type="date" value={formCusto.data}
                  onChange={e => fCusto('data', e.target.value)} />
              </Field>
              <Button className="w-full bg-green-700 hover:bg-green-800" onClick={salvarCusto} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Custo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Editar Operação */}
        <Dialog open={openEditOp} onOpenChange={setOpenEditOp}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Editar Operação</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <Field label="Nome da operação">
                <Input placeholder="Ex: Cícero - 15/09/2026"
                  value={formEditOp.nome} onChange={e => fEditOp('nome', e.target.value)} />
              </Field>
              {fazendas.length > 1 && (
                <Field label="Fazenda">
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={formEditOp.fazenda_id} onChange={e => fEditOp('fazenda_id', e.target.value)}>
                    {fazendas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </Field>
              )}
              <div className="bg-gray-50 rounded-xl p-3 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Dados da compra</p>
                <Field label="Vendedor (quem me vendeu)">
                  <Input placeholder="Nome do fornecedor"
                    value={formEditOp.vendedor} onChange={e => fEditOp('vendedor', e.target.value)} />
                </Field>
                <Field label="Data da compra">
                  <Input type="date" value={formEditOp.data_compra}
                    onChange={e => fEditOp('data_compra', e.target.value)} />
                </Field>
                <Field label="Quantidade de cabeças">
                  <Input type="number" min={1} placeholder="Ex: 30"
                    value={formEditOp.qtd_compra} onChange={e => fEditOp('qtd_compra', e.target.value)} />
                </Field>
                <Field label="Categoria predominante">
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={formEditOp.categoria} onChange={e => fEditOp('categoria', e.target.value)}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                  </select>
                </Field>
                <Field label="Peso total de compra (kg)">
                  <Input type="number" placeholder="Opcional"
                    value={formEditOp.peso_total_compra} onChange={e => fEditOp('peso_total_compra', e.target.value)} />
                </Field>
                <Field label="Forma de compra">
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={formEditOp.forma_compra} onChange={e => fEditOp('forma_compra', e.target.value)}>
                    {FORMAS.map(f => <option key={f} value={f}>{FORMA_NOME[f]}</option>)}
                  </select>
                </Field>
                <Field label="Valor unitário">
                  <Input type="number" placeholder={`R$ por ${FORMA_LABEL[formEditOp.forma_compra]}`}
                    value={formEditOp.valor_unit_compra} onChange={e => fEditOp('valor_unit_compra', e.target.value)} />
                </Field>
                <Field label="Valor total da compra">
                  <Input type="number" placeholder="R$"
                    value={formEditOp.valor_total_compra} onChange={e => fEditOp('valor_total_compra', e.target.value)} />
                </Field>
              </div>
              <Button className="w-full bg-green-700 hover:bg-green-800" onClick={salvarEditOperacao} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-bold text-xl text-gray-900">Lotes Comerciais</h1>
          <p className="text-sm text-gray-400">Compra e venda de gado por lote</p>
        </div>
        <button
          onClick={() => { setFormOp({ ...EMPTY_OP }); setOpenNewOp(true) }}
          className="flex items-center gap-1.5 bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded-xl hover:bg-green-800 transition-colors shrink-0"
        >
          <Plus size={16} /> Nova
        </button>
      </div>

      {loading && <p className="text-center text-gray-400 py-12">Carregando...</p>}

      {!loading && operacoes.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base font-medium mb-1">Nenhuma operação registrada</p>
          <p className="text-sm">Registre sua primeira compra de lote.</p>
        </div>
      )}

      {!loading && operacoes.length > 0 && (
        <div className="space-y-3">
          {operacoes.map(op => (
            <button
              key={op.id}
              onClick={() => openDetail(op)}
              className="w-full text-left bg-white rounded-2xl border border-gray-200 p-4 hover:border-green-300 hover:shadow-sm transition-all active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{op.nome}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {CAT_LABEL[op.categoria] ?? op.categoria} · {op.vendedor} · {fmtDate(op.data_compra)}
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  op.status === 'em_aberto' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                }`}>
                  {op.status === 'em_aberto' ? 'Em aberto' : 'Encerrada'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-gray-500">{op.qtd_compra} cab.</span>
                <span className="text-red-500 font-medium">compra: {fmt(op.valor_total_compra)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Dialog: Nova Operação */}
      <Dialog open={openNewOp} onOpenChange={setOpenNewOp}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Operação Comercial</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Field label="Nome da operação">
              <Input placeholder="Ex: Cícero - 15/09/2026"
                value={formOp.nome} onChange={e => fOp('nome', e.target.value)} />
            </Field>
            {fazendas.length > 1 && (
              <Field label="Fazenda">
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={formOp.fazenda_id} onChange={e => fOp('fazenda_id', e.target.value)}>
                  {fazendas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </Field>
            )}
            <div className="bg-gray-50 rounded-xl p-3 space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Dados da compra</p>
              <Field label="Vendedor (quem me vendeu)">
                <Input placeholder="Nome do fornecedor"
                  value={formOp.vendedor} onChange={e => fOp('vendedor', e.target.value)} />
              </Field>
              <Field label="Data da compra">
                <Input type="date" value={formOp.data_compra}
                  onChange={e => fOp('data_compra', e.target.value)} />
              </Field>
              <Field label="Quantidade de cabeças">
                <Input type="number" min={1} placeholder="Ex: 30"
                  value={formOp.qtd_compra} onChange={e => fOp('qtd_compra', e.target.value)} />
              </Field>
              <Field label="Categoria predominante">
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={formOp.categoria} onChange={e => fOp('categoria', e.target.value)}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                </select>
              </Field>
              <Field label="Peso total de compra (kg)">
                <Input type="number" placeholder="Opcional"
                  value={formOp.peso_total_compra} onChange={e => fOp('peso_total_compra', e.target.value)} />
              </Field>
              <Field label="Forma de compra">
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={formOp.forma_compra} onChange={e => fOp('forma_compra', e.target.value)}>
                  {FORMAS.map(f => <option key={f} value={f}>{FORMA_NOME[f]}</option>)}
                </select>
              </Field>
              <Field label="Valor unitário (opcional)">
                <Input type="number" placeholder={`R$ por ${FORMA_LABEL[formOp.forma_compra]}`}
                  value={formOp.valor_unit_compra} onChange={e => fOp('valor_unit_compra', e.target.value)} />
              </Field>
              <Field label="Valor total da compra">
                <Input type="number" placeholder="R$"
                  value={formOp.valor_total_compra} onChange={e => fOp('valor_total_compra', e.target.value)} />
              </Field>
            </div>
            <Button className="w-full bg-green-700 hover:bg-green-800" onClick={salvarOperacao} disabled={saving}>
              {saving ? 'Salvando...' : 'Criar Operação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
