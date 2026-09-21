'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ChevronLeft, Pencil, Plus, Trash2 } from 'lucide-react'

const supabase = createClient()

type Fazenda = { id: string; nome: string }
type Operacao = {
  id: string
  fazenda_id: string | null
  nome: string
  status: string
  data_compra: string | null
  vendedor: string | null
  desconto_padrao_pct: number | null
  preco_compra_kg: number | null
  prazo_pagamento_dias: number | null
  prazo_recebimento_dias: number | null
  data_venda: string | null
  comprador: string | null
  pago: boolean
  data_pago_efetivo: string | null
  recebido: boolean
  data_recebido_efetivo: string | null
}
type AnimalOp = {
  id: string
  operacao_id: string
  identificacao: string
  peso_vivo_kg: number | null
  desconto_pct: number | null
  preco_compra_kg: number | null
  peso_morto_kg: number | null
  preco_venda_kg: number | null
}

function computeAnimal(a: AnimalOp, op: Operacao) {
  const desconto = a.desconto_pct ?? op.desconto_padrao_pct ?? 0
  const precoCompra = a.preco_compra_kg ?? op.preco_compra_kg ?? 0
  const pesoDesc = a.peso_vivo_kg != null ? a.peso_vivo_kg * (1 - desconto / 100) : null
  const custo = pesoDesc != null && precoCompra ? pesoDesc * precoCompra : null
  const venda = a.peso_morto_kg != null && a.preco_venda_kg != null ? a.peso_morto_kg * a.preco_venda_kg : null
  const rendimento = a.peso_morto_kg != null && a.peso_vivo_kg ? (a.peso_morto_kg / a.peso_vivo_kg) * 100 : null
  const lucro = custo != null && venda != null ? venda - custo : null
  return { desconto, precoCompra, pesoDesc, custo, venda, rendimento, lucro }
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtNum = (v: number, dec = 2) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
const hoje = () => new Date().toISOString().split('T')[0]

function addDias(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
function diasEntre(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
}

const EMPTY_OP = {
  nome: '', fazenda_id: '', status: 'em_aberto',
  data_compra: hoje(), vendedor: '',
  desconto_padrao_pct: '', preco_compra_kg: '',
  prazo_pagamento_dias: '30', prazo_recebimento_dias: '0',
  data_venda: '', comprador: '',
}
const EMPTY_ANIMAL = {
  id: '', identificacao: '', peso_vivo_kg: '', desconto_pct: '',
  preco_compra_kg: '', peso_morto_kg: '', preco_venda_kg: '',
}

export default function OperacoesPage() {
  const [operacoes, setOperacoes] = useState<Operacao[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Operacao | null>(null)
  const [animais, setAnimais] = useState<AnimalOp[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [openNew, setOpenNew] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_OP })
  const [openAnimal, setOpenAnimal] = useState(false)
  const [animalForm, setAnimalForm] = useState({ ...EMPTY_ANIMAL })
  const [savingAnimal, setSavingAnimal] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: faz }, { data: ops }] = await Promise.all([
      supabase.from('fazendas').select('id, nome').order('nome'),
      supabase.from('operacoes_comerciais')
        .select('id, fazenda_id, nome, status, data_compra, vendedor, desconto_padrao_pct, preco_compra_kg, prazo_pagamento_dias, prazo_recebimento_dias, data_venda, comprador, pago, data_pago_efetivo, recebido, data_recebido_efetivo')
        .order('data_compra', { ascending: false }),
    ])
    setFazendas(faz ?? [])
    setOperacoes((ops ?? []).map((o: any) => ({ ...o, pago: o.pago ?? false, recebido: o.recebido ?? false })))
    setLoading(false)
  }

  async function loadAnimais(opId: string) {
    setLoadingDetail(true)
    const { data } = await supabase.from('operacoes_animais')
      .select('id, operacao_id, identificacao, peso_vivo_kg, desconto_pct, preco_compra_kg, peso_morto_kg, preco_venda_kg')
      .eq('operacao_id', opId).order('created_at')
    setAnimais(data ?? [])
    setLoadingDetail(false)
  }

  useEffect(() => { load() }, [])

  function setF(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }
  function setAF(k: string, v: string) { setAnimalForm(p => ({ ...p, [k]: v })) }

  function openNewDialog() {
    setForm({ ...EMPTY_OP, fazenda_id: fazendas[0]?.id ?? '' })
    setOpenNew(true)
  }

  function openEditDialog() {
    if (!selected) return
    setForm({
      nome: selected.nome,
      fazenda_id: selected.fazenda_id ?? fazendas[0]?.id ?? '',
      status: selected.status,
      data_compra: selected.data_compra ?? hoje(),
      vendedor: selected.vendedor ?? '',
      desconto_padrao_pct: selected.desconto_padrao_pct != null ? String(selected.desconto_padrao_pct) : '',
      preco_compra_kg: selected.preco_compra_kg != null ? String(selected.preco_compra_kg) : '',
      prazo_pagamento_dias: selected.prazo_pagamento_dias != null ? String(selected.prazo_pagamento_dias) : '',
      prazo_recebimento_dias: selected.prazo_recebimento_dias != null ? String(selected.prazo_recebimento_dias) : '',
      data_venda: selected.data_venda ?? '',
      comprador: selected.comprador ?? '',
    })
    setOpenEdit(true)
  }

  function buildOpPayload(f: typeof form) {
    return {
      nome: f.nome.trim(),
      fazenda_id: f.fazenda_id || fazendas[0]?.id || null,
      status: f.status,
      data_compra: f.data_compra || null,
      vendedor: f.vendedor.trim() || null,
      desconto_padrao_pct: f.desconto_padrao_pct ? parseFloat(f.desconto_padrao_pct.replace(',', '.')) : null,
      preco_compra_kg: f.preco_compra_kg ? parseFloat(f.preco_compra_kg.replace(',', '.')) : null,
      prazo_pagamento_dias: f.prazo_pagamento_dias ? parseInt(f.prazo_pagamento_dias) : null,
      prazo_recebimento_dias: f.prazo_recebimento_dias ? parseInt(f.prazo_recebimento_dias) : null,
      data_venda: f.data_venda || null,
      comprador: f.comprador.trim() || null,
    }
  }

  async function salvar() {
    if (!form.nome.trim()) { alert('Nome é obrigatório.'); return }
    setSaving(true)
    const { error } = await supabase.from('operacoes_comerciais').insert(buildOpPayload(form))
    if (!error) { setOpenNew(false); load() }
    else alert(`Erro: ${error.message}`)
    setSaving(false)
  }

  async function salvarEdit() {
    if (!selected || !form.nome.trim()) { alert('Nome é obrigatório.'); return }
    setSaving(true)
    const payload = buildOpPayload(form)
    const { error } = await supabase.from('operacoes_comerciais').update(payload).eq('id', selected.id)
    if (!error) {
      const updated = { ...selected, ...payload }
      setSelected(updated)
      setOperacoes(prev => prev.map(o => o.id === selected.id ? updated : o))
      setOpenEdit(false)
    } else {
      alert(`Erro: ${error.message}`)
    }
    setSaving(false)
  }

  async function excluirOperacao() {
    if (!selected) return
    if (!confirm(`Excluir "${selected.nome}"? Todos os animais serão removidos.`)) return
    await supabase.from('operacoes_comerciais').delete().eq('id', selected.id)
    setSelected(null)
    load()
  }

  function openAnimalDialog(a?: AnimalOp) {
    setAnimalForm(a ? {
      id: a.id,
      identificacao: a.identificacao,
      peso_vivo_kg: a.peso_vivo_kg != null ? String(a.peso_vivo_kg) : '',
      desconto_pct: a.desconto_pct != null ? String(a.desconto_pct) : '',
      preco_compra_kg: a.preco_compra_kg != null ? String(a.preco_compra_kg) : '',
      peso_morto_kg: a.peso_morto_kg != null ? String(a.peso_morto_kg) : '',
      preco_venda_kg: a.preco_venda_kg != null ? String(a.preco_venda_kg) : '',
    } : { ...EMPTY_ANIMAL })
    setOpenAnimal(true)
  }

  async function salvarAnimal() {
    if (!selected || !animalForm.identificacao.trim()) { alert('Identificação é obrigatória.'); return }
    setSavingAnimal(true)
    const payload = {
      operacao_id: selected.id,
      identificacao: animalForm.identificacao.trim(),
      peso_vivo_kg: animalForm.peso_vivo_kg ? parseFloat(animalForm.peso_vivo_kg.replace(',', '.')) : null,
      desconto_pct: animalForm.desconto_pct ? parseFloat(animalForm.desconto_pct.replace(',', '.')) : null,
      preco_compra_kg: animalForm.preco_compra_kg ? parseFloat(animalForm.preco_compra_kg.replace(',', '.')) : null,
      peso_morto_kg: animalForm.peso_morto_kg ? parseFloat(animalForm.peso_morto_kg.replace(',', '.')) : null,
      preco_venda_kg: animalForm.preco_venda_kg ? parseFloat(animalForm.preco_venda_kg.replace(',', '.')) : null,
    }
    let error
    if (animalForm.id) {
      ({ error } = await supabase.from('operacoes_animais').update(payload).eq('id', animalForm.id))
    } else {
      ({ error } = await supabase.from('operacoes_animais').insert(payload))
    }
    if (!error) { setOpenAnimal(false); loadAnimais(selected.id) }
    else alert(`Erro: ${error.message}`)
    setSavingAnimal(false)
  }

  async function excluirAnimal(id: string) {
    if (!confirm('Remover este animal?')) return
    await supabase.from('operacoes_animais').delete().eq('id', id)
    setAnimais(prev => prev.filter(a => a.id !== id))
  }

  async function togglePago() {
    if (!selected || savingStatus) return
    setSavingStatus(true)
    const next = !selected.pago
    const data = next ? { pago: true, data_pago_efetivo: hoje() } : { pago: false, data_pago_efetivo: null }
    const { error } = await supabase.from('operacoes_comerciais').update(data).eq('id', selected.id)
    if (!error) setSelected(p => p ? { ...p, ...data } : p)
    setSavingStatus(false)
  }

  async function toggleRecebido() {
    if (!selected || savingStatus) return
    setSavingStatus(true)
    const next = !selected.recebido
    const data = next ? { recebido: true, data_recebido_efetivo: hoje() } : { recebido: false, data_recebido_efetivo: null }
    const { error } = await supabase.from('operacoes_comerciais').update(data).eq('id', selected.id)
    if (!error) setSelected(p => p ? { ...p, ...data } : p)
    setSavingStatus(false)
  }

  // ── DETAIL VIEW ──
  if (selected) {
    const computed = animais.map(a => ({ ...a, _c: computeAnimal(a, selected) }))
    const custoTotal = computed.reduce((s, a) => s + (a._c.custo ?? 0), 0)
    const vendaTotal = computed.reduce((s, a) => s + (a._c.venda ?? 0), 0)
    const lucroTotal = vendaTotal - custoTotal
    const margem = vendaTotal > 0 ? (lucroTotal / vendaTotal) * 100 : null
    const roc = custoTotal > 0 ? (lucroTotal / custoTotal) * 100 : null
    const pesoVivoTotal = animais.reduce((s, a) => s + (a.peso_vivo_kg ?? 0), 0)
    const pesoMortoTotal = animais.reduce((s, a) => s + (a.peso_morto_kg ?? 0), 0)
    const rendComps = computed.filter(a => a._c.rendimento != null)
    const rendMedio = rendComps.length > 0
      ? rendComps.reduce((s, a) => s + (a._c.rendimento ?? 0), 0) / rendComps.length : null
    const dataPagPrev = selected.data_compra && selected.prazo_pagamento_dias != null
      ? addDias(selected.data_compra, selected.prazo_pagamento_dias) : null
    const dataRecPrev = selected.data_venda && selected.prazo_recebimento_dias != null
      ? addDias(selected.data_venda, selected.prazo_recebimento_dias) : null
    const descasamento = dataPagPrev && dataRecPrev ? diasEntre(dataPagPrev, dataRecPrev) : null
    const diasOp = selected.data_compra && selected.data_venda
      ? diasEntre(selected.data_compra, selected.data_venda) : null

    return (
      <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => setSelected(null)}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 leading-tight">{selected.nome}</h1>
            <p className="text-xs text-gray-500">Compra: {fmtDate(selected.data_compra)}</p>
          </div>
          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
            selected.status === 'em_aberto' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
          }`}>
            {selected.status === 'em_aberto' ? 'Em aberto' : 'Fechado'}
          </span>
          <button onClick={openEditDialog}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <Pencil size={16} />
          </button>
        </div>

        {loadingDetail && <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>}

        {!loadingDetail && (
          <>
            {/* Cabeçalho */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Cabeçalho</p>
              <div className="space-y-1.5">
                {([
                  ['Fornecedor', selected.vendedor],
                  ['Desconto padrão', selected.desconto_padrao_pct != null ? `${selected.desconto_padrao_pct}%` : null],
                  ['Preço de compra', selected.preco_compra_kg != null ? `R$ ${fmtNum(selected.preco_compra_kg)}/kg` : null],
                  ['Comprador', selected.comprador],
                  ['Data de venda', fmtDate(selected.data_venda)],
                  ['Prazo pagamento', selected.prazo_pagamento_dias != null ? `${selected.prazo_pagamento_dias} dias` : null],
                  ['Prazo recebimento', selected.prazo_recebimento_dias != null ? `${selected.prazo_recebimento_dias} dias` : null],
                ] as [string, string | null][]).map(([label, valor]) => (
                  <div key={label} className="flex justify-between items-baseline gap-3">
                    <span className="text-sm text-gray-500 shrink-0">{label}</span>
                    <span className={`text-sm font-medium text-right ${!valor || valor === '—' ? 'text-gray-300' : 'text-gray-900'}`}>
                      {valor || '—'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button onClick={excluirOperacao} className="text-xs text-red-400 hover:text-red-600 transition-colors">
                  Excluir operação
                </button>
              </div>
            </div>

            {/* Animais */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  Animais ({animais.length})
                </p>
                <button onClick={() => openAnimalDialog()}
                  className="flex items-center gap-1 h-[34px] px-3 bg-green-700 text-white rounded-full text-xs font-semibold hover:bg-green-800 transition-colors">
                  <Plus size={14} /> Adicionar
                </button>
              </div>
              <div className="space-y-2">
                {computed.map((a, i) => {
                  const c = a._c
                  return (
                    <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-semibold text-sm text-gray-900">{i + 1}. {a.identificacao}</span>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openAnimalDialog(a)}
                            className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => excluirAnimal(a.id)}
                            className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 mb-1">
                        <span className="text-gray-400">Compra: </span>
                        {a.peso_vivo_kg != null ? (
                          <>
                            {fmtNum(a.peso_vivo_kg, 0)} kg
                            {c.desconto > 0 && <span className="text-orange-500"> -{c.desconto}%</span>}
                            {c.pesoDesc != null && <> → {fmtNum(c.pesoDesc)} kg</>}
                            {c.custo != null && <> → <span className="font-semibold text-gray-800">{fmtBRL(c.custo)}</span></>}
                          </>
                        ) : <span className="text-gray-300">—</span>}
                      </div>
                      <div className="text-xs text-gray-600 mb-1">
                        <span className="text-gray-400">Venda: </span>
                        {a.peso_morto_kg != null && a.preco_venda_kg != null ? (
                          <>
                            {fmtNum(a.peso_morto_kg, 0)} kg × R$ {fmtNum(a.preco_venda_kg)}/kg
                            {c.venda != null && <> → <span className="font-semibold text-gray-800">{fmtBRL(c.venda)}</span></>}
                          </>
                        ) : <span className="text-gray-300">—</span>}
                      </div>
                      {(c.rendimento != null || c.lucro != null) && (
                        <div className="flex gap-4 text-xs pt-1.5 border-t border-gray-100 mt-1">
                          {c.rendimento != null && (
                            <span className="text-gray-500">
                              Rend: <span className="font-semibold text-gray-800">{fmtNum(c.rendimento, 1)}%</span>
                            </span>
                          )}
                          {c.lucro != null && (
                            <span className={`font-semibold ${c.lucro >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                              Lucro: {fmtBRL(c.lucro)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {animais.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6 bg-white rounded-xl border border-gray-100">
                    Nenhum animal adicionado.
                  </p>
                )}
              </div>
            </div>

            {/* Totais */}
            {animais.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Totais</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="text-sm text-gray-500">Animais</span>
                    <span className="text-sm font-medium text-gray-900">{animais.length} cab.</span>
                  </div>
                  {pesoVivoTotal > 0 && (
                    <div className="flex justify-between items-baseline gap-3">
                      <span className="text-sm text-gray-500">Peso vivo total</span>
                      <span className="text-sm font-medium text-gray-900">{fmtNum(pesoVivoTotal, 0)} kg</span>
                    </div>
                  )}
                  {pesoMortoTotal > 0 && (
                    <div className="flex justify-between items-baseline gap-3">
                      <span className="text-sm text-gray-500">Peso morto total</span>
                      <span className="text-sm font-medium text-gray-900">{fmtNum(pesoMortoTotal, 0)} kg</span>
                    </div>
                  )}
                  {diasOp != null && (
                    <div className="flex justify-between items-baseline gap-3">
                      <span className="text-sm text-gray-500">Dias compra → venda</span>
                      <span className="text-sm font-medium text-gray-900">{diasOp} dias</span>
                    </div>
                  )}
                </div>
                {custoTotal > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                    <div className="flex justify-between items-baseline gap-3">
                      <span className="text-sm text-gray-500">Custo total</span>
                      <span className="text-sm font-semibold text-gray-900">{fmtBRL(custoTotal)}</span>
                    </div>
                    {vendaTotal > 0 && (
                      <>
                        <div className="flex justify-between items-baseline gap-3">
                          <span className="text-sm text-gray-500">Venda total</span>
                          <span className="text-sm font-semibold text-gray-900">{fmtBRL(vendaTotal)}</span>
                        </div>
                        <div className="flex justify-between items-baseline gap-3 pt-1">
                          <span className="text-sm font-bold text-gray-700">Lucro bruto</span>
                          <span className={`text-sm font-bold ${lucroTotal >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {fmtBRL(lucroTotal)}
                          </span>
                        </div>
                        {margem != null && (
                          <div className="flex justify-between items-baseline gap-3">
                            <span className="text-sm text-gray-500">Margem s/ venda</span>
                            <span className="text-sm font-semibold text-gray-900">{fmtNum(margem, 1)}%</span>
                          </div>
                        )}
                        {roc != null && (
                          <div className="flex justify-between items-baseline gap-3">
                            <span className="text-sm text-gray-500">Retorno s/ capital</span>
                            <span className="text-sm font-semibold text-gray-900">{fmtNum(roc, 1)}%</span>
                          </div>
                        )}
                        {rendMedio != null && (
                          <div className="flex justify-between items-baseline gap-3">
                            <span className="text-sm text-gray-500">Rend. médio carcaça</span>
                            <span className="text-sm font-semibold text-gray-900">{fmtNum(rendMedio, 1)}%</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Financeiro */}
            {(dataPagPrev || dataRecPrev) && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Financeiro</p>
                <div className="space-y-3">
                  {dataPagPrev && (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-gray-600">Pagamento previsto</p>
                        <p className="text-xs text-gray-400">{fmtDate(dataPagPrev)}</p>
                        {selected.data_pago_efetivo && (
                          <p className="text-xs text-green-600">Pago em {fmtDate(selected.data_pago_efetivo)}</p>
                        )}
                      </div>
                      <button onClick={togglePago} disabled={savingStatus}
                        className={`shrink-0 h-[34px] px-3 rounded-full text-xs font-semibold transition-colors ${
                          selected.pago ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {selected.pago ? 'Pago ✓' : 'Marcar pago'}
                      </button>
                    </div>
                  )}
                  {dataRecPrev && (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-gray-600">Recebimento previsto</p>
                        <p className="text-xs text-gray-400">{fmtDate(dataRecPrev)}</p>
                        {selected.data_recebido_efetivo && (
                          <p className="text-xs text-green-600">Recebido em {fmtDate(selected.data_recebido_efetivo)}</p>
                        )}
                      </div>
                      <button onClick={toggleRecebido} disabled={savingStatus}
                        className={`shrink-0 h-[34px] px-3 rounded-full text-xs font-semibold transition-colors ${
                          selected.recebido ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {selected.recebido ? 'Recebido ✓' : 'Marcar recebido'}
                      </button>
                    </div>
                  )}
                  {descasamento != null && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        Descasamento:{' '}
                        <span className={`font-semibold ${descasamento < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                          {descasamento > 0 ? '+' : ''}{descasamento} dias
                        </span>
                        {descasamento < 0 && <span className="text-gray-400 ml-1">(paga antes de receber)</span>}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Edit operacao dialog */}
        <Dialog open={openEdit} onOpenChange={setOpenEdit}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Editar Operação</DialogTitle></DialogHeader>
            <OpForm form={form} setF={setF} fazendas={fazendas} saving={saving} onSave={salvarEdit} label="Salvar alterações" />
          </DialogContent>
        </Dialog>

        {/* Add/edit animal dialog */}
        <Dialog open={openAnimal} onOpenChange={setOpenAnimal}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{animalForm.id ? 'Editar Animal' : 'Adicionar Animal'}</DialogTitle>
            </DialogHeader>
            <AnimalForm
              form={animalForm} setF={setAF}
              defaultDesconto={selected.desconto_padrao_pct != null ? String(selected.desconto_padrao_pct) : ''}
              defaultPrecoCompra={selected.preco_compra_kg != null ? String(selected.preco_compra_kg) : ''}
              saving={savingAnimal} onSave={salvarAnimal}
            />
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">Operações</h1>
        <button onClick={openNewDialog}
          className="flex items-center gap-1.5 h-[34px] px-4 bg-green-700 text-white rounded-full text-sm font-semibold hover:bg-green-800 transition-colors">
          <Plus size={16} /> Nova
        </button>
      </div>

      {loading && <p className="text-center text-gray-400 py-12">Carregando...</p>}

      {!loading && operacoes.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base font-medium mb-1">Nenhuma operação</p>
          <p className="text-sm">Crie a primeira operação de compra e venda.</p>
        </div>
      )}

      {!loading && operacoes.length > 0 && (
        <div className="space-y-3">
          {operacoes.map(op => (
            <button key={op.id}
              onClick={() => { setSelected(op); loadAnimais(op.id) }}
              className="w-full text-left bg-white rounded-2xl border border-gray-200 p-4 hover:border-green-300 hover:shadow-sm transition-all active:scale-[0.99]">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-semibold text-gray-900">{op.nome}</p>
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  op.status === 'em_aberto' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                }`}>
                  {op.status === 'em_aberto' ? 'Em aberto' : 'Fechado'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                <span>Compra: {fmtDate(op.data_compra)}</span>
                {op.vendedor && <span>{op.vendedor}</span>}
                {op.preco_compra_kg != null && <span>R$ {fmtNum(op.preco_compra_kg)}/kg</span>}
                {op.desconto_padrao_pct != null && <span>desc. {op.desconto_padrao_pct}%</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Operação</DialogTitle></DialogHeader>
          <OpForm form={form} setF={setF} fazendas={fazendas} saving={saving} onSave={salvar} label="Criar Operação" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OpForm({ form, setF, fazendas, saving, onSave, label }: {
  form: Record<string, any>
  setF: (k: string, v: string) => void
  fazendas: Fazenda[]
  saving: boolean
  onSave: () => void
  label: string
}) {
  return (
    <div className="space-y-3 pt-2">
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Nome da operação</label>
        <Input placeholder="Ex: Compra fazenda Almeida Set/26"
          value={form.nome} onChange={e => setF('nome', e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Data da compra</label>
        <Input type="date" value={form.data_compra} onChange={e => setF('data_compra', e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Fornecedor</label>
        <Input placeholder="Nome do vendedor / fazenda de origem"
          value={form.vendedor} onChange={e => setF('vendedor', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Desconto padrão (%)</label>
          <Input type="number" placeholder="5" inputMode="decimal"
            value={form.desconto_padrao_pct} onChange={e => setF('desconto_padrao_pct', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Preço compra R$/kg</label>
          <Input type="number" placeholder="8,50" inputMode="decimal"
            value={form.preco_compra_kg} onChange={e => setF('preco_compra_kg', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Prazo pagamento (dias)</label>
          <Input type="number" placeholder="30"
            value={form.prazo_pagamento_dias} onChange={e => setF('prazo_pagamento_dias', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Prazo recebimento (dias)</label>
          <Input type="number" placeholder="0"
            value={form.prazo_recebimento_dias} onChange={e => setF('prazo_recebimento_dias', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Data da venda (opcional)</label>
        <Input type="date" value={form.data_venda} onChange={e => setF('data_venda', e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Comprador</label>
        <Input placeholder="Nome do comprador / destino"
          value={form.comprador} onChange={e => setF('comprador', e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Situação</label>
        <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={form.status} onChange={e => setF('status', e.target.value)}>
          <option value="em_aberto">Em aberto</option>
          <option value="fechado">Fechado</option>
        </select>
      </div>
      {fazendas.length > 1 && (
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Fazenda</label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={form.fazenda_id} onChange={e => setF('fazenda_id', e.target.value)}>
            {fazendas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
      )}
      <Button className="w-full bg-green-700 hover:bg-green-800" onClick={onSave} disabled={saving}>
        {saving ? 'Salvando...' : label}
      </Button>
    </div>
  )
}

function AnimalForm({ form, setF, defaultDesconto, defaultPrecoCompra, saving, onSave }: {
  form: Record<string, any>
  setF: (k: string, v: string) => void
  defaultDesconto: string
  defaultPrecoCompra: string
  saving: boolean
  onSave: () => void
}) {
  const pesoVivo = parseFloat(String(form.peso_vivo_kg || '').replace(',', '.')) || 0
  const desconto = parseFloat(String(form.desconto_pct || defaultDesconto || '').replace(',', '.')) || 0
  const precoCompra = parseFloat(String(form.preco_compra_kg || defaultPrecoCompra || '').replace(',', '.')) || 0
  const pesoDesc = pesoVivo > 0 ? pesoVivo * (1 - desconto / 100) : 0
  const custo = pesoDesc > 0 && precoCompra > 0 ? pesoDesc * precoCompra : 0
  const pesoMorto = parseFloat(String(form.peso_morto_kg || '').replace(',', '.')) || 0
  const precoVenda = parseFloat(String(form.preco_venda_kg || '').replace(',', '.')) || 0
  const venda = pesoMorto > 0 && precoVenda > 0 ? pesoMorto * precoVenda : 0
  const rendimento = pesoMorto > 0 && pesoVivo > 0 ? (pesoMorto / pesoVivo) * 100 : 0
  const lucro = custo > 0 && venda > 0 ? venda - custo : 0
  const fN = (v: number, dec = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

  return (
    <div className="space-y-3 pt-2">
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Identificação</label>
        <Input placeholder="Ex: FÊMEA, MACHO, FÊMEA-BOA"
          value={form.identificacao} onChange={e => setF('identificacao', e.target.value)} />
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-3">
        <p className="text-[11px] font-bold text-blue-500 uppercase tracking-widest">Compra</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Peso vivo (kg)</label>
            <Input type="number" placeholder="383" inputMode="decimal"
              value={form.peso_vivo_kg} onChange={e => setF('peso_vivo_kg', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Desconto (%) {defaultDesconto ? `padrão: ${defaultDesconto}%` : ''}
            </label>
            <Input type="number" placeholder={defaultDesconto || '5'} inputMode="decimal"
              value={form.desconto_pct} onChange={e => setF('desconto_pct', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">
            Preço compra R$/kg {defaultPrecoCompra ? `padrão: R$${defaultPrecoCompra}` : ''}
          </label>
          <Input type="number" placeholder={defaultPrecoCompra || '8,50'} inputMode="decimal"
            value={form.preco_compra_kg} onChange={e => setF('preco_compra_kg', e.target.value)} />
        </div>
        {pesoVivo > 0 && (
          <div className="bg-white rounded-lg p-2 text-xs text-gray-600 space-y-0.5">
            <p>Peso c/ desconto: <span className="font-semibold">{fN(pesoDesc)} kg</span></p>
            {custo > 0 && <p>Custo: <span className="font-semibold text-gray-900">R$ {fN(custo)}</span></p>}
          </div>
        )}
      </div>

      <div className="bg-green-50 border border-green-100 rounded-xl p-3 space-y-3">
        <p className="text-[11px] font-bold text-green-600 uppercase tracking-widest">Venda</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Peso morto (kg)</label>
            <Input type="number" placeholder="185" inputMode="decimal"
              value={form.peso_morto_kg} onChange={e => setF('peso_morto_kg', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Preço venda R$/kg</label>
            <Input type="number" placeholder="20,00" inputMode="decimal"
              value={form.preco_venda_kg} onChange={e => setF('preco_venda_kg', e.target.value)} />
          </div>
        </div>
        {venda > 0 && (
          <div className="bg-white rounded-lg p-2 text-xs text-gray-600 space-y-0.5">
            <p>Venda: <span className="font-semibold text-gray-900">R$ {fN(venda)}</span></p>
            {rendimento > 0 && <p>Rendimento carcaça: <span className="font-semibold">{fN(rendimento, 1)}%</span></p>}
            {lucro !== 0 && (
              <p>Lucro: <span className={`font-semibold ${lucro >= 0 ? 'text-green-700' : 'text-red-600'}`}>R$ {fN(lucro)}</span></p>
            )}
          </div>
        )}
      </div>

      <Button className="w-full bg-green-700 hover:bg-green-800" onClick={onSave} disabled={saving}>
        {saving ? 'Salvando...' : (form.id ? 'Salvar alterações' : 'Adicionar animal')}
      </Button>
    </div>
  )
}
