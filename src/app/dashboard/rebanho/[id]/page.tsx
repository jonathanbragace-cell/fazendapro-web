'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Pencil } from 'lucide-react'

const supabase = createClient()

type Animal = {
  id: string; fazenda_id: string; brinco: string; nome?: string | null
  data_nascimento: string; sexo: string; raca: string; categoria: string
  origem: string; status: string; marcacao?: string | null
  status_reprodutivo?: string | null; valor_compra?: number | null
  observacao?: string | null; lote_id?: string | null; mae_id?: string | null
  lote?: { id: string; nome: string } | null
  mae?: { id: string; brinco: string; nome?: string | null } | null
}

type Pesagem = {
  id: string; data: string; peso_kg: number
  responsavel?: string | null; observacao?: string | null
}

type Sanitario = {
  id: string; tipo: string; produto: string; dose?: string | null; via?: string | null
  data_aplicacao: string; proxima_aplicacao?: string | null
  responsavel?: string | null; observacao?: string | null
}

type Reproducao = {
  id: string; tipo_cobertura: string; data_cobertura: string
  diagnostico?: boolean | null; data_diagnostico?: string | null
  data_parto_prevista?: string | null; data_parto_real?: string | null
  resultado_parto?: string | null; observacao?: string | null
}

type Filho = { id: string; brinco: string; nome?: string | null; sexo: string; categoria: string; data_nascimento: string }
type Lote = { id: string; nome: string }
type AnimalMin = { id: string; brinco: string; nome?: string | null }

const CATEGORIAS = ['bezerra', 'bezerro', 'novilha', 'novilho', 'vaca', 'touro', 'boi', 'matriz']
const RACAS = ['Nelore', 'Angus', 'Brahman', 'Girolando', 'Gir', 'Holandesa', 'Mestiça', 'Outra']
const STATUS_REPR = ['gestante', 'lactando', 'vazia', 'em_diagnostico']

const CAT_LABEL: Record<string, string> = {
  bezerra: 'Bezerra', bezerro: 'Bezerro', novilha: 'Novilha', novilho: 'Novilho',
  vaca: 'Vaca', touro: 'Touro', boi: 'Boi', matriz: 'Matriz'
}
const REPR_LABEL: Record<string, string> = {
  gestante: 'Gestante', lactando: 'Lactando', vazia: 'Vazia', em_diagnostico: 'Em diagnóstico'
}
const STATUS_LABEL: Record<string, string> = { ativo: 'Ativo', vendido: 'Vendido', morto: 'Morto' }
const MARC_LABEL: Record<string, string> = { descarte: 'Descarte', atencao: 'Atenção' }

