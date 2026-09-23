'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ChevronLeft, FileText, Pencil, Plus, Search, X } from 'lucide-react'

const supabase = createClient()

type Fazenda = { id: string; nome: string }
type Lote = {
  id: string
  fazenda_id: string | null
  nome: string
  tipo: string | null
  situacao: string
  data_criacao: string | null
  descricao: string | null
  observacao: string | null
  total_animais?: number
  custo_total?: number
  data_compra: string | null
  fornecedor: string | null
  desconto_pct: number | null
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
type Animal = {
  id: string; brinco: string; nome: string | null
  categoria: string; sexo: string; raca: string; valor_compra?: number | null
}
type LoteAnimalCom = {
  id: string
  lote_id: string
  identificacao: string | null
  peso_vivo_kg: number | null
  desconto_pct: number | null
  preco_compra_kg: number | null
  peso_morto_kg: number | null
  preco_venda_kg: number | null
  tipo_compra: 'vivo' | 'morto'
}
type LoteVendaAnimal = {
  id: string
  lote_id: string
  animal_id: string
  brinco: string
  nome: string | null
  peso_vivo_kg: number | null
  desconto_pct: number | null
  peso_morto_kg: number | null
  preco_venda_kg: number | null
}
type LoteDespesa = {
  id: string
  lote_id: string
  tipo: string
  descricao: string | null
  valor: number
}
type Lancamento = {
  id: string; descricao: string | null; tipo: string
  valor: number; data: string | null; categoria: string | null
  animal_id?: string | null
}

const TIPOS = ['cria', 'recria', 'engorda', 'comercial', 'descarte']
const TIPO_LABEL: Record<string, string> = {
  cria: 'Cria', recria: 'Recria', engorda: 'Engorda',
  comercial: 'Comercial', descarte: 'Descarte',
}
const TIPO_COLOR: Record<string, string> = {
  cria:      'bg-yellow-100 text-yellow-700',
  recria:    'bg-blue-100 text-blue-700',
  engorda:   'bg-green-100 text-green-700',
  comercial: 'bg-orange-100 text-orange-700',
  descarte:  'bg-red-100 text-red-700',
}
const CAT_LABEL: Record<string, string> = {
  matriz: 'Matriz', bezerro: 'Bezerro', bezerra: 'Bezerra', garrote: 'Garrote', garrota: 'Garrota',
  novilho: 'Novilho', novilha: 'Novilha', touro: 'Touro', boi: 'Boi',
}
const DEFAULT_RACAS = ['Nelore', 'Girolando', 'Gir', 'Angus', 'Brahman', 'Tabapuã', 'Mestiço', 'Outra']
const AVULSO_CATS = ['boi', 'novilho', 'garrote', 'garrota', 'bezerro', 'bezerra', 'novilha', 'matriz', 'touro'] as const
const CAT_SEXO_DEFAULT: Record<string, string> = {
  matriz: 'femea', bezerra: 'femea', novilha: 'femea', garrota: 'femea',
  boi: 'macho', novilho: 'macho', garrote: 'macho', bezerro: 'macho', touro: 'macho',
}
const DESPESA_LABEL: Record<string, string> = {
  frete: 'Frete', comissao: 'Comissão', outros: 'Outros',
}

const r2 = (v: number) => Math.round(v * 100) / 100
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
const hoje = () => new Date().toISOString().split('T')[0]

function computeAnimalCom(
  a: Pick<LoteAnimalCom, 'desconto_pct' | 'preco_compra_kg' | 'peso_vivo_kg' | 'peso_morto_kg' | 'preco_venda_kg' | 'tipo_compra'>,
  lote: Lote
) {
  const precoCompra = a.preco_compra_kg ?? lote.preco_compra_kg ?? 0
  let custo: number | null = null
  let pesoDesc: number | null = null

  if (a.tipo_compra === 'morto') {
    // Compra no grampo: custo = peso morto × preço de compra (sem desconto)
    custo = a.peso_morto_kg != null && precoCompra ? r2(a.peso_morto_kg * precoCompra) : null
  } else {
    // Compra em peso vivo: custo = peso vivo × (1 − desconto%) × preço de compra
    const desc = a.desconto_pct ?? lote.desconto_pct ?? 0
    pesoDesc = a.peso_vivo_kg != null ? r2(a.peso_vivo_kg * (1 - desc / 100)) : null
    custo = pesoDesc != null && precoCompra ? r2(pesoDesc * precoCompra) : null
  }

  const venda = a.peso_morto_kg != null && a.preco_venda_kg != null
    ? r2(a.peso_morto_kg * a.preco_venda_kg) : null
  const lucro = custo != null && venda != null ? r2(venda - custo) : null
  return { pesoDesc, custo, venda, lucro }
}

function computeAnimalVenda(
  a: Pick<LoteVendaAnimal, 'desconto_pct' | 'peso_vivo_kg' | 'peso_morto_kg' | 'preco_venda_kg'>
) {
  const desc = a.desconto_pct ?? 0
  const pesoDesc = a.peso_vivo_kg != null ? r2(a.peso_vivo_kg * (1 - desc / 100)) : null
  const basePeso = a.peso_morto_kg ?? pesoDesc
  const venda = basePeso != null && a.preco_venda_kg != null
    ? r2(basePeso * a.preco_venda_kg) : null
  return { pesoDesc, venda }
}

const EMPTY_LOTE = {
  nome: '', tipo: 'recria', situacao: 'ativo', fazenda_id: '', data_criacao: hoje(),
}
const EMPTY_ANIMAL_COM = {
  identificacao: '', tipo_compra: 'vivo' as 'vivo' | 'morto',
  peso_vivo_kg: '', desconto_pct: '', preco_compra_kg: '',
  peso_morto_kg: '', preco_venda_kg: '',
}
const EMPTY_HEADER_COM = {
  data_compra: '', fornecedor: '', desconto_pct: '', preco_compra_kg: '',
  prazo_pagamento_dias: '', prazo_recebimento_dias: '', data_venda: '', comprador: '',
}
const EMPTY_DESPESA = { tipo: 'frete', descricao: '', valor: '' }

const CAT_COMPRA        = 'Compra — lote comercial'
const CAT_VENDA         = 'Venda — lote comercial'
const CAT_DESPESAS      = 'Despesas — lote comercial'
const CAT_VENDA_REBANHO = 'Venda — rebanho'

const EMPTY_VENDA_ANIMAL = {
  animal_id: '', peso_vivo_kg: '', desconto_pct: '', peso_morto_kg: '', preco_venda_kg: '',
}
const EMPTY_VENDA_HEADER = { data_venda: '', comprador: '', prazo_recebimento_dias: '' }

function TipoChip({ tipo }: { tipo: string | null }) {
  if (!tipo) return <span className="text-gray-400">—</span>
  const label = TIPO_LABEL[tipo] ?? tipo
  const color = TIPO_COLOR[tipo] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center h-[34px] px-3 rounded-full text-xs font-semibold ${color}`}>
      {label}
    </span>
  )
}

export default function LotesPage() {
  const [lotes, setLotes] = useState<Lote[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [loading, setLoading] = useState(true)
  const [situFiltro, setSituFiltro] = useState<'ativo' | 'encerrado' | ''>('ativo')

  const [selected, setSelected] = useState<Lote | null>(null)
  const [animais, setAnimais] = useState<Animal[]>([])
  const [animaisCom, setAnimaisCom] = useState<LoteAnimalCom[]>([])
  const [despesas, setDespesas] = useState<LoteDespesa[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [openNew, setOpenNew] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_LOTE })

  const [editingHeader, setEditingHeader] = useState(false)
  const [headerComForm, setHeaderComForm] = useState({ ...EMPTY_HEADER_COM })
  const [savingHeader, setSavingHeader] = useState(false)

  const [openAnimalCom, setOpenAnimalCom] = useState(false)
  const [animalComForm, setAnimalComForm] = useState({ ...EMPTY_ANIMAL_COM })
  const [editingAnimalComId, setEditingAnimalComId] = useState<string | null>(null)
  const [savingAnimalCom, setSavingAnimalCom] = useState(false)

  const [openDespesa, setOpenDespesa] = useState(false)
  const [despesaForm, setDespesaForm] = useState({ ...EMPTY_DESPESA })
  const [savingDespesa, setSavingDespesa] = useState(false)

  const [openLanc, setOpenLanc] = useState(false)
  const [savingLanc, setSavingLanc] = useState(false)
  const [lancForm, setLancForm] = useState({ tipo: 'saida', valor: '', descricao: '', categoria: '', data: hoje(), data_vencimento: '' })

  const [openAdd, setOpenAdd] = useState(false)
  const [addTab, setAddTab] = useState<'brinco' | 'avulso'>('brinco')
  const [addSearch, setAddSearch] = useState('')
  const [addCatFilter, setAddCatFilter] = useState('')
  const [availAnimais, setAvailAnimais] = useState<Animal[]>([])
  const [addIds, setAddIds] = useState<Set<string>>(new Set())
  const [savingAdd, setSavingAdd] = useState(false)
  const [loadingAvail, setLoadingAvail] = useState(false)
  const [avulsoQtd, setAvulsoQtd] = useState('')
  const [avulsoCat, setAvulsoCat] = useState('boi')
  const [avulsoValor, setAvulsoValor] = useState('')
  const [avulsoNome, setAvulsoNome] = useState('')
  const [avulsoData, setAvulsoData] = useState('')
  const [avulsoSexo, setAvulsoSexo] = useState('macho')
  const [avulsoOrigem, setAvulsoOrigem] = useState('compra')
  const [avulsoRaca, setAvulsoRaca] = useState('Nelore')
  const [avulsoMaeBrinco, setAvulsoMaeBrinco] = useState('')
  const [avulsoFornecedor, setAvulsoFornecedor] = useState('')
  const [avulsoPeso, setAvulsoPeso] = useState('')
  const [avulsoObs, setAvulsoObs] = useState('')

  const [vendaAnimais, setVendaAnimais] = useState<LoteVendaAnimal[]>([])
  const [openVendaAnimal, setOpenVendaAnimal] = useState(false)
  const [vendaAnimalForm, setVendaAnimalForm] = useState({ ...EMPTY_VENDA_ANIMAL })
  const [editingVendaAnimalId, setEditingVendaAnimalId] = useState<string | null>(null)
  const [savingVendaAnimal, setSavingVendaAnimal] = useState(false)
  const [editingVendaHeader, setEditingVendaHeader] = useState(false)
  const [vendaHeaderForm, setVendaHeaderForm] = useState({ ...EMPTY_VENDA_HEADER })
  const [savingVendaHeader, setSavingVendaHeader] = useState(false)
  const [concludingVenda, setConcludingVenda] = useState(false)

  async function load() {
    setLoading(true)
    const { data: faz } = await supabase.from('fazendas').select('id, nome').order('nome')
    setFazendas(faz ?? [])

    let q = supabase
      .from('lotes')
      .select(`id, fazenda_id, nome, tipo, situacao, data_criacao, descricao, observacao,
        data_compra, fornecedor, desconto_pct, preco_compra_kg, prazo_pagamento_dias,
        prazo_recebimento_dias, data_venda, comprador, pago, data_pago_efetivo,
        recebido, data_recebido_efetivo`)
      .order('nome')
    if (situFiltro) q = (q as any).eq('situacao', situFiltro)

    const { data } = await q
    if (!data) { setLoading(false); return }

    const ids = data.map((l: any) => l.id)
    let custos: Record<string, number> = {}
    let counts: Record<string, number> = {}
    if (ids.length > 0) {
      const [{ data: fin }, { data: an }, { data: anCom }] = await Promise.all([
        supabase.from('financeiro').select('lote_id, tipo, valor, animal_id').in('lote_id', ids),
        supabase.from('animais').select('id, lote_id, valor_compra').in('lote_id', ids).eq('status', 'ativo'),
        supabase.from('lote_animais_comerciais').select('lote_id').in('lote_id', ids),
      ])
      // Group financeiro by lote
      const finByLote: Record<string, { tipo: string; valor: number; animal_id: string | null }[]> = {}
      for (const f of fin ?? []) {
        if (!finByLote[f.lote_id]) finByLote[f.lote_id] = []
        finByLote[f.lote_id].push({ tipo: f.tipo, valor: Number(f.valor), animal_id: f.animal_id ?? null })
      }
      // Group animals by lote
      const anByLote: Record<string, { id: string; valor_compra: number | null }[]> = {}
      for (const a of an ?? []) {
        counts[a.lote_id] = (counts[a.lote_id] ?? 0) + 1
        if (!anByLote[a.lote_id]) anByLote[a.lote_id] = []
        anByLote[a.lote_id].push({ id: a.id, valor_compra: a.valor_compra ? Number(a.valor_compra) : null })
      }
      for (const a of anCom ?? []) {
        counts[a.lote_id] = (counts[a.lote_id] ?? 0) + 1
      }
      // Per-animal cost: for each animal, use its per-animal lancamento if present, else valor_compra
      const allLids = new Set([...Object.keys(finByLote), ...Object.keys(anByLote)])
      for (const lid of allLids) {
        const loteFinList = finByLote[lid] ?? []
        const loteAnimalList = anByLote[lid] ?? []
        const lancByAnimalId = new Map<string, number>()
        for (const f of loteFinList) {
          if (f.tipo === 'saida' && f.animal_id) {
            lancByAnimalId.set(f.animal_id, (lancByAnimalId.get(f.animal_id) ?? 0) + f.valor)
          }
        }
        custos[lid] = loteAnimalList.reduce((s, a) => {
          if (lancByAnimalId.has(a.id)) return s + lancByAnimalId.get(a.id)!
          return s + (a.valor_compra ?? 0)
        }, 0)
      }
    }

    setLotes(
      data.map((l: any) => ({
        id: l.id, fazenda_id: l.fazenda_id, nome: l.nome, tipo: l.tipo,
        situacao: l.situacao, data_criacao: l.data_criacao,
        descricao: l.descricao, observacao: l.observacao,
        total_animais: counts[l.id] ?? 0, custo_total: custos[l.id] ?? 0,
        data_compra: l.data_compra, fornecedor: l.fornecedor,
        desconto_pct: l.desconto_pct, preco_compra_kg: l.preco_compra_kg,
        prazo_pagamento_dias: l.prazo_pagamento_dias,
        prazo_recebimento_dias: l.prazo_recebimento_dias,
        data_venda: l.data_venda, comprador: l.comprador,
        pago: l.pago ?? false, data_pago_efetivo: l.data_pago_efetivo,
        recebido: l.recebido ?? false, data_recebido_efetivo: l.data_recebido_efetivo,
      }))
    )
    setLoading(false)
  }

  async function openDetail(lote: Lote) {
    setLoadingDetail(true)
    setSelected(lote)
    setAnimaisCom([])
    setDespesas([])
    setVendaAnimais([])
    setEditingHeader(false)
    setEditingVendaHeader(false)
    window.scrollTo(0, 0)

    const [{ data: an }, { data: fin }] = await Promise.all([
      supabase.from('animais').select('id, brinco, nome, categoria, sexo, raca, valor_compra')
        .eq('lote_id', lote.id).eq('status', 'ativo').order('brinco'),
      supabase.from('financeiro').select('id, descricao, tipo, valor, data, categoria, animal_id')
        .eq('lote_id', lote.id).order('data', { ascending: false }),
    ])
    setAnimais(an ?? [])
    setLancamentos(fin ?? [])

    if (lote.tipo === 'comercial') {
      const [{ data: ac }, { data: desp }] = await Promise.all([
        supabase.from('lote_animais_comerciais')
          .select('id, lote_id, identificacao, peso_vivo_kg, desconto_pct, preco_compra_kg, peso_morto_kg, preco_venda_kg, tipo_compra')
          .eq('lote_id', lote.id).order('created_at'),
        supabase.from('lote_despesas')
          .select('id, lote_id, tipo, descricao, valor')
          .eq('lote_id', lote.id).order('created_at'),
      ])
      const acList = (ac ?? []) as LoteAnimalCom[]
      const despList = (desp ?? []) as LoteDespesa[]
      setAnimaisCom(acList)
      setDespesas(despList)
      // sync inicial: garante registros no Financeiro ao abrir o lote
      syncLoteFinanceiro(lote, acList, despList)
    } else {
      // Lote de rebanho: carrega romaneio de venda
      const vaList = await loadVendaAnimaisInner(lote.id)
      setVendaAnimais(vaList)
    }

    setLoadingDetail(false)
  }

  async function loadAnimaisCom(loteId: string): Promise<LoteAnimalCom[]> {
    const { data } = await supabase
      .from('lote_animais_comerciais')
      .select('id, lote_id, identificacao, peso_vivo_kg, desconto_pct, preco_compra_kg, peso_morto_kg, preco_venda_kg, tipo_compra')
      .eq('lote_id', loteId).order('created_at')
    const list = (data ?? []) as LoteAnimalCom[]
    setAnimaisCom(list)
    return list
  }

  async function loadDespesas(loteId: string): Promise<LoteDespesa[]> {
    const { data } = await supabase.from('lote_despesas')
      .select('id, lote_id, tipo, descricao, valor')
      .eq('lote_id', loteId).order('created_at')
    const list = (data ?? []) as LoteDespesa[]
    setDespesas(list)
    return list
  }

  async function reloadLancamentos(loteId: string) {
    const { data } = await supabase
      .from('financeiro').select('id, descricao, tipo, valor, data, categoria')
      .eq('lote_id', loteId).order('data', { ascending: false })
    setLancamentos(data ?? [])
  }

  useEffect(() => { load() }, [situFiltro]) // eslint-disable-line react-hooks/exhaustive-deps

  function setF(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  function openNewDialog() {
    setForm({ ...EMPTY_LOTE, fazenda_id: fazendas[0]?.id ?? '' })
    setOpenNew(true)
  }

  function openEditDialog() {
    if (!selected) return
    setForm({
      nome: selected.nome,
      tipo: selected.tipo ?? 'recria',
      situacao: selected.situacao,
      fazenda_id: selected.fazenda_id ?? fazendas[0]?.id ?? '',
      data_criacao: selected.data_criacao ?? hoje(),
    })
    setOpenEdit(true)
  }

  function buildPayload(f: typeof form) {
    return {
      nome: f.nome.trim(),
      tipo: f.tipo || null,
      situacao: f.situacao,
      fazenda_id: f.fazenda_id || fazendas[0]?.id || null,
      data_criacao: f.data_criacao || hoje(),
    }
  }

  async function salvar() {
    if (!form.nome.trim()) { alert('Nome é obrigatório.'); return }
    setSaving(true)
    const { error } = await supabase.from('lotes').insert(buildPayload(form))
    if (!error) { setOpenNew(false); load() }
    else alert(`Erro: ${error.message}`)
    setSaving(false)
  }

  async function salvarEdit() {
    if (!selected || !form.nome.trim()) { alert('Nome é obrigatório.'); return }
    setSaving(true)
    const payload = buildPayload(form)
    const { error } = await supabase.from('lotes').update(payload).eq('id', selected.id)
    if (!error) {
      setSelected(prev => prev ? { ...prev, ...payload } : prev)
      setOpenEdit(false)
      load()
    } else {
      alert(`Erro: ${error.message}`)
    }
    setSaving(false)
  }

  function openHeaderEdit() {
    if (!selected) return
    setHeaderComForm({
      data_compra: selected.data_compra ?? '',
      fornecedor: selected.fornecedor ?? '',
      desconto_pct: selected.desconto_pct != null ? String(selected.desconto_pct) : '',
      preco_compra_kg: selected.preco_compra_kg != null ? String(selected.preco_compra_kg) : '',
      prazo_pagamento_dias: selected.prazo_pagamento_dias != null ? String(selected.prazo_pagamento_dias) : '',
      prazo_recebimento_dias: selected.prazo_recebimento_dias != null ? String(selected.prazo_recebimento_dias) : '',
      data_venda: selected.data_venda ?? '',
      comprador: selected.comprador ?? '',
    })
    setEditingHeader(true)
  }

  async function salvarHeader() {
    if (!selected) return
    setSavingHeader(true)
    const payload = {
      data_compra: headerComForm.data_compra || null,
      fornecedor: headerComForm.fornecedor.trim() || null,
      desconto_pct: headerComForm.desconto_pct ? parseFloat(headerComForm.desconto_pct) : null,
      preco_compra_kg: headerComForm.preco_compra_kg ? parseFloat(headerComForm.preco_compra_kg) : null,
      prazo_pagamento_dias: headerComForm.prazo_pagamento_dias ? parseInt(headerComForm.prazo_pagamento_dias) : null,
      prazo_recebimento_dias: headerComForm.prazo_recebimento_dias ? parseInt(headerComForm.prazo_recebimento_dias) : null,
      data_venda: headerComForm.data_venda || null,
      comprador: headerComForm.comprador.trim() || null,
    }
    const { error } = await supabase.from('lotes').update(payload).eq('id', selected.id)
    if (!error) {
      const updatedLote = { ...selected, ...payload }
      setSelected(updatedLote)
      setEditingHeader(false)
      load()
      await syncLoteFinanceiro(updatedLote, animaisCom, despesas)
    } else {
      alert(`Erro: ${error.message}`)
    }
    setSavingHeader(false)
  }

  function openNewAnimalCom() {
    setEditingAnimalComId(null)
    setAnimalComForm({ ...EMPTY_ANIMAL_COM })
    setOpenAnimalCom(true)
  }

  function openEditAnimalCom(a: LoteAnimalCom) {
    setEditingAnimalComId(a.id)
    setAnimalComForm({
      identificacao: a.identificacao ?? '',
      tipo_compra: a.tipo_compra ?? 'vivo',
      peso_vivo_kg: a.peso_vivo_kg != null ? String(a.peso_vivo_kg) : '',
      desconto_pct: a.desconto_pct != null ? String(a.desconto_pct) : '',
      preco_compra_kg: a.preco_compra_kg != null ? String(a.preco_compra_kg) : '',
      peso_morto_kg: a.peso_morto_kg != null ? String(a.peso_morto_kg) : '',
      preco_venda_kg: a.preco_venda_kg != null ? String(a.preco_venda_kg) : '',
    })
    setOpenAnimalCom(true)
  }

  async function salvarAnimalCom() {
    if (!selected) return
    setSavingAnimalCom(true)
    const row = {
      lote_id: selected.id,
      identificacao: animalComForm.identificacao.trim() || null,
      tipo_compra: animalComForm.tipo_compra,
      peso_vivo_kg: animalComForm.peso_vivo_kg ? parseFloat(animalComForm.peso_vivo_kg) : null,
      desconto_pct: animalComForm.desconto_pct ? parseFloat(animalComForm.desconto_pct) : null,
      preco_compra_kg: animalComForm.preco_compra_kg ? parseFloat(animalComForm.preco_compra_kg) : null,
      peso_morto_kg: animalComForm.peso_morto_kg ? parseFloat(animalComForm.peso_morto_kg) : null,
      preco_venda_kg: animalComForm.preco_venda_kg ? parseFloat(animalComForm.preco_venda_kg) : null,
    }
    let error
    if (editingAnimalComId) {
      ;({ error } = await supabase.from('lote_animais_comerciais').update(row).eq('id', editingAnimalComId))
    } else {
      ;({ error } = await supabase.from('lote_animais_comerciais').insert(row))
    }
    if (error) { alert(`Erro: ${error.message}`); setSavingAnimalCom(false); return }
    setOpenAnimalCom(false)
    setAnimalComForm({ ...EMPTY_ANIMAL_COM })
    setEditingAnimalComId(null)
    const freshAnimais = await loadAnimaisCom(selected.id)
    await syncLoteFinanceiro(selected, freshAnimais, despesas)
    setSavingAnimalCom(false)
  }

  async function excluirAnimalCom(id: string) {
    if (!confirm('Excluir este animal?')) return
    await supabase.from('lote_animais_comerciais').delete().eq('id', id)
    const freshAnimais = await loadAnimaisCom(selected!.id)
    await syncLoteFinanceiro(selected!, freshAnimais, despesas)
  }

  async function salvarDespesa() {
    if (!selected || !despesaForm.valor) { alert('Valor é obrigatório.'); return }
    setSavingDespesa(true)
    const { error } = await supabase.from('lote_despesas').insert({
      lote_id: selected.id,
      tipo: despesaForm.tipo,
      descricao: despesaForm.descricao.trim() || null,
      valor: parseFloat(despesaForm.valor.replace(',', '.')),
    })
    if (error) { alert(`Erro: ${error.message}`); setSavingDespesa(false); return }
    setOpenDespesa(false)
    setDespesaForm({ ...EMPTY_DESPESA })
    const freshDesp = await loadDespesas(selected.id)
    await syncLoteFinanceiro(selected, animaisCom, freshDesp)
    setSavingDespesa(false)
  }

  async function excluirDespesa(id: string) {
    if (!confirm('Excluir esta despesa?')) return
    await supabase.from('lote_despesas').delete().eq('id', id)
    const freshDesp = despesas.filter(d => d.id !== id)
    setDespesas(freshDesp)
    await syncLoteFinanceiro(selected!, animaisCom, freshDesp)
  }

  async function togglePago() {
    if (!selected) return
    const newVal = !selected.pago
    const update = { pago: newVal, data_pago_efetivo: newVal ? hoje() : null }
    await supabase.from('lotes').update(update).eq('id', selected.id)
    await supabase.from('financeiro')
      .update({ status: newVal ? 'pago' : 'pendente', data: newVal ? hoje() : (selected.data_compra ?? hoje()) })
      .eq('lote_id', selected.id).eq('categoria', CAT_COMPRA)
    setSelected(prev => prev ? { ...prev, ...update } : prev)
  }

  async function toggleRecebido() {
    if (!selected) return
    const newVal = !selected.recebido
    const update = { recebido: newVal, data_recebido_efetivo: newVal ? hoje() : null }
    await supabase.from('lotes').update(update).eq('id', selected.id)
    const cat = selected.tipo === 'comercial' ? CAT_VENDA : CAT_VENDA_REBANHO
    await supabase.from('financeiro')
      .update({ status: newVal ? 'recebido' : 'pendente', data: newVal ? hoje() : (selected.data_venda ?? hoje()) })
      .eq('lote_id', selected.id).eq('categoria', cat)
    setSelected(prev => prev ? { ...prev, ...update } : prev)
  }

  async function refreshAnimais(loteId: string) {
    const { data } = await supabase
      .from('animais').select('id, brinco, nome, categoria, sexo, raca')
      .eq('lote_id', loteId).eq('status', 'ativo').order('brinco')
    setAnimais(data ?? [])
  }

  async function loadAvailAnimais(search: string, cat: string) {
    setLoadingAvail(true)
    let q = supabase.from('animais').select('id, brinco, nome, categoria, sexo, raca')
      .eq('status', 'ativo').order('brinco').limit(60)
    if (search) q = q.ilike('brinco', `%${search}%`)
    if (cat) q = q.eq('categoria', cat)
    const { data } = await q
    setAvailAnimais(data ?? [])
    setLoadingAvail(false)
  }

  async function handleAddAnimais() {
    if (!selected || addIds.size === 0) return
    setSavingAdd(true)
    await supabase.from('animais').update({ lote_id: selected.id } as any).in('id', [...addIds])
    setSavingAdd(false)
    setOpenAdd(false)
    setAddIds(new Set())
    await refreshAnimais(selected.id)
    load()
  }

  async function handleAddAvulso() {
    if (!selected || !avulsoQtd) return
    const qtd = parseInt(avulsoQtd)
    if (isNaN(qtd) || qtd <= 0) { alert('Informe uma quantidade válida.'); return }
    setSavingAdd(true)

    const { data: existing } = await supabase.from('animais').select('brinco').ilike('brinco', 'S/N-%')
    const maxNum = (existing ?? []).reduce((max, a) => {
      const n = parseInt((a.brinco as string).replace('S/N-', ''))
      return isNaN(n) ? max : Math.max(max, n)
    }, 0)

    let maeId: string | null = null
    if (avulsoOrigem === 'nascimento' && avulsoMaeBrinco.trim()) {
      const { data: maeData } = await supabase.from('animais').select('id').ilike('brinco', avulsoMaeBrinco.trim()).single()
      if (maeData) maeId = maeData.id
    }

    const dataNasc = avulsoData || new Date().toISOString().split('T')[0]
    const valorUnit = avulsoOrigem === 'compra' && avulsoValor ? parseFloat(avulsoValor.replace(',', '.')) : null
    const pesoKg = avulsoPeso ? parseFloat(avulsoPeso.replace(',', '.')) : null

    const animals = Array.from({ length: qtd }, (_, i) => ({
      brinco: `S/N-${String(maxNum + i + 1).padStart(4, '0')}`,
      nome: avulsoNome.trim() || null,
      data_nascimento: dataNasc,
      sexo: avulsoSexo,
      categoria: avulsoCat,
      raca: avulsoRaca,
      origem: avulsoOrigem,
      status: 'ativo',
      lote_id: selected.id,
      fazenda_id: selected.fazenda_id,
      valor_compra: valorUnit,
      fornecedor: avulsoOrigem === 'compra' && avulsoFornecedor.trim() ? avulsoFornecedor.trim() : null,
      mae_id: maeId,
      observacao: avulsoObs.trim() || null,
    }))

    const { data: inserted, error } = await supabase.from('animais').insert(animals as any).select('id')
    if (error) { alert(`Erro: ${error.message}`); setSavingAdd(false); return }

    if (pesoKg && inserted && inserted.length > 0) {
      const pesagemRows = (inserted as { id: string }[]).map(a => ({
        animal_id: a.id,
        fazenda_id: selected.fazenda_id,
        data: dataNasc,
        peso_kg: pesoKg,
      }))
      await supabase.from('pesagens').insert(pesagemRows as any)
    }

    if (avulsoOrigem === 'compra' && valorUnit && inserted && inserted.length > 0) {
      const venc = new Date(dataNasc)
      venc.setDate(venc.getDate() + 30)
      const vencStr = venc.toISOString().split('T')[0]
      const fornDesc = avulsoFornecedor.trim()
      const finRows = (inserted as { id: string }[]).map(a => ({
        fazenda_id: selected.fazenda_id,
        tipo: 'saida',
        categoria: 'Compra de animal',
        valor: valorUnit,
        data: dataNasc,
        descricao: fornDesc ? `Compra — ${fornDesc}` : 'Compra de animal',
        status: 'pendente',
        data_vencimento: vencStr,
        animal_id: a.id,
        lote_id: selected.id,
      }))
      await supabase.from('financeiro').insert(finRows as any)
    }

    setSavingAdd(false)
    setOpenAdd(false)
    setAvulsoQtd('')
    setAvulsoNome('')
    setAvulsoData('')
    setAvulsoSexo('macho')
    setAvulsoCat('boi')
    setAvulsoOrigem('compra')
    setAvulsoRaca('Nelore')
    setAvulsoValor('')
    setAvulsoMaeBrinco('')
    setAvulsoFornecedor('')
    setAvulsoPeso('')
    setAvulsoObs('')
    await refreshAnimais(selected.id)
    load()
  }

  async function handleRemoverAnimal(animalId: string) {
    if (!confirm('Remover este animal do lote?')) return
    await supabase.from('animais').update({ lote_id: null } as any).eq('id', animalId)
    setAnimais(prev => prev.filter(a => a.id !== animalId))
    load()
  }

  async function loadVendaAnimaisInner(loteId: string): Promise<LoteVendaAnimal[]> {
    const { data } = await supabase
      .from('lote_venda_animais')
      .select('id, lote_id, animal_id, peso_vivo_kg, desconto_pct, peso_morto_kg, preco_venda_kg, animais(brinco, nome)')
      .eq('lote_id', loteId).order('created_at')
    return ((data ?? []) as any[]).map(r => ({
      id: r.id, lote_id: r.lote_id, animal_id: r.animal_id,
      brinco: r.animais?.brinco ?? '—', nome: r.animais?.nome ?? null,
      peso_vivo_kg: r.peso_vivo_kg, desconto_pct: r.desconto_pct,
      peso_morto_kg: r.peso_morto_kg, preco_venda_kg: r.preco_venda_kg,
    })) as LoteVendaAnimal[]
  }

  async function loadVendaAnimais(loteId: string): Promise<LoteVendaAnimal[]> {
    const list = await loadVendaAnimaisInner(loteId)
    setVendaAnimais(list)
    return list
  }

  async function syncVendaFinanceiro(lote: Lote, vAnimais: LoteVendaAnimal[]) {
    if (!lote.fazenda_id) return
    const addDays = (date: string | null, days: number | null): string | null => {
      if (!date || days == null) return null
      const d = new Date(date); d.setDate(d.getDate() + days)
      return d.toISOString().split('T')[0]
    }
    const totVenda = r2(vAnimais.reduce((s, a) => s + (computeAnimalVenda(a).venda ?? 0), 0))
    const vencVenda = addDays(lote.data_venda, lote.prazo_recebimento_dias)

    const upsertFin = async (categoria: string, payload: Record<string, unknown>) => {
      const { data: ex } = await supabase.from('financeiro')
        .select('id').eq('lote_id', lote.id).eq('categoria', categoria).maybeSingle()
      if (ex) {
        await supabase.from('financeiro').update(payload).eq('id', ex.id)
      } else {
        await supabase.from('financeiro').insert({ ...payload, fazenda_id: lote.fazenda_id, lote_id: lote.id, categoria })
      }
    }
    const deleteFin = async (categoria: string) => {
      await supabase.from('financeiro').delete().eq('lote_id', lote.id).eq('categoria', categoria)
    }

    if (totVenda > 0) {
      await upsertFin(CAT_VENDA_REBANHO, {
        tipo: 'entrada', valor: totVenda,
        data: lote.data_venda ?? hoje(),
        descricao: lote.comprador ? `Venda — ${lote.comprador}` : CAT_VENDA_REBANHO,
        status: lote.recebido ? 'recebido' : 'pendente',
        data_vencimento: vencVenda,
      })
    } else {
      await deleteFin(CAT_VENDA_REBANHO)
    }
    await reloadLancamentos(lote.id)
  }

  function openVendaHeaderEdit() {
    if (!selected) return
    setVendaHeaderForm({
      data_venda: selected.data_venda ?? '',
      comprador: selected.comprador ?? '',
      prazo_recebimento_dias: selected.prazo_recebimento_dias != null ? String(selected.prazo_recebimento_dias) : '',
    })
    setEditingVendaHeader(true)
  }

  async function salvarVendaHeader() {
    if (!selected) return
    setSavingVendaHeader(true)
    const payload = {
      data_venda: vendaHeaderForm.data_venda || null,
      comprador: vendaHeaderForm.comprador.trim() || null,
      prazo_recebimento_dias: vendaHeaderForm.prazo_recebimento_dias ? parseInt(vendaHeaderForm.prazo_recebimento_dias) : null,
    }
    const { error } = await supabase.from('lotes').update(payload).eq('id', selected.id)
    if (!error) {
      const updatedLote = { ...selected, ...payload }
      setSelected(updatedLote)
      setEditingVendaHeader(false)
      load()
      await syncVendaFinanceiro(updatedLote, vendaAnimais)
    } else {
      alert(`Erro: ${error.message}`)
    }
    setSavingVendaHeader(false)
  }

  function openNewVendaAnimal() {
    setEditingVendaAnimalId(null)
    setVendaAnimalForm({ ...EMPTY_VENDA_ANIMAL })
    setOpenVendaAnimal(true)
  }

  function openEditVendaAnimal(a: LoteVendaAnimal) {
    setEditingVendaAnimalId(a.id)
    setVendaAnimalForm({
      animal_id: a.animal_id,
      peso_vivo_kg: a.peso_vivo_kg != null ? String(a.peso_vivo_kg) : '',
      desconto_pct: a.desconto_pct != null ? String(a.desconto_pct) : '',
      peso_morto_kg: a.peso_morto_kg != null ? String(a.peso_morto_kg) : '',
      preco_venda_kg: a.preco_venda_kg != null ? String(a.preco_venda_kg) : '',
    })
    setOpenVendaAnimal(true)
  }

  async function salvarVendaAnimal() {
    if (!selected || !vendaAnimalForm.animal_id) { alert('Selecione um animal.'); return }
    setSavingVendaAnimal(true)
    const row = {
      lote_id: selected.id,
      animal_id: vendaAnimalForm.animal_id,
      peso_vivo_kg: vendaAnimalForm.peso_vivo_kg ? parseFloat(vendaAnimalForm.peso_vivo_kg) : null,
      desconto_pct: vendaAnimalForm.desconto_pct ? parseFloat(vendaAnimalForm.desconto_pct) : null,
      peso_morto_kg: vendaAnimalForm.peso_morto_kg ? parseFloat(vendaAnimalForm.peso_morto_kg) : null,
      preco_venda_kg: vendaAnimalForm.preco_venda_kg ? parseFloat(vendaAnimalForm.preco_venda_kg) : null,
    }
    let error
    if (editingVendaAnimalId) {
      ;({ error } = await supabase.from('lote_venda_animais').update(row).eq('id', editingVendaAnimalId))
    } else {
      ;({ error } = await supabase.from('lote_venda_animais').insert(row))
    }
    if (error) { alert(`Erro: ${error.message}`); setSavingVendaAnimal(false); return }
    setOpenVendaAnimal(false)
    setVendaAnimalForm({ ...EMPTY_VENDA_ANIMAL })
    setEditingVendaAnimalId(null)
    const freshVenda = await loadVendaAnimais(selected.id)
    await syncVendaFinanceiro(selected, freshVenda)
    setSavingVendaAnimal(false)
  }

  async function excluirVendaAnimal(id: string) {
    if (!confirm('Excluir este animal do romaneio?')) return
    await supabase.from('lote_venda_animais').delete().eq('id', id)
    const freshVenda = await loadVendaAnimais(selected!.id)
    await syncVendaFinanceiro(selected!, freshVenda)
  }

  async function concluirVenda() {
    if (!selected || vendaAnimais.length === 0) return
    if (!confirm(`Confirmar venda de ${vendaAnimais.length} animal(is)?\n\nEles serão marcados como "vendidos" no rebanho e deixarão de contar nos indicadores.`)) return
    setConcludingVenda(true)
    const ids = vendaAnimais.map(a => a.animal_id)
    await supabase.from('animais').update({ status: 'vendido' } as any).in('id', ids)
    await refreshAnimais(selected.id)
    load()
    setConcludingVenda(false)
  }

  function gerarRelatorioVenda() {
    if (!selected || vendaAnimais.length === 0) return
    const lote = selected
    const prazo = lote.prazo_recebimento_dias
    const dataVenc = lote.data_venda && prazo != null ? (() => {
      const d = new Date(lote.data_venda!)
      d.setDate(d.getDate() + prazo)
      return d.toISOString().split('T')[0]
    })() : null

    const fmtN = (v: number | null) =>
      v != null ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
    const fmtC = (v: number | null) =>
      v != null ? 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'

    const rows = vendaAnimais.map(a => {
      const calc = computeAnimalVenda(a)
      return {
        brinco: a.brinco,
        pesoVivo: a.peso_vivo_kg,
        desconto: a.desconto_pct ?? 0,
        pesoDesc: a.peso_morto_kg != null ? a.peso_morto_kg : calc.pesoDesc,
        pesoMorto: a.peso_morto_kg,
        precoKg: a.preco_venda_kg ?? 0,
        valor: calc.venda,
      }
    })

    const totalAnimais = rows.length
    const totalPesoVivo = rows.reduce((s, r) => s + (r.pesoVivo ?? 0), 0)
    const totalPesoDesc = rows.reduce((s, r) => s + (r.pesoDesc ?? 0), 0)
    const totalValor = rows.reduce((s, r) => s + (r.valor ?? 0), 0)

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Romaneio — ${lote.nome}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 20mm 15mm; }
  h1 { font-size: 17px; margin: 0 0 3px; }
  .sub { color: #555; font-size: 11px; margin-bottom: 18px; }
  .info { display: grid; grid-template-columns: max-content 1fr; gap: 3px 14px; margin-bottom: 20px; }
  .lbl { color: #666; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f2f2f2; text-align: left; padding: 5px 7px; border-bottom: 1px solid #bbb; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; }
  td { padding: 5px 7px; border-bottom: 1px solid #eee; }
  .r { text-align: right; }
  .tot td { font-weight: bold; border-top: 2px solid #333; border-bottom: none; background: #f8f8f8; }
  .footer { margin-top: 14px; font-size: 11px; color: #444; line-height: 1.6; }
  @media print { body { margin: 0; padding: 12mm 14mm; } }
</style>
</head>
<body>
<h1>${lote.nome}</h1>
<div class="sub">Romaneio de Venda</div>
<div class="info">
  <span class="lbl">Data da venda:</span><span>${fmtDate(lote.data_venda)}</span>
  <span class="lbl">Comprador:</span><span>${lote.comprador || '—'}</span>
</div>
<table>
  <thead>
    <tr>
      <th>Brinco</th>
      <th class="r">Peso vivo (kg)</th>
      <th class="r">Desc. (%)</th>
      <th class="r">Peso c/ desc. (kg)</th>
      <th class="r">Peso morto (kg)</th>
      <th class="r">R$/kg</th>
      <th class="r">Valor (R$)</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map(r => `<tr>
      <td>${r.brinco}</td>
      <td class="r">${r.pesoVivo != null ? r.pesoVivo.toLocaleString('pt-BR') : '—'}</td>
      <td class="r">${r.desconto ? r.desconto + '%' : '—'}</td>
      <td class="r">${fmtN(r.pesoDesc)}</td>
      <td class="r">${r.pesoMorto != null ? fmtN(r.pesoMorto) : '—'}</td>
      <td class="r">${fmtN(r.precoKg)}</td>
      <td class="r">${fmtC(r.valor)}</td>
    </tr>`).join('')}
    <tr class="tot">
      <td>Total (${totalAnimais} cab.)</td>
      <td class="r">${fmtN(totalPesoVivo)}</td>
      <td></td>
      <td class="r">${fmtN(totalPesoDesc)}</td>
      <td></td>
      <td></td>
      <td class="r">${fmtC(totalValor)}</td>
    </tr>
  </tbody>
</table>
<div class="footer">
  ${prazo != null ? `Prazo de recebimento: ${prazo} dias${dataVenc ? ' — vencimento: ' + fmtDate(dataVenc) : ''}` : ''}
</div>
</body>
</html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  async function excluirLote() {
    if (!selected) return
    if (!confirm(`Excluir "${selected.nome}"? Os animais do rebanho ficam sem lote e os dados financeiros vinculados serão removidos.`)) return
    const lid = selected.id
    await Promise.all([
      supabase.from('animais').update({ lote_id: null } as any).eq('lote_id', lid),
      supabase.from('lote_animais_comerciais').delete().eq('lote_id', lid),
      supabase.from('lote_despesas').delete().eq('lote_id', lid),
      supabase.from('financeiro').delete().eq('lote_id', lid),
    ])
    const { error } = await supabase.from('lotes').delete().eq('id', lid)
    if (error) { alert(`Erro ao excluir: ${error.message}`); return }
    setSelected(null)
    load()
  }

  async function salvarLanc() {
    if (!selected || !lancForm.valor) { alert('Valor é obrigatório.'); return }
    setSavingLanc(true)
    const cat = lancForm.categoria.trim() || (lancForm.tipo === 'saida' ? 'Compra' : 'Venda')
    const desc = lancForm.descricao.trim() || cat
    const { error } = await supabase.from('financeiro').insert({
      lote_id: selected.id,
      fazenda_id: selected.fazenda_id,
      tipo: lancForm.tipo,
      valor: parseFloat(lancForm.valor.replace(',', '.')),
      data: lancForm.data || hoje(),
      descricao: desc,
      categoria: cat,
      status: 'pendente',
      data_vencimento: lancForm.data_vencimento || null,
    })
    if (!error) {
      setOpenLanc(false)
      setLancForm({ tipo: 'saida', valor: '', descricao: '', categoria: '', data: hoje(), data_vencimento: '' })
      await reloadLancamentos(selected.id)
      load()
    } else {
      alert(`Erro: ${error.message}`)
    }
    setSavingLanc(false)
  }

  async function syncLoteFinanceiro(lote: Lote, animals: LoteAnimalCom[], despList: LoteDespesa[]) {
    if (!lote.fazenda_id) return
    const addDays = (date: string | null, days: number | null): string | null => {
      if (!date || days == null) return null
      const d = new Date(date); d.setDate(d.getDate() + days)
      return d.toISOString().split('T')[0]
    }
    const totCusto = r2(animals.reduce((s, a) => s + (computeAnimalCom(a, lote).custo ?? 0), 0))
    const totVenda = r2(animals.reduce((s, a) => s + (computeAnimalCom(a, lote).venda ?? 0), 0))
    const totDesp  = r2(despList.reduce((s, d) => s + Number(d.valor), 0))
    const vencCompra = addDays(lote.data_compra, lote.prazo_pagamento_dias)
    const vencVenda  = addDays(lote.data_venda, lote.prazo_recebimento_dias)
    const faz = lote.fazenda_id

    // helper: upsert by (lote_id, categoria)
    const upsertFin = async (categoria: string, payload: Record<string, unknown>) => {
      const { data: ex } = await supabase.from('financeiro')
        .select('id').eq('lote_id', lote.id).eq('categoria', categoria).maybeSingle()
      if (ex) {
        await supabase.from('financeiro').update(payload).eq('id', ex.id)
      } else {
        await supabase.from('financeiro').insert({ ...payload, fazenda_id: faz, lote_id: lote.id, categoria })
      }
    }
    const deleteFin = async (categoria: string) => {
      await supabase.from('financeiro').delete().eq('lote_id', lote.id).eq('categoria', categoria)
    }

    // Conta a pagar — compra
    if (totCusto > 0) {
      await upsertFin(CAT_COMPRA, {
        tipo: 'saida', valor: totCusto,
        data: lote.data_compra ?? hoje(),
        descricao: lote.fornecedor ? `Compra — ${lote.fornecedor}` : CAT_COMPRA,
        status: lote.pago ? 'pago' : 'pendente',
        data_vencimento: vencCompra,
      })
    } else {
      await deleteFin(CAT_COMPRA)
    }

    // Conta a receber — venda
    if (totVenda > 0) {
      await upsertFin(CAT_VENDA, {
        tipo: 'entrada', valor: totVenda,
        data: lote.data_venda ?? hoje(),
        descricao: lote.comprador ? `Venda — ${lote.comprador}` : CAT_VENDA,
        status: lote.recebido ? 'recebido' : 'pendente',
        data_vencimento: vencVenda,
      })
    } else {
      await deleteFin(CAT_VENDA)
    }

    // Despesas — conta a pagar agregada
    if (totDesp > 0) {
      await upsertFin(CAT_DESPESAS, {
        tipo: 'saida', valor: totDesp,
        data: lote.data_compra ?? hoje(),
        descricao: CAT_DESPESAS,
        status: 'pendente',
        data_vencimento: vencCompra,
      })
    } else {
      await deleteFin(CAT_DESPESAS)
    }

    await reloadLancamentos(lote.id)
  }

  function gerarRelatorio() {
    if (!selected) return
    const lote = selected
    const prazo = lote.prazo_pagamento_dias
    const dataVenc = lote.data_compra && prazo != null ? (() => {
      const d = new Date(lote.data_compra!)
      d.setDate(d.getDate() + prazo)
      return d.toISOString().split('T')[0]
    })() : null

    const fmtN = (v: number | null) =>
      v != null ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
    const fmtC = (v: number | null) =>
      v != null ? 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'

    const rows = animaisCom.map(a => {
      const isMorto = a.tipo_compra === 'morto'
      const calc = computeAnimalCom(a, lote)
      const precoEfetivo = a.preco_compra_kg ?? lote.preco_compra_kg ?? 0
      const descEfetivo = isMorto ? null : (a.desconto_pct ?? lote.desconto_pct ?? 0)
      return {
        identificacao: a.identificacao ?? '—',
        tipo: isMorto ? 'Grampo' : 'Vivo',
        peso: isMorto ? a.peso_morto_kg : a.peso_vivo_kg,
        desconto: descEfetivo,
        pesoDesc: isMorto ? a.peso_morto_kg : calc.pesoDesc,
        precoKg: precoEfetivo,
        valor: calc.custo,
      }
    })

    const totalAnimais = rows.length
    const totalPeso = rows.reduce((s, r) => s + (r.peso ?? 0), 0)
    const totalPesoDesc = rows.reduce((s, r) => s + (r.pesoDesc ?? 0), 0)
    const totalValor = rows.reduce((s, r) => s + (r.valor ?? 0), 0)

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório — ${lote.nome}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 20mm 15mm; }
  h1 { font-size: 17px; margin: 0 0 3px; }
  .sub { color: #555; font-size: 11px; margin-bottom: 18px; }
  .info { display: grid; grid-template-columns: max-content 1fr; gap: 3px 14px; margin-bottom: 20px; }
  .lbl { color: #666; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f2f2f2; text-align: left; padding: 5px 7px; border-bottom: 1px solid #bbb; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; }
  td { padding: 5px 7px; border-bottom: 1px solid #eee; }
  .r { text-align: right; }
  .tot td { font-weight: bold; border-top: 2px solid #333; border-bottom: none; background: #f8f8f8; }
  .footer { margin-top: 14px; font-size: 11px; color: #444; line-height: 1.6; }
  @media print { body { margin: 0; padding: 12mm 14mm; } }
</style>
</head>
<body>
<h1>${lote.nome}</h1>
<div class="sub">Relatório de Compra</div>
<div class="info">
  <span class="lbl">Data da compra:</span><span>${fmtDate(lote.data_compra)}</span>
  <span class="lbl">Fornecedor:</span><span>${lote.fornecedor || '—'}</span>
</div>
<table>
  <thead>
    <tr>
      <th>Identificação</th>
      <th>Tipo</th>
      <th class="r">Peso (kg)</th>
      <th class="r">Desc. (%)</th>
      <th class="r">Peso c/ desc. (kg)</th>
      <th class="r">R$/kg</th>
      <th class="r">Valor (R$)</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map(r => `<tr>
      <td>${r.identificacao}</td>
      <td>${r.tipo}</td>
      <td class="r">${r.peso != null ? r.peso.toLocaleString('pt-BR') : '—'}</td>
      <td class="r">${r.desconto != null ? r.desconto + '%' : '—'}</td>
      <td class="r">${fmtN(r.pesoDesc)}</td>
      <td class="r">${fmtN(r.precoKg)}</td>
      <td class="r">${fmtC(r.valor)}</td>
    </tr>`).join('')}
    <tr class="tot">
      <td>Total (${totalAnimais} cab.)</td>
      <td></td>
      <td class="r">${fmtN(totalPeso)}</td>
      <td></td>
      <td class="r">${fmtN(totalPesoDesc)}</td>
      <td></td>
      <td class="r">${fmtC(totalValor)}</td>
    </tr>
  </tbody>
</table>
<div class="footer">
  ${prazo != null ? `Prazo de pagamento: ${prazo} dias${dataVenc ? ' — vencimento: ' + fmtDate(dataVenc) : ''}` : ''}
</div>
</body>
</html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  // ── DETALHE ──
  if (selected) {
    const lancByAnimalId = new Map<string, number>()
    for (const l of lancamentos) {
      if (l.tipo === 'saida' && l.animal_id) {
        lancByAnimalId.set(l.animal_id, (lancByAnimalId.get(l.animal_id) ?? 0) + Number(l.valor))
      }
    }
    const custosTotal = animais.reduce((s, a) => {
      if (lancByAnimalId.has(a.id)) return s + lancByAnimalId.get(a.id)!
      return s + (a.valor_compra ? Number(a.valor_compra) : 0)
    }, 0)
    const custoPorCabeca = animais.length > 0 ? custosTotal / animais.length : null

    const totCusto = animaisCom.reduce((s, a) => s + (computeAnimalCom(a, selected).custo ?? 0), 0)
    const totVenda = animaisCom.reduce((s, a) => s + (computeAnimalCom(a, selected).venda ?? 0), 0)
    const totDespesas = despesas.reduce((s, d) => s + Number(d.valor), 0)
    const totLucro = r2(totVenda - totCusto - totDespesas)
    const totVendaRebanho = r2(vendaAnimais.reduce((s, a) => s + (computeAnimalVenda(a).venda ?? 0), 0))
    const totPesoVendaRebanho = r2(vendaAnimais.reduce((s, a) => {
      const calc = computeAnimalVenda(a)
      return s + (a.peso_morto_kg ?? calc.pesoDesc ?? 0)
    }, 0))

    const isCom = selected.tipo === 'comercial'

    return (
      <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => setSelected(null)}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 leading-tight">{selected.nome}</h1>
            <p className="text-xs text-gray-500">Criado em {fmtDate(selected.data_criacao)}</p>
          </div>
          {selected.tipo && <TipoChip tipo={selected.tipo} />}
          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
            selected.situacao === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {selected.situacao === 'ativo' ? 'Ativo' : 'Encerrado'}
          </span>
          <button
            onClick={openEditDialog}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 shrink-0"
          >
            <Pencil size={16} />
          </button>
        </div>

        {loadingDetail && <p className="text-sm text-gray-400 text-center py-12">Carregando...</p>}

        {!loadingDetail && (
          <>
            {/* Resumo */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Resumo</p>
              <div className="space-y-2">
                {isCom ? (
                  <>
                    <div className="flex justify-between items-baseline gap-3">
                      <span className="text-sm text-gray-500 shrink-0">Animais no lote</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {animaisCom.length > 0 ? `${animaisCom.length} cab.` : '—'}
                      </span>
                    </div>
                    {totCusto > 0 && (
                      <div className="flex justify-between items-baseline gap-3">
                        <span className="text-sm text-gray-500 shrink-0">Custo animais</span>
                        <span className="text-sm font-semibold text-red-600">{fmt(totCusto)}</span>
                      </div>
                    )}
                    {totDespesas > 0 && (
                      <div className="flex justify-between items-baseline gap-3">
                        <span className="text-sm text-gray-500 shrink-0">Despesas</span>
                        <span className="text-sm font-semibold text-red-600">{fmt(totDespesas)}</span>
                      </div>
                    )}
                    {totVenda > 0 && (
                      <div className="flex justify-between items-baseline gap-3">
                        <span className="text-sm text-gray-500 shrink-0">Venda total</span>
                        <span className="text-sm font-semibold text-green-700">{fmt(totVenda)}</span>
                      </div>
                    )}
                    {(totCusto > 0 || totVenda > 0) && (
                      <div className="flex justify-between items-baseline gap-3">
                        <span className="text-sm text-gray-500 shrink-0">Lucro</span>
                        <span className={`text-sm font-bold ${totLucro >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {totLucro >= 0 ? '+' : ''}{fmt(totLucro)}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-baseline gap-3">
                      <span className="text-sm text-gray-500 shrink-0">Animais no lote</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {animais.length > 0 ? `${animais.length} cab.` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline gap-3">
                      <span className="text-sm text-gray-500 shrink-0">Custo total</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {custosTotal > 0 ? fmt(custosTotal) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline gap-3">
                      <span className="text-sm text-gray-500 shrink-0">Custo / cabeça</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {custoPorCabeca != null ? fmt(custoPorCabeca) : '—'}
                      </span>
                    </div>
                    {vendaAnimais.length > 0 && (
                      <div className="flex justify-between items-baseline gap-3">
                        <span className="text-sm text-gray-500 shrink-0">Romaneio venda</span>
                        <span className="text-sm font-semibold text-green-700">
                          {vendaAnimais.length} cab. · {fmt(totVendaRebanho)}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {selected.descricao && (
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="text-sm text-gray-500 shrink-0">Descrição</span>
                    <span className="text-sm text-gray-800 text-right">{selected.descricao}</span>
                  </div>
                )}
                {selected.observacao && (
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="text-sm text-gray-500 shrink-0">Observação</span>
                    <span className="text-sm text-gray-800 text-right">{selected.observacao}</span>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button onClick={excluirLote} className="text-xs text-red-400 hover:text-red-600 transition-colors">
                  Excluir lote
                </button>
              </div>
            </div>

            {/* ── COMERCIAL sections ── */}
            {isCom && (
              <>
                {/* Cabeçalho */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Cabeçalho</p>
                    {!editingHeader && (
                      <button onClick={openHeaderEdit} className="p-1.5 text-gray-300 hover:text-gray-600 transition-colors">
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>

                  {!editingHeader ? (
                    <div className="space-y-2">
                      {([
                        ['Data compra', fmtDate(selected.data_compra)],
                        ['Fornecedor', selected.fornecedor || '—'],
                        ['Desconto', selected.desconto_pct != null ? `${selected.desconto_pct}%` : '—'],
                        ['Preço compra', selected.preco_compra_kg != null ? `R$ ${selected.preco_compra_kg}/kg` : '—'],
                        ['Prazo pagamento', selected.prazo_pagamento_dias != null ? `${selected.prazo_pagamento_dias} dias` : '—'],
                        ['Prazo recebimento', selected.prazo_recebimento_dias != null ? `${selected.prazo_recebimento_dias} dias` : '—'],
                        ['Data venda', fmtDate(selected.data_venda)],
                        ['Comprador', selected.comprador || '—'],
                      ] as [string, string][]).map(([label, value]) => (
                        <div key={label} className="flex justify-between items-baseline gap-3">
                          <span className="text-sm text-gray-500 shrink-0">{label}</span>
                          <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Data compra</label>
                          <Input type="date" value={headerComForm.data_compra}
                            onChange={e => setHeaderComForm(p => ({ ...p, data_compra: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Data venda</label>
                          <Input type="date" value={headerComForm.data_venda}
                            onChange={e => setHeaderComForm(p => ({ ...p, data_venda: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Fornecedor</label>
                        <Input placeholder="Nome do fornecedor" value={headerComForm.fornecedor}
                          onChange={e => setHeaderComForm(p => ({ ...p, fornecedor: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Desconto (%)</label>
                          <Input placeholder="0" inputMode="decimal" value={headerComForm.desconto_pct}
                            onChange={e => setHeaderComForm(p => ({ ...p, desconto_pct: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Preço compra (R$/kg)</label>
                          <Input placeholder="0.00" inputMode="decimal" value={headerComForm.preco_compra_kg}
                            onChange={e => setHeaderComForm(p => ({ ...p, preco_compra_kg: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Prazo pagto. (dias)</label>
                          <Input placeholder="30" inputMode="numeric" value={headerComForm.prazo_pagamento_dias}
                            onChange={e => setHeaderComForm(p => ({ ...p, prazo_pagamento_dias: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Prazo receb. (dias)</label>
                          <Input placeholder="30" inputMode="numeric" value={headerComForm.prazo_recebimento_dias}
                            onChange={e => setHeaderComForm(p => ({ ...p, prazo_recebimento_dias: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Comprador</label>
                        <Input placeholder="Nome do comprador" value={headerComForm.comprador}
                          onChange={e => setHeaderComForm(p => ({ ...p, comprador: e.target.value }))} />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" className="flex-1" onClick={() => setEditingHeader(false)}>Cancelar</Button>
                        <Button className="flex-1 bg-green-700 hover:bg-green-800" onClick={salvarHeader} disabled={savingHeader}>
                          {savingHeader ? 'Salvando...' : 'Salvar'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Animais Comerciais */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                      Animais {animaisCom.length > 0 ? `(${animaisCom.length})` : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      {animaisCom.length > 0 && (
                        <button
                          onClick={gerarRelatorio}
                          className="flex items-center gap-1 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
                        >
                          <FileText size={12} /> PDF
                        </button>
                      )}
                      <button
                        onClick={openNewAnimalCom}
                        className="flex items-center gap-1 text-xs font-semibold text-green-700 border border-green-200 rounded-lg px-2.5 py-1.5 hover:bg-green-50 transition-colors"
                      >
                        <Plus size={12} /> Adicionar
                      </button>
                    </div>
                  </div>
                  {animaisCom.length === 0 && (
                    <p className="text-sm text-gray-400">Nenhum animal neste lote.</p>
                  )}
                  {animaisCom.map((a, i) => {
                    const calc = computeAnimalCom(a, selected)
                    const isMorto = a.tipo_compra === 'morto'
                    return (
                      <div key={a.id} className={`flex items-center gap-2 py-2.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{a.identificacao || '—'}</p>
                          <p className="text-xs text-gray-400">
                            {isMorto
                              ? `${a.peso_morto_kg != null ? `${a.peso_morto_kg} kg` : '—'} (grampo)`
                              : `${calc.pesoDesc != null ? `${calc.pesoDesc} kg` : '—'}${a.peso_morto_kg != null ? ` → ${a.peso_morto_kg} kg` : ''}`
                            }
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {calc.lucro != null && (
                            <p className={`text-sm font-semibold ${calc.lucro >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                              {calc.lucro >= 0 ? '+' : ''}{fmt(calc.lucro)}
                            </p>
                          )}
                          {calc.venda != null && (
                            <p className="text-xs text-gray-400">{fmt(calc.venda)}</p>
                          )}
                        </div>
                        <button onClick={() => openEditAnimalCom(a)}
                          className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors shrink-0">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => excluirAnimalCom(a.id)}
                          className="p-1.5 text-gray-300 hover:text-red-400 transition-colors shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Despesas */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                      Despesas {despesas.length > 0 ? `(${despesas.length})` : ''}
                    </p>
                    <button
                      onClick={() => { setDespesaForm({ ...EMPTY_DESPESA }); setOpenDespesa(true) }}
                      className="flex items-center gap-1 text-xs font-semibold text-green-700 border border-green-200 rounded-lg px-2.5 py-1.5 hover:bg-green-50 transition-colors"
                    >
                      <Plus size={12} /> Despesa
                    </button>
                  </div>
                  {despesas.length === 0 && (
                    <p className="text-sm text-gray-400">Nenhuma despesa lançada.</p>
                  )}
                  {despesas.map((d, i) => (
                    <div key={d.id} className={`flex items-center gap-2 py-2.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{DESPESA_LABEL[d.tipo] ?? d.tipo}</p>
                        {d.descricao && <p className="text-xs text-gray-400 truncate">{d.descricao}</p>}
                      </div>
                      <span className="text-sm font-semibold text-red-600 shrink-0">{fmt(Number(d.valor))}</span>
                      <button onClick={() => excluirDespesa(d.id)}
                        className="p-1.5 text-gray-300 hover:text-red-400 transition-colors shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Totais */}
                {animaisCom.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Totais</p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline gap-3">
                        <span className="text-sm text-gray-500">Qtd. animais</span>
                        <span className="text-sm font-semibold text-gray-900">{animaisCom.length} cab.</span>
                      </div>
                      <div className="flex justify-between items-baseline gap-3">
                        <span className="text-sm text-gray-500">Custo animais</span>
                        <span className="text-sm font-semibold text-red-600">{fmt(totCusto)}</span>
                      </div>
                      {totDespesas > 0 && (
                        <div className="flex justify-between items-baseline gap-3">
                          <span className="text-sm text-gray-500">Despesas</span>
                          <span className="text-sm font-semibold text-red-600">{fmt(totDespesas)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-baseline gap-3">
                        <span className="text-sm text-gray-500">Venda total</span>
                        <span className="text-sm font-semibold text-green-700">{fmt(totVenda)}</span>
                      </div>
                      <div className="flex justify-between items-baseline gap-3 pt-2 border-t border-gray-100">
                        <span className="text-sm font-semibold text-gray-700">Lucro</span>
                        <span className={`text-sm font-bold ${totLucro >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {totLucro >= 0 ? '+' : ''}{fmt(totLucro)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status financeiro */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Status financeiro</p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={togglePago}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                        selected.pago ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="text-left">
                        <p className={`text-sm font-semibold ${selected.pago ? 'text-green-700' : 'text-gray-600'}`}>
                          {selected.pago ? 'Pago' : 'Pendente pagamento'}
                        </p>
                        {selected.data_pago_efetivo && (
                          <p className="text-xs text-gray-400">em {fmtDate(selected.data_pago_efetivo)}</p>
                        )}
                        {!selected.pago && selected.prazo_pagamento_dias != null && selected.data_compra && (() => {
                          const d = new Date(selected.data_compra)
                          d.setDate(d.getDate() + selected.prazo_pagamento_dias)
                          return <p className="text-xs text-gray-400">vence {fmtDate(d.toISOString().split('T')[0])}</p>
                        })()}
                      </div>
                      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selected.pago ? 'bg-green-600 border-green-600' : 'border-gray-300'
                      }`}>
                        {selected.pago && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                      </span>
                    </button>

                    <button
                      onClick={toggleRecebido}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                        selected.recebido ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="text-left">
                        <p className={`text-sm font-semibold ${selected.recebido ? 'text-green-700' : 'text-gray-600'}`}>
                          {selected.recebido ? 'Recebido' : 'Pendente recebimento'}
                        </p>
                        {selected.data_recebido_efetivo && (
                          <p className="text-xs text-gray-400">em {fmtDate(selected.data_recebido_efetivo)}</p>
                        )}
                        {!selected.recebido && selected.prazo_recebimento_dias != null && selected.data_venda && (() => {
                          const d = new Date(selected.data_venda)
                          d.setDate(d.getDate() + selected.prazo_recebimento_dias)
                          return <p className="text-xs text-gray-400">vence {fmtDate(d.toISOString().split('T')[0])}</p>
                        })()}
                      </div>
                      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selected.recebido ? 'bg-green-600 border-green-600' : 'border-gray-300'
                      }`}>
                        {selected.recebido && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Animais rebanho — somente para lotes não-comerciais */}
            {!isCom && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    Animais {animais.length > 0 ? `(${animais.length})` : ''}
                  </p>
                  <button
                    onClick={() => {
                      setAddSearch(''); setAddCatFilter(''); setAvailAnimais([]); setAddIds(new Set())
                      setAddTab('brinco'); setAvulsoQtd(''); setAvulsoNome(''); setAvulsoData(''); setAvulsoSexo('macho'); setAvulsoCat('boi'); setAvulsoOrigem('compra'); setAvulsoRaca('Nelore'); setAvulsoValor(''); setAvulsoMaeBrinco(''); setAvulsoFornecedor(''); setAvulsoPeso(''); setAvulsoObs(''); setOpenAdd(true); loadAvailAnimais('', '')
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-green-700 border border-green-200 rounded-lg px-2.5 py-1.5 hover:bg-green-50 transition-colors"
                  >
                    <Plus size={12} /> Adicionar
                  </button>
                </div>
                {animais.length === 0 && (
                  <p className="text-sm text-gray-400">Nenhum animal neste lote.</p>
                )}
                {animais.map((a, i) => (
                  <div key={a.id} className={`flex items-center gap-3 ${i > 0 ? 'pt-3 mt-3 border-t border-gray-100' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900">{a.brinco}</p>
                      {a.nome && <p className="text-xs text-gray-500">{a.nome}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className="text-xs text-gray-500">{CAT_LABEL[a.categoria] ?? a.categoria}</span>
                      <span className="text-xs text-gray-400">{a.sexo === 'femea' ? 'Fêmea' : 'Macho'}</span>
                      <span className="text-xs text-gray-400">{a.raca}</span>
                      <button onClick={() => handleRemoverAnimal(a.id)} title="Remover do lote"
                        className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── ROMANEIO DE VENDA (lotes de rebanho) ── */}
            {!isCom && (
              <>
                {/* Cabeçalho da venda */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Venda</p>
                    {!editingVendaHeader && (
                      <button onClick={openVendaHeaderEdit} className="p-1.5 text-gray-300 hover:text-gray-600 transition-colors">
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                  {!editingVendaHeader ? (
                    <div className="space-y-2">
                      {([
                        ['Data venda', fmtDate(selected.data_venda)],
                        ['Comprador', selected.comprador || '—'],
                        ['Prazo recebimento', selected.prazo_recebimento_dias != null ? `${selected.prazo_recebimento_dias} dias` : '—'],
                      ] as [string, string][]).map(([label, value]) => (
                        <div key={label} className="flex justify-between items-baseline gap-3">
                          <span className="text-sm text-gray-500 shrink-0">{label}</span>
                          <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Data venda</label>
                          <Input type="date" value={vendaHeaderForm.data_venda}
                            onChange={e => setVendaHeaderForm(p => ({ ...p, data_venda: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Prazo receb. (dias)</label>
                          <Input placeholder="30" inputMode="numeric" value={vendaHeaderForm.prazo_recebimento_dias}
                            onChange={e => setVendaHeaderForm(p => ({ ...p, prazo_recebimento_dias: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Comprador</label>
                        <Input placeholder="Nome do comprador" value={vendaHeaderForm.comprador}
                          onChange={e => setVendaHeaderForm(p => ({ ...p, comprador: e.target.value }))} />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" className="flex-1" onClick={() => setEditingVendaHeader(false)}>Cancelar</Button>
                        <Button className="flex-1 bg-green-700 hover:bg-green-800" onClick={salvarVendaHeader} disabled={savingVendaHeader}>
                          {savingVendaHeader ? 'Salvando...' : 'Salvar'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Animais do romaneio */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                      Romaneio {vendaAnimais.length > 0 ? `(${vendaAnimais.length})` : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      {vendaAnimais.length > 0 && (
                        <button
                          onClick={gerarRelatorioVenda}
                          className="flex items-center gap-1 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
                        >
                          <FileText size={12} /> PDF
                        </button>
                      )}
                      {animais.length > 0 && (
                        <button
                          onClick={openNewVendaAnimal}
                          className="flex items-center gap-1 text-xs font-semibold text-green-700 border border-green-200 rounded-lg px-2.5 py-1.5 hover:bg-green-50 transition-colors"
                        >
                          <Plus size={12} /> Animal
                        </button>
                      )}
                    </div>
                  </div>
                  {vendaAnimais.length === 0 && (
                    <p className="text-sm text-gray-400">Nenhum animal no romaneio.</p>
                  )}
                  {vendaAnimais.map((a, i) => {
                    const calc = computeAnimalVenda(a)
                    const basePeso = a.peso_morto_kg ?? calc.pesoDesc
                    return (
                      <div key={a.id} className={`flex items-center gap-2 py-2.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{a.brinco}</p>
                          <p className="text-xs text-gray-400">
                            {a.peso_vivo_kg != null ? `${a.peso_vivo_kg} kg vivo` : ''}
                            {a.desconto_pct ? ` · ${a.desconto_pct}% desc` : ''}
                            {basePeso != null ? ` · ${basePeso} kg base` : ''}
                            {a.peso_morto_kg != null ? ' (grampo)' : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {calc.venda != null && (
                            <p className="text-sm font-semibold text-green-700">{fmt(calc.venda)}</p>
                          )}
                          {a.preco_venda_kg != null && (
                            <p className="text-xs text-gray-400">R$ {a.preco_venda_kg}/kg</p>
                          )}
                        </div>
                        <button onClick={() => openEditVendaAnimal(a)}
                          className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors shrink-0">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => excluirVendaAnimal(a.id)}
                          className="p-1.5 text-gray-300 hover:text-red-400 transition-colors shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                    )
                  })}
                  {/* Totais do romaneio */}
                  {vendaAnimais.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Qtd</span>
                        <span className="font-semibold text-gray-900">{vendaAnimais.length} cab.</span>
                      </div>
                      {totPesoVendaRebanho > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Peso total</span>
                          <span className="font-semibold text-gray-900">{totPesoVendaRebanho.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-gray-700">Valor total</span>
                        <span className="font-bold text-green-700">{fmt(totVendaRebanho)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Concluir venda + Status recebimento */}
                {vendaAnimais.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Status financeiro</p>
                    <div className="flex flex-col gap-3">
                      {/* Botão concluir venda */}
                      {animais.some(a => vendaAnimais.some(v => v.animal_id === a.id)) && (
                        <button
                          onClick={concluirVenda}
                          disabled={concludingVenda}
                          className="flex items-center justify-between px-4 py-3 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors"
                        >
                          <div className="text-left">
                            <p className="text-sm font-semibold text-orange-700">
                              {concludingVenda ? 'Processando...' : 'Concluir venda'}
                            </p>
                            <p className="text-xs text-orange-500">Marca os animais como vendidos no rebanho</p>
                          </div>
                          <span className="text-orange-400 text-lg leading-none">→</span>
                        </button>
                      )}
                      {/* Toggle recebido */}
                      <button
                        onClick={toggleRecebido}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                          selected.recebido ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="text-left">
                          <p className={`text-sm font-semibold ${selected.recebido ? 'text-green-700' : 'text-gray-600'}`}>
                            {selected.recebido ? 'Recebido' : 'Pendente recebimento'}
                          </p>
                          {selected.data_recebido_efetivo && (
                            <p className="text-xs text-gray-400">em {fmtDate(selected.data_recebido_efetivo)}</p>
                          )}
                          {!selected.recebido && selected.prazo_recebimento_dias != null && selected.data_venda && (() => {
                            const d = new Date(selected.data_venda)
                            d.setDate(d.getDate() + selected.prazo_recebimento_dias)
                            return <p className="text-xs text-gray-400">vence {fmtDate(d.toISOString().split('T')[0])}</p>
                          })()}
                        </div>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selected.recebido ? 'bg-green-600 border-green-600' : 'border-gray-300'
                        }`}>
                          {selected.recebido && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Histórico financeiro */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Histórico financeiro</p>
                <button
                  onClick={() => { setLancForm({ tipo: 'saida', valor: '', descricao: '', categoria: '', data: hoje(), data_vencimento: '' }); setOpenLanc(true) }}
                  className="flex items-center gap-1 text-xs font-semibold text-green-700 border border-green-200 rounded-lg px-2.5 py-1.5 hover:bg-green-50 transition-colors"
                >
                  <Plus size={12} /> Lançamento
                </button>
              </div>
              {lancamentos.length === 0 && (
                <p className="text-sm text-gray-400">Nenhum lançamento vinculado.</p>
              )}
              {lancamentos.map((l, i) => (
                <div key={l.id} className={`flex items-start gap-3 ${i > 0 ? 'pt-3 mt-3 border-t border-gray-100' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{l.descricao || l.categoria || '—'}</p>
                    <p className="text-xs text-gray-400">{fmtDate(l.data)}</p>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${l.tipo === 'saida' ? 'text-red-600' : 'text-green-700'}`}>
                    {l.tipo === 'saida' ? '− ' : '+ '}{fmt(Number(l.valor))}
                  </span>
                </div>
              ))}
              {lancamentos.length > 0 && custosTotal > 0 && (
                <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">Total custos</span>
                  <span className="text-sm font-bold text-red-600">{fmt(custosTotal)}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Dialog: Animal do romaneio de venda */}
        <Dialog open={openVendaAnimal} onOpenChange={setOpenVendaAnimal}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingVendaAnimalId ? 'Editar animal — romaneio' : 'Adicionar ao romaneio'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {!editingVendaAnimalId && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Animal (brinco)</label>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {animais.filter(a => !vendaAnimais.some(v => v.animal_id === a.id)).length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">Todos os animais já estão no romaneio.</p>
                    )}
                    {animais.filter(a => !vendaAnimais.some(v => v.animal_id === a.id)).map((a, i, arr) => (
                      <label key={a.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                        <input type="radio" name="venda_animal" value={a.id}
                          checked={vendaAnimalForm.animal_id === a.id}
                          onChange={() => setVendaAnimalForm(p => ({ ...p, animal_id: a.id }))}
                          className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{a.brinco}</p>
                          <p className="text-xs text-gray-500">{CAT_LABEL[a.categoria] ?? a.categoria}{a.nome ? ` · ${a.nome}` : ''}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {editingVendaAnimalId && (
                <p className="text-sm font-semibold text-gray-700">
                  {vendaAnimais.find(v => v.id === editingVendaAnimalId)?.brinco}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Peso vivo (kg)</label>
                  <Input placeholder="0" inputMode="decimal" value={vendaAnimalForm.peso_vivo_kg}
                    onChange={e => setVendaAnimalForm(p => ({ ...p, peso_vivo_kg: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Desconto (%)</label>
                  <Input placeholder="0" inputMode="decimal" value={vendaAnimalForm.desconto_pct}
                    onChange={e => setVendaAnimalForm(p => ({ ...p, desconto_pct: e.target.value }))} />
                </div>
              </div>
              {/* Preview peso com desconto */}
              {vendaAnimalForm.peso_vivo_kg && (
                <p className="text-xs text-gray-400">
                  Peso c/ desc:{' '}
                  {r2(parseFloat(vendaAnimalForm.peso_vivo_kg || '0') * (1 - parseFloat(vendaAnimalForm.desconto_pct || '0') / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Peso morto / grampo (kg)</label>
                  <Input placeholder="0" inputMode="decimal" value={vendaAnimalForm.peso_morto_kg}
                    onChange={e => setVendaAnimalForm(p => ({ ...p, peso_morto_kg: e.target.value }))} />
                  <p className="text-xs text-gray-400 mt-0.5">Se preenchido, usada como base do valor</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Preço venda (R$/kg)</label>
                  <Input placeholder="0.00" inputMode="decimal" value={vendaAnimalForm.preco_venda_kg}
                    onChange={e => setVendaAnimalForm(p => ({ ...p, preco_venda_kg: e.target.value }))} />
                </div>
              </div>
              {/* Preview valor */}
              {vendaAnimalForm.preco_venda_kg && (vendaAnimalForm.peso_morto_kg || vendaAnimalForm.peso_vivo_kg) && (() => {
                const desc = parseFloat(vendaAnimalForm.desconto_pct || '0')
                const pesoVivo = parseFloat(vendaAnimalForm.peso_vivo_kg || '0')
                const pesoMorto = vendaAnimalForm.peso_morto_kg ? parseFloat(vendaAnimalForm.peso_morto_kg) : null
                const basePeso = pesoMorto ?? r2(pesoVivo * (1 - desc / 100))
                const valor = r2(basePeso * parseFloat(vendaAnimalForm.preco_venda_kg))
                return (
                  <p className="text-sm font-semibold text-green-700">
                    Valor: {fmt(valor)}
                  </p>
                )
              })()}
              <Button className="w-full bg-green-700 hover:bg-green-800" onClick={salvarVendaAnimal} disabled={savingVendaAnimal}>
                {savingVendaAnimal ? 'Salvando...' : editingVendaAnimalId ? 'Salvar alterações' : 'Adicionar ao romaneio'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Adicionar animais (rebanho) */}
        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogContent className="max-h-[85vh] overflow-y-auto w-full max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar ao lote — {selected?.nome}</DialogTitle>
            </DialogHeader>
            <div className="pt-1 space-y-3">
              {/* Tab toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button className={`flex-1 py-2 text-xs font-semibold transition-colors ${addTab === 'brinco' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => setAddTab('brinco')}>Por brinco</button>
                <button className={`flex-1 py-2 text-xs font-semibold transition-colors ${addTab === 'avulso' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => setAddTab('avulso')}>Sem brinco (novo)</button>
              </div>

              {addTab === 'brinco' && (<>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input placeholder="Buscar brinco..." className="pl-9" value={addSearch}
                    onChange={e => { setAddSearch(e.target.value); loadAvailAnimais(e.target.value, addCatFilter) }} />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(['', 'matriz', 'bezerro', 'novilha', 'touro', 'boi'] as const).map(c => (
                    <button key={c} onClick={() => { setAddCatFilter(c); loadAvailAnimais(addSearch, c) }}
                      className={`h-[34px] px-3 rounded-full text-xs font-semibold transition-colors ${addCatFilter === c ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {c ? (CAT_LABEL[c] ?? c) : 'Todos'}
                    </button>
                  ))}
                </div>
                {loadingAvail && <p className="text-xs text-gray-400 text-center py-4">Carregando...</p>}
                {!loadingAvail && availAnimais.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Nenhum animal encontrado.</p>
                )}
                {!loadingAvail && availAnimais.length > 0 && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    {availAnimais.map((a, i) => {
                      const jaNoLote = animais.some(x => x.id === a.id)
                      return (
                        <label key={a.id}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 ${i > 0 ? 'border-t border-gray-100' : ''} ${jaNoLote ? 'opacity-40' : ''}`}>
                          <input type="checkbox" checked={addIds.has(a.id) || jaNoLote} disabled={jaNoLote}
                            onChange={e => setAddIds(prev => {
                              const next = new Set(prev)
                              e.target.checked ? next.add(a.id) : next.delete(a.id)
                              return next
                            })} className="rounded border-gray-300 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{a.brinco}</p>
                            <p className="text-xs text-gray-500">
                              {CAT_LABEL[a.categoria] ?? a.categoria} · {a.sexo === 'femea' ? 'Fêmea' : 'Macho'}
                              {jaNoLote && ' · já neste lote'}
                            </p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setOpenAdd(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-green-700 hover:bg-green-800" onClick={handleAddAnimais}
                    disabled={savingAdd || addIds.size === 0}>
                    {savingAdd ? 'Adicionando...' : `Adicionar${addIds.size > 0 ? ` (${addIds.size})` : ''}`}
                  </Button>
                </div>
              </>)}

              {addTab === 'avulso' && (<>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Cria animais sem brinco (identificados como S/N-XXXX). Atribua o brinco depois na ficha de cada animal.
                </p>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Quantidade <span className="text-red-500">*</span></label>
                  <Input type="number" min="1" placeholder="Ex: 5" value={avulsoQtd}
                    onChange={e => setAvulsoQtd(e.target.value)} />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Categoria</label>
                  <div className="flex gap-2 flex-wrap">
                    {AVULSO_CATS.map(c => (
                      <button key={c} onClick={() => { setAvulsoCat(c); setAvulsoSexo(CAT_SEXO_DEFAULT[c] ?? 'macho') }}
                        className={`h-[34px] px-3 rounded-full text-xs font-semibold transition-colors ${avulsoCat === c ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {CAT_LABEL[c] ?? c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Sexo</label>
                  <div className="flex gap-2">
                    {(['macho', 'femea'] as const).map(s => (
                      <button key={s} onClick={() => setAvulsoSexo(s)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${avulsoSexo === s ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {s === 'macho' ? 'Macho' : 'Fêmea'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Origem</label>
                  <div className="flex gap-2">
                    {(['compra', 'nascimento'] as const).map(o => (
                      <button key={o} onClick={() => setAvulsoOrigem(o)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${avulsoOrigem === o ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {o === 'compra' ? 'Compra' : 'Nascimento'}
                      </button>
                    ))}
                  </div>
                </div>

                {avulsoOrigem === 'nascimento' && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Mãe <span className="text-gray-400 font-normal">(brinco, opcional)</span></label>
                    <Input placeholder="Ex: 44" value={avulsoMaeBrinco}
                      onChange={e => setAvulsoMaeBrinco(e.target.value.toUpperCase())} />
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    {avulsoOrigem === 'compra' ? 'Data de compra' : 'Data de nascimento'}
                  </label>
                  <Input type="date" value={avulsoData}
                    onChange={e => setAvulsoData(e.target.value)} />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Nome <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <Input placeholder="Ex: Princesa" value={avulsoNome}
                    onChange={e => setAvulsoNome(e.target.value)} />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Raça</label>
                  <div className="flex gap-2 flex-wrap">
                    {DEFAULT_RACAS.map(r => (
                      <button key={r} onClick={() => setAvulsoRaca(r)}
                        className={`h-[34px] px-3 rounded-full text-xs font-semibold transition-colors ${avulsoRaca === r ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {avulsoOrigem === 'compra' && (<>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Valor de compra por animal (R$)</label>
                    <Input placeholder="Ex: 2800,00" inputMode="decimal" value={avulsoValor}
                      onChange={e => setAvulsoValor(e.target.value)} />
                    <p className="text-xs text-gray-400 mt-1">Entra no custo do lote.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Fornecedor</label>
                    <Input placeholder="Nome do fornecedor" value={avulsoFornecedor}
                      onChange={e => setAvulsoFornecedor(e.target.value)} />
                  </div>
                </>)}

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Peso (kg) <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <Input placeholder="Ex: 320" inputMode="decimal" value={avulsoPeso}
                    onChange={e => setAvulsoPeso(e.target.value)} />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Observações</label>
                  <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                    rows={2} placeholder="Anotações..." value={avulsoObs}
                    onChange={e => setAvulsoObs(e.target.value)} />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setOpenAdd(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-green-700 hover:bg-green-800" onClick={handleAddAvulso}
                    disabled={savingAdd || !avulsoQtd || parseInt(avulsoQtd) <= 0}>
                    {savingAdd ? 'Criando...' : `Criar${avulsoQtd && parseInt(avulsoQtd) > 0 ? ` (${avulsoQtd})` : ''}`}
                  </Button>
                </div>
              </>)}
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Animal comercial */}
        <Dialog open={openAnimalCom} onOpenChange={setOpenAnimalCom}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAnimalComId ? 'Editar animal' : 'Adicionar animal'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Identificação</label>
                <Input placeholder="Ex: FÊMEA, MACHO, FÊMEA-BOA..." value={animalComForm.identificacao}
                  onChange={e => setAnimalComForm(p => ({ ...p, identificacao: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Tipo de compra</label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setAnimalComForm(p => ({ ...p, tipo_compra: 'vivo' }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${animalComForm.tipo_compra === 'vivo' ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    Peso vivo
                  </button>
                  <button type="button"
                    onClick={() => setAnimalComForm(p => ({ ...p, tipo_compra: 'morto' }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${animalComForm.tipo_compra === 'morto' ? 'bg-orange-600 text-white border-orange-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    No grampo
                  </button>
                </div>
                {animalComForm.tipo_compra === 'morto' && (
                  <p className="text-xs text-gray-400 mt-1">Custo = peso morto × preço de compra (sem desconto)</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={animalComForm.tipo_compra === 'morto' ? 'opacity-60' : ''}>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Peso vivo (kg){animalComForm.tipo_compra === 'morto' ? ' — opcional' : ''}
                  </label>
                  <Input placeholder="0" inputMode="decimal" value={animalComForm.peso_vivo_kg}
                    onChange={e => setAnimalComForm(p => ({ ...p, peso_vivo_kg: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Peso morto (kg)</label>
                  <Input placeholder="0" inputMode="decimal" value={animalComForm.peso_morto_kg}
                    onChange={e => setAnimalComForm(p => ({ ...p, peso_morto_kg: e.target.value }))} />
                </div>
              </div>
              {animalComForm.tipo_compra === 'vivo' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Desconto (%)</label>
                    <Input
                      placeholder={selected?.desconto_pct != null ? `${selected.desconto_pct} (padrão)` : '0'}
                      inputMode="decimal" value={animalComForm.desconto_pct}
                      onChange={e => setAnimalComForm(p => ({ ...p, desconto_pct: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Preço venda (R$/kg)</label>
                    <Input placeholder="0.00" inputMode="decimal" value={animalComForm.preco_venda_kg}
                      onChange={e => setAnimalComForm(p => ({ ...p, preco_venda_kg: e.target.value }))} />
                  </div>
                </div>
              )}
              {animalComForm.tipo_compra === 'morto' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Preço venda (R$/kg)</label>
                  <Input placeholder="0.00" inputMode="decimal" value={animalComForm.preco_venda_kg}
                    onChange={e => setAnimalComForm(p => ({ ...p, preco_venda_kg: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Preço compra (R$/kg)</label>
                <Input
                  placeholder={selected?.preco_compra_kg != null ? `${selected.preco_compra_kg} (padrão)` : '0'}
                  inputMode="decimal" value={animalComForm.preco_compra_kg}
                  onChange={e => setAnimalComForm(p => ({ ...p, preco_compra_kg: e.target.value }))} />
              </div>
              <Button className="w-full bg-green-700 hover:bg-green-800" onClick={salvarAnimalCom} disabled={savingAnimalCom}>
                {savingAnimalCom ? 'Salvando...' : editingAnimalComId ? 'Salvar alterações' : 'Adicionar animal'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Nova despesa */}
        <Dialog open={openDespesa} onOpenChange={setOpenDespesa}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova despesa — {selected?.nome}</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Tipo</label>
                <div className="flex gap-2 flex-wrap">
                  {(['frete', 'comissao', 'outros'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setDespesaForm(p => ({ ...p, tipo: t }))}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${despesaForm.tipo === t ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                      {DESPESA_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Descrição</label>
                <Input placeholder="Opcional..." value={despesaForm.descricao}
                  onChange={e => setDespesaForm(p => ({ ...p, descricao: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Valor (R$)</label>
                <Input placeholder="0,00" inputMode="decimal" value={despesaForm.valor}
                  onChange={e => setDespesaForm(p => ({ ...p, valor: e.target.value }))} />
              </div>
              <Button className="w-full bg-green-700 hover:bg-green-800" onClick={salvarDespesa} disabled={savingDespesa}>
                {savingDespesa ? 'Salvando...' : 'Salvar despesa'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Novo lançamento */}
        <Dialog open={openLanc} onOpenChange={setOpenLanc}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo lançamento — {selected?.nome}</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Tipo</label>
                <div className="flex gap-2">
                  {(['saida', 'entrada'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setLancForm(p => ({ ...p, tipo: t }))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${lancForm.tipo === t ? (t === 'saida' ? 'bg-red-600 text-white border-red-600' : 'bg-green-700 text-white border-green-700') : 'border-gray-200 text-gray-600'}`}>
                      {t === 'saida' ? 'Saída (custo)' : 'Entrada (receita)'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Valor (R$)</label>
                <Input placeholder="0,00" inputMode="decimal" value={lancForm.valor}
                  onChange={e => setLancForm(p => ({ ...p, valor: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Data</label>
                <Input type="date" value={lancForm.data}
                  onChange={e => setLancForm(p => ({ ...p, data: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Descrição</label>
                <Input placeholder="Ex: Frete, Ração, Vacina..." value={lancForm.descricao}
                  onChange={e => setLancForm(p => ({ ...p, descricao: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Categoria</label>
                <Input placeholder="Ex: Frete, Ração, Vacina..." value={lancForm.categoria}
                  onChange={e => setLancForm(p => ({ ...p, categoria: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Vencimento</label>
                <Input type="date" value={lancForm.data_vencimento}
                  onChange={e => setLancForm(p => ({ ...p, data_vencimento: e.target.value }))} />
              </div>
              <Button className="w-full bg-green-700 hover:bg-green-800" onClick={salvarLanc} disabled={savingLanc}>
                {savingLanc ? 'Salvando...' : 'Salvar lançamento'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Editar lote */}
        <Dialog open={openEdit} onOpenChange={setOpenEdit}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Editar Lote</DialogTitle></DialogHeader>
            <LoteForm form={form} setF={setF} fazendas={fazendas} saving={saving} onSave={salvarEdit} label="Salvar alterações" />
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ── LISTA ──
  const ativos     = lotes.filter(l => l.situacao === 'ativo').length
  const encerrados = lotes.filter(l => l.situacao !== 'ativo').length

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-bold text-xl text-gray-900">Lotes</h1>
          <p className="text-sm text-gray-400">Gestão de lotes do rebanho</p>
        </div>
        <button
          onClick={openNewDialog}
          className="flex items-center gap-1.5 bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded-xl hover:bg-green-800 transition-colors shrink-0"
        >
          <Plus size={16} /> Novo
        </button>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {([['', `Todos (${ativos + encerrados})`], ['ativo', `Ativos (${ativos})`], ['encerrado', `Encerrados (${encerrados})`]] as const).map(([val, label]) => (
          <button key={val} onClick={() => setSituFiltro(val)}
            className={`h-[34px] shrink-0 px-3 rounded-full text-xs font-semibold transition-colors ${
              situFiltro === val ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-gray-400 py-12">Carregando...</p>}

      {!loading && lotes.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base font-medium mb-1">Nenhum lote encontrado</p>
          <p className="text-sm">Crie o primeiro lote para organizar o rebanho.</p>
        </div>
      )}

      {!loading && lotes.length > 0 && (
        <div className="space-y-3">
          {lotes.map(l => (
            <button key={l.id} onClick={() => openDetail(l)}
              className="w-full text-left bg-white rounded-2xl border border-gray-200 p-4 hover:border-green-300 hover:shadow-sm transition-all active:scale-[0.99]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{l.nome}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Criado em {fmtDate(l.data_criacao)}</p>
                </div>
                {l.tipo && <TipoChip tipo={l.tipo} />}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-gray-600">
                  {(l.total_animais ?? 0) > 0 ? `${l.total_animais} cab.` : '— animais'}
                </span>
                {(l.custo_total ?? 0) > 0 && (
                  <span className="text-red-500 font-medium">custo: {fmt(l.custo_total!)}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Lote</DialogTitle></DialogHeader>
          <LoteForm form={form} setF={setF} fazendas={fazendas} saving={saving} onSave={salvar} label="Criar Lote" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LoteForm({
  form, setF, fazendas, saving, onSave, label,
}: {
  form: Record<string, any>
  setF: (k: string, v: any) => void
  fazendas: Fazenda[]
  saving: boolean
  onSave: () => void
  label: string
}) {
  return (
    <div className="space-y-3 pt-2">
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Nome do lote</label>
        <Input placeholder="Ex: Lote Recria, Engorda, Gado do Cícero..."
          value={form.nome} onChange={e => setF('nome', e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Tipo</label>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map(t => (
            <button key={t} type="button" onClick={() => setF('tipo', t)}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${form.tipo === t ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
              {TIPO_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Situação</label>
        <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={form.situacao} onChange={e => setF('situacao', e.target.value)}>
          <option value="ativo">Ativo</option>
          <option value="encerrado">Encerrado</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Data de criação</label>
        <Input type="date" value={form.data_criacao} onChange={e => setF('data_criacao', e.target.value)} />
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