function dash(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

function fmtDate(s?: string | null) {
  if (!s) return '—'
  const parts = s.split('-')
  if (parts.length !== 3) return s
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function calcIdade(dob?: string | null) {
  if (!dob) return '—'
  const now = new Date()
  const birth = new Date(dob)
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  if (months < 0) { years--; months += 12 }
  if (years === 0) return `${months} mes${months !== 1 ? 'es' : ''}`
  if (months === 0) return `${years} ano${years !== 1 ? 's' : ''}`
  return `${years} ano${years !== 1 ? 's' : ''} e ${months} mes${months !== 1 ? 'es' : ''}`
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-gray-100 last:border-0 gap-3">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right">{value ?? '—'}</span>
    </div>
  )
}

function Bloco({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  )
}

export default function FichaAnimal() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [animal, setAnimal] = useState<Animal | null>(null)
  const [pesagens, setPesagens] = useState<Pesagem[]>([])
  const [sanitario, setSanitario] = useState<Sanitario[]>([])
  const [reproducao, setReproducao] = useState<Reproducao[]>([])
  const [filhos, setFilhos] = useState<Filho[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [maesDisp, setMaesDisp] = useState<AnimalMin[]>([])
  const [loading, setLoading] = useState(true)

  const [editOpen, setEditOpen] = useState(false)
  const [baixaOpen, setBaixaOpen] = useState(false)
  const [baixaTipo, setBaixaTipo] = useState<'vendido' | 'morto'>('vendido')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    brinco: '', nome: '', data_nascimento: '', sexo: 'femea', raca: '',
    categoria: '', origem: 'nascimento', valor_compra: '',
    status_reprodutivo: '', marcacao: '', observacao: '', lote_id: '', mae_id: ''
  })

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const [{ data: a }, { data: p }, { data: s }, { data: r }] = await Promise.all([
      supabase.from('animais')
        .select('*, lote:lotes(id, nome), mae:animais!mae_id(id, brinco, nome)')
        .eq('id', id).single(),
      supabase.from('pesagens')
        .select('id, data, peso_kg, responsavel, observacao')
        .eq('animal_id', id).order('data', { ascending: false }),
      supabase.from('sanitario')
        .select('id, tipo, produto, dose, via, data_aplicacao, proxima_aplicacao, responsavel, observacao')
        .eq('animal_id', id).order('data_aplicacao', { ascending: false }),
      supabase.from('reproducao')
        .select('id, tipo_cobertura, data_cobertura, diagnostico, data_diagnostico, data_parto_prevista, data_parto_real, resultado_parto, observacao')
        .eq('animal_id', id).order('data_cobertura', { ascending: false }),
    ])

    if (a) {
      const animal = a as Animal
      setAnimal(animal)
      setForm({
        brinco: animal.brinco || '',
        nome: animal.nome || '',
        data_nascimento: animal.data_nascimento || '',
        sexo: animal.sexo || 'femea',
        raca: animal.raca || '',
        categoria: animal.categoria || '',
        origem: animal.origem || 'nascimento',
        valor_compra: animal.valor_compra != null ? String(animal.valor_compra) : '',
        status_reprodutivo: animal.status_reprodutivo || '',
        marcacao: animal.marcacao || '',
        observacao: animal.observacao || '',
        lote_id: animal.lote_id || '',
        mae_id: animal.mae_id || '',
      })

      const { data: f } = await supabase.from('animais')
        .select('id, brinco, nome, sexo, categoria, data_nascimento')
        .eq('mae_id', id).order('data_nascimento', { ascending: false })
      if (f) setFilhos(f as Filho[])

      if (animal.fazenda_id) {
        const [{ data: lotesData }, { data: maesData }] = await Promise.all([
          supabase.from('lotes').select('id, nome').eq('fazenda_id', animal.fazenda_id).order('nome'),
          supabase.from('animais').select('id, brinco, nome').eq('fazenda_id', animal.fazenda_id).eq('sexo', 'femea').order('brinco'),
        ])
        setLotes((lotesData || []) as Lote[])
        setMaesDisp((maesData || []) as AnimalMin[])
      }
    }

    setPesagens((p || []) as Pesagem[])
    setSanitario((s || []) as Sanitario[])
    setReproducao((r || []) as Reproducao[])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function salvarEdicao() {
    if (!animal) return
    setSaving(true)
    await supabase.from('animais').update({
      brinco: form.brinco.trim(),
      nome: form.nome.trim() || null,
      data_nascimento: form.data_nascimento || null,
      sexo: form.sexo,
      raca: form.raca,
      categoria: form.categoria,
      origem: form.origem,
      valor_compra: form.valor_compra ? parseFloat(form.valor_compra) : null,
      status_reprodutivo: form.status_reprodutivo || null,
      marcacao: form.marcacao || null,
      observacao: form.observacao.trim() || null,
      lote_id: form.lote_id || null,
      mae_id: form.mae_id || null,
    }).eq('id', animal.id)
    setSaving(false)
    setEditOpen(false)
    load()
  }

  async function darBaixa() {
    if (!animal) return
    setSaving(true)
    await supabase.from('animais').update({ status: baixaTipo }).eq('id', animal.id)
    setSaving(false)
    setBaixaOpen(false)
    load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    )
  }

  if (!animal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-500">Animal não encontrado.</p>
        <Button variant="outline" onClick={() => router.back()}>Voltar</Button>
      </div>
    )
  }

  const pesoAtual = pesagens.length > 0 ? pesagens[0].peso_kg : null
  const ganhoTotal = pesagens.length >= 2
    ? pesagens[0].peso_kg - pesagens[pesagens.length - 1].peso_kg
    : null

  // Timeline
  type TLEvent = { date: string; label: string; sub?: string; icon: string }
  const timeline: TLEvent[] = []

  if (animal.data_nascimento) {
    timeline.push({
      date: animal.data_nascimento,
      label: animal.origem === 'compra' ? 'Entrada por compra' : 'Nascimento',
      sub: animal.origem === 'compra' && animal.valor_compra != null
        ? `R$ ${fmtBRL(animal.valor_compra)}` : undefined,
      icon: '🐄',
    })
  }
  pesagens.forEach(p => timeline.push({
    date: p.data,
    label: `Pesagem — ${p.peso_kg} kg`,
    sub: p.responsavel || undefined,
    icon: '⚖️',
  }))
  sanitario.forEach(s => {
    const tipo = s.tipo === 'vacina' ? 'Vacinação' : s.tipo === 'vermifugo' ? 'Vermifugação'
      : s.tipo === 'carrapaticida' ? 'Carrapaticida' : s.tipo === 'tratamento' ? 'Tratamento' : 'Sanitário'
    timeline.push({ date: s.data_aplicacao, label: `${tipo} — ${s.produto}`, sub: s.via || undefined, icon: '💉' })
  })
  reproducao.forEach(r => {
    const tipo = r.tipo_cobertura === 'monta_natural' ? 'Monta natural'
      : r.tipo_cobertura === 'inseminacao_artificial' ? 'Inseminação artificial' : 'FIV'
    timeline.push({
      date: r.data_cobertura,
      label: `Cobertura — ${tipo}`,
      sub: r.resultado_parto ? `Parto: ${r.resultado_parto}` : undefined,
      icon: '🔬',
    })
  })
  timeline.sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Topbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 flex items-center gap-3 px-4 py-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 transition-colors p-1 -ml-1">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-900 truncate">
            {animal.brinco}{animal.nome ? ` — ${animal.nome}` : ''}
          </h1>
          <p className="text-xs text-gray-500">
            {dash(CAT_LABEL[animal.categoria] || animal.categoria)} · {dash(animal.raca)}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {animal.marcacao && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${animal.marcacao === 'descarte' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {MARC_LABEL[animal.marcacao]}
            </span>
          )}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${animal.status === 'ativo' ? 'bg-green-100 text-green-700' : animal.status === 'vendido' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABEL[animal.status] || animal.status}
          </span>
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Aviso: sem valor de compra */}
        {animal.status === 'ativo' && animal.valor_compra == null && (
          <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <span className="text-amber-500 shrink-0 text-base">⚠️</span>
            <p className="text-sm text-amber-800 flex-1">Valor de compra não informado.</p>
            <button className="text-xs font-semibold text-amber-700 underline underline-offset-2 shrink-0" onClick={() => setEditOpen(true)}>
              Informar
            </button>
          </div>
        )}

        {/* Identificação */}
        <Bloco title="Identificação">
          <InfoRow label="Brinco" value={animal.brinco} />
          <InfoRow label="Nome" value={animal.nome} />
          <InfoRow label="Sexo" value={animal.sexo === 'femea' ? 'Fêmea' : animal.sexo === 'macho' ? 'Macho' : animal.sexo} />
          <InfoRow label="Raça" value={animal.raca} />
          <InfoRow label="Categoria" value={CAT_LABEL[animal.categoria] || animal.categoria} />
          <InfoRow label="Origem" value={animal.origem === 'nascimento' ? 'Nascimento' : animal.origem === 'compra' ? 'Compra' : animal.origem} />
        </Bloco>

        {/* Nascimento e Idade */}
        <Bloco title="Nascimento e Idade">
          <InfoRow label="Data de nascimento" value={fmtDate(animal.data_nascimento)} />
          <InfoRow label="Idade" value={calcIdade(animal.data_nascimento)} />
          {animal.mae && (
            <div className="flex justify-between items-baseline py-2 border-b border-gray-100 last:border-0 gap-3">
              <span className="text-xs text-gray-500 shrink-0">Mãe</span>
              <button className="text-sm font-medium text-green-700 hover:underline text-right" onClick={() => router.push(`/dashboard/rebanho/${animal.mae!.id}`)}>
                {animal.mae.brinco}{animal.mae.nome ? ` — ${animal.mae.nome}` : ''}
              </button>
            </div>
          )}
          {!animal.mae && <InfoRow label="Mãe" value={undefined} />}
        </Bloco>

        {/* Lote */}
        <Bloco title="Lote e Manejo">
          <InfoRow label="Lote atual" value={animal.lote?.nome} />
          <InfoRow
            label="Status reprodutivo"
            value={animal.status_reprodutivo ? (REPR_LABEL[animal.status_reprodutivo] || animal.status_reprodutivo) : undefined}
          />
          <InfoRow label="Marcação" value={animal.marcacao ? MARC_LABEL[animal.marcacao] : undefined} />
        </Bloco>

        {/* Financeiro */}
        <Bloco title="Financeiro">
          <InfoRow
            label="Valor de entrada"
            value={animal.valor_compra != null ? `R$ ${fmtBRL(animal.valor_compra)}` : undefined}
          />
          <InfoRow label="Peso atual" value={pesoAtual != null ? `${pesoAtual} kg` : undefined} />
          {ganhoTotal != null && (
            <InfoRow
              label="Ganho de peso total"
              value={`${ganhoTotal >= 0 ? '+' : ''}${ganhoTotal.toFixed(1)} kg`}
            />
          )}
        </Bloco>

        {/* Pesagens */}
        <Bloco title={`Pesagens (${pesagens.length})`}>
          {pesagens.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">Sem registro</p>
          ) : (
            pesagens.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{p.peso_kg} kg</p>
                  {p.responsavel && <p className="text-xs text-gray-400">{p.responsavel}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{fmtDate(p.data)}</p>
                  {i < pesagens.length - 1 && (() => {
                    const diff = p.peso_kg - pesagens[i + 1].peso_kg
                    return (
                      <p className={`text-xs font-medium ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {diff >= 0 ? '+' : ''}{diff.toFixed(1)} kg
                      </p>
                    )
                  })()}
                </div>
              </div>
            ))
          )}
        </Bloco>

        {/* Sanitário */}
        <Bloco title={`Sanitário (${sanitario.length})`}>
          {sanitario.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">Sem registro</p>
          ) : (
            sanitario.map(s => (
              <div key={s.id} className="py-2 border-b border-gray-100 last:border-0">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{s.produto}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {s.tipo}
                      {s.via ? ` · ${s.via === 'injetavel' ? 'Injetável' : s.via === 'oral' ? 'Oral' : 'Tópica'}` : ''}
                      {s.dose ? ` · ${s.dose}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">{fmtDate(s.data_aplicacao)}</p>
                    {s.proxima_aplicacao && (
                      <p className="text-[11px] text-amber-600">Próx: {fmtDate(s.proxima_aplicacao)}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </Bloco>

        {/* Reprodução — só para fêmeas */}
        {animal.sexo === 'femea' && (
          <Bloco title={`Reprodução (${reproducao.length})`}>
            {reproducao.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">Sem registro</p>
            ) : (
              reproducao.map(r => (
                <div key={r.id} className="py-2 border-b border-gray-100 last:border-0">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">
                        {r.tipo_cobertura === 'monta_natural' ? 'Monta natural'
                          : r.tipo_cobertura === 'inseminacao_artificial' ? 'Inseminação artificial' : 'FIV'}
                      </p>
                      {r.resultado_parto && (
                        <p className="text-xs text-gray-500 capitalize">Parto: {r.resultado_parto}</p>
                      )}
                      {r.diagnostico === true && <p className="text-xs text-green-600">Diagnóstico positivo</p>}
                      {r.diagnostico === false && <p className="text-xs text-red-500">Diagnóstico negativo</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500">{fmtDate(r.data_cobertura)}</p>
                      {r.data_parto_real && (
                        <p className="text-[11px] text-gray-500">Parto: {fmtDate(r.data_parto_real)}</p>
                      )}
                      {!r.data_parto_real && r.data_parto_prevista && (
                        <p className="text-[11px] text-amber-600">Prev: {fmtDate(r.data_parto_prevista)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </Bloco>
        )}

        {/* Genealogia */}
        {(animal.mae || filhos.length > 0) && (
          <Bloco title="Genealogia">
            {animal.mae && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-xs text-gray-500">Mãe</span>
                <button
                  className="text-sm font-medium text-green-700 hover:underline text-right"
                  onClick={() => router.push(`/dashboard/rebanho/${animal.mae!.id}`)}>
                  {animal.mae.brinco}{animal.mae.nome ? ` — ${animal.mae.nome}` : ''}
                </button>
              </div>
            )}
            {filhos.length > 0 && (
              <div className={animal.mae ? 'pt-2' : ''}>
                <p className="text-xs text-gray-500 mb-2">Filhos ({filhos.length})</p>
                {filhos.map(f => (
                  <button
                    key={f.id}
                    className="w-full flex justify-between items-center py-1.5 hover:bg-gray-50 rounded -mx-1 px-1 transition-colors"
                    onClick={() => router.push(`/dashboard/rebanho/${f.id}`)}>
                    <span className="text-sm font-medium text-green-700">
                      {f.brinco}{f.nome ? ` — ${f.nome}` : ''}
                    </span>
                    <span className="text-xs text-gray-400">{fmtDate(f.data_nascimento)}</span>
                  </button>
                ))}
              </div>
            )}
          </Bloco>
        )}

        {/* Observações */}
        {animal.observacao && (
          <Bloco title="Observações">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{animal.observacao}</p>
          </Bloco>
        )}

        {/* Linha do tempo */}
        {timeline.length > 0 && (
          <Bloco title="Linha do tempo">
            <div className="relative pl-7">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
              {timeline.map((ev, i) => (
                <div key={i} className="relative pb-4 last:pb-0">
                  <div className="absolute -left-4 top-0.5 w-7 h-7 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-sm z-10">
                    {ev.icon}
                  </div>
                  <p className="text-sm font-medium text-gray-800 leading-tight">{ev.label}</p>
                  {ev.sub && <p className="text-xs text-gray-500 mt-0.5">{ev.sub}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5">{fmtDate(ev.date)}</p>
                </div>
              ))}
            </div>
          </Bloco>
        )}
      </div>

      {/* Footer fixo */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex gap-3 px-4 py-3 z-20">
        {animal.status === 'ativo' && (
          <Button variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50" onClick={() => setBaixaOpen(true)}>
            Baixa
          </Button>
        )}
        <Button className="flex-1 bg-green-700 hover:bg-green-800" onClick={() => setEditOpen(true)}>
          <Pencil size={15} className="mr-1.5" /> Editar
        </Button>
      </div>

      {/* Dialog: Editar */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar animal</DialogTitle>
          </DialogHeader>
          <div className="pt-1 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Brinco *</label>
              <Input value={form.brinco} onChange={e => setForm(f => ({ ...f, brinco: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nome</label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Opcional" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Data de nascimento</label>
              <Input type="date" value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Sexo</label>
              <div className="flex gap-2">
                {['femea', 'macho'].map(s => (
                  <button key={s} type="button"
                    onClick={() => setForm(f => ({ ...f, sexo: s }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.sexo === s ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {s === 'femea' ? 'Fêmea' : 'Macho'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Raça</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                value={form.raca} onChange={e => setForm(f => ({ ...f, raca: e.target.value }))}>
                <option value="">Selecione</option>
                {RACAS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Categoria</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                <option value="">Selecione</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABEL[c] || c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Origem</label>
              <div className="flex gap-2">
                {['nascimento', 'compra'].map(o => (
                  <button key={o} type="button"
                    onClick={() => setForm(f => ({ ...f, origem: o }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.origem === o ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {o === 'nascimento' ? 'Nascimento' : 'Compra'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Valor de compra (R$)</label>
              <Input type="number" placeholder="0,00" value={form.valor_compra}
                onChange={e => setForm(f => ({ ...f, valor_compra: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Lote</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                value={form.lote_id} onChange={e => setForm(f => ({ ...f, lote_id: e.target.value }))}>
                <option value="">Sem lote</option>
                {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>
            {form.sexo === 'femea' && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Status reprodutivo</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  value={form.status_reprodutivo} onChange={e => setForm(f => ({ ...f, status_reprodutivo: e.target.value }))}>
                  <option value="">Não informado</option>
                  {STATUS_REPR.map(s => <option key={s} value={s}>{REPR_LABEL[s]}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Mãe</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                value={form.mae_id} onChange={e => setForm(f => ({ ...f, mae_id: e.target.value }))}>
                <option value="">Não informada</option>
                {maesDisp.filter(m => m.id !== animal.id).map(m => (
                  <option key={m.id} value={m.id}>{m.brinco}{m.nome ? ` — ${m.nome}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Marcação</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                value={form.marcacao} onChange={e => setForm(f => ({ ...f, marcacao: e.target.value }))}>
                <option value="">Nenhuma</option>
                <option value="descarte">Descarte</option>
                <option value="atencao">Atenção</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Observações</label>
              <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none bg-white"
                rows={3} value={form.observacao}
                onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800"
                onClick={salvarEdicao} disabled={saving || !form.brinco.trim()}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Baixa */}
      <Dialog open={baixaOpen} onOpenChange={setBaixaOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar baixa</DialogTitle>
          </DialogHeader>
          <div className="pt-2 space-y-4">
            <p className="text-sm text-gray-600">Selecione o motivo da saída do animal do rebanho ativo.</p>
            <div className="flex gap-2">
              {(['vendido', 'morto'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => setBaixaTipo(t)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${baixaTipo === t
                    ? t === 'vendido' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-500 bg-gray-100 text-gray-700'
                    : 'border-gray-200 bg-white text-gray-500'}`}>
                  {t === 'vendido' ? '💰 Vendido' : '✝️ Morto'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setBaixaOpen(false)}>Cancelar</Button>
              <Button
                className={`flex-1 ${baixaTipo === 'vendido' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-800'}`}
                onClick={darBaixa} disabled={saving}>
                {saving ? 'Registrando...' : `Confirmar: ${baixaTipo === 'vendido' ? 'Vendido' : 'Morto'}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
