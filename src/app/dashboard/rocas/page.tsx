'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, MapPin, Trash2, LogIn, LogOut, ChevronDown, ChevronUp, Pencil, ArrowRightLeft } from 'lucide-react'

type Fazenda = { id: string; nome: string }
type Pastejo = {
  id: string; roca_id: string; data_entrada: string; data_saida: string | null
  num_cabecas: number; observacao: string | null
}
type Roca = {
  id: string; fazenda_id: string; nome: string; area_ha: number | null
  pastejo: Pastejo[]
}

function diasNoAno(pastejo: Pastejo[]): number {
  const ano = new Date().getFullYear()
  return pastejo.reduce((total, p) => {
    const entrada = new Date(p.data_entrada)
    if (entrada.getFullYear() > ano) return total
    const saida = p.data_saida ? new Date(p.data_saida) : new Date()
    const inicio = entrada.getFullYear() < ano ? new Date(`${ano}-01-01`) : entrada
    const fim = saida.getFullYear() > ano ? new Date(`${ano}-12-31`) : saida
    const dias = Math.max(0, Math.ceil((fim.getTime() - inicio.getTime()) / 86400000))
    return total + dias
  }, 0)
}

// Soma TODAS as entradas ativas (sem saída)
function cabecasAtuais(pastejo: Pastejo[]): number {
  return pastejo.filter(p => !p.data_saida).reduce((s, p) => s + p.num_cabecas, 0)
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function hoje() {
  return new Date().toISOString().split('T')[0].split('-').reverse().join('/')
}

export default function RocasPage() {
  const supabase = createClient()
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [rocas, setRocas] = useState<Roca[]>([])
  const [fazendaId, setFazendaId] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)

  // Modal nova/editar roça
  const [openRoca, setOpenRoca] = useState(false)
  const [editandoRoca, setEditandoRoca] = useState<Roca | null>(null)
  const [formRoca, setFormRoca] = useState({ nome: '', area_ha: '' })
  const [savingRoca, setSavingRoca] = useState(false)

  // Modal entrada
  const [openEntrada, setOpenEntrada] = useState(false)
  const [entradaRoca, setEntradaRoca] = useState<Roca | null>(null)
  const [formEntrada, setFormEntrada] = useState({ data: hoje(), num_cabecas: '', observacao: '' })
  const [savingEntrada, setSavingEntrada] = useState(false)

  // Modal saída
  const [openSaida, setOpenSaida] = useState(false)
  const [saidaRoca, setSaidaRoca] = useState<Roca | null>(null)
  const [formSaida, setFormSaida] = useState({ data: hoje(), observacao: '' })
  const [savingSaida, setSavingSaida] = useState(false)

  // Modal transferência
  const [openTransf, setOpenTransf] = useState(false)
  const [transfOrigem, setTransfOrigem] = useState<Roca | null>(null)
  const [formTransf, setFormTransf] = useState({ data: hoje(), num_cabecas: '', destino_id: '', observacao: '' })
  const [savingTransf, setSavingTransf] = useState(false)

  async function load(fid?: string) {
    setLoading(true)
    const { data: faz } = await supabase.from('fazendas').select('id, nome').order('nome')
    setFazendas(faz ?? [])
    const id = fid ?? fazendaId ?? faz?.[0]?.id ?? ''
    if (!fazendaId && faz?.[0]) setFazendaId(faz[0].id)
    if (!id) { setRocas([]); setLoading(false); return }

    const { data: rs } = await supabase.from('rocas').select('*').eq('fazenda_id', id).order('nome')
    if (!rs?.length) { setRocas([]); setLoading(false); return }

    const ids = rs.map(r => r.id)
    const { data: ps } = await supabase.from('pastejo').select('*').in('roca_id', ids).order('data_entrada', { ascending: false })

    setRocas(rs.map(r => ({ ...r, pastejo: (ps ?? []).filter(p => p.roca_id === r.id) })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (fazendaId) load(fazendaId) }, [fazendaId])

  // ── Roça ──────────────────────────────────────────────
  function abrirNovaRoca() {
    setEditandoRoca(null); setFormRoca({ nome: '', area_ha: '' }); setOpenRoca(true)
  }
  function abrirEditarRoca(r: Roca) {
    setEditandoRoca(r); setFormRoca({ nome: r.nome, area_ha: r.area_ha ? String(r.area_ha) : '' }); setOpenRoca(true)
  }
  async function salvarRoca() {
    if (!formRoca.nome.trim() || !fazendaId) return
    setSavingRoca(true)
    const payload = { nome: formRoca.nome.trim(), area_ha: formRoca.area_ha ? parseFloat(formRoca.area_ha.replace(',', '.')) : null }
    if (editandoRoca) await supabase.from('rocas').update(payload).eq('id', editandoRoca.id)
    else await supabase.from('rocas').insert({ fazenda_id: fazendaId, ...payload })
    setSavingRoca(false); setOpenRoca(false); setEditandoRoca(null)
    setFormRoca({ nome: '', area_ha: '' }); load(fazendaId)
  }
  async function excluirRoca(id: string, nome: string) {
    if (!confirm(`Excluir roça "${nome}"? Todo o histórico de pastejo será perdido.`)) return
    await supabase.from('rocas').delete().eq('id', id); load(fazendaId)
  }

  // ── Entrada ────────────────────────────────────────────
  function abrirEntrada(r: Roca) {
    setEntradaRoca(r); setFormEntrada({ data: hoje(), num_cabecas: '', observacao: '' }); setOpenEntrada(true)
  }
  async function salvarEntrada() {
    if (!entradaRoca || !formEntrada.num_cabecas) return
    const [d, m, y] = formEntrada.data.split('/')
    const iso = `${y}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}`
    setSavingEntrada(true)
    await supabase.from('pastejo').insert({
      roca_id: entradaRoca.id, fazenda_id: fazendaId, data_entrada: iso,
      num_cabecas: parseInt(formEntrada.num_cabecas) || 0,
      observacao: formEntrada.observacao.trim() || null,
    })
    setSavingEntrada(false); setOpenEntrada(false); load(fazendaId)
  }

  // ── Saída ──────────────────────────────────────────────
  function abrirSaida(r: Roca) {
    setSaidaRoca(r); setFormSaida({ data: hoje(), observacao: '' }); setOpenSaida(true)
  }
  async function salvarSaida() {
    if (!saidaRoca) return
    const [d, m, y] = formSaida.data.split('/')
    const iso = `${y}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}`
    setSavingSaida(true)
    // Fecha TODOS os registros ativos desta roça
    const ativos = saidaRoca.pastejo.filter(p => !p.data_saida)
    await Promise.all(ativos.map(p => supabase.from('pastejo').update({ data_saida: iso }).eq('id', p.id)))
    setSavingSaida(false); setOpenSaida(false); load(fazendaId)
  }

  // ── Transferência ──────────────────────────────────────
  function abrirTransferencia(r: Roca) {
    const outraRoca = rocas.find(x => x.id !== r.id)
    setTransfOrigem(r)
    setFormTransf({ data: hoje(), num_cabecas: String(cabecasAtuais(r.pastejo)), destino_id: outraRoca?.id ?? '', observacao: '' })
    setOpenTransf(true)
  }
  async function salvarTransferencia() {
    if (!transfOrigem || !formTransf.destino_id) return
    const [d, m, y] = formTransf.data.split('/')
    const iso = `${y}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}`
    setSavingTransf(true)
    // Fecha ativos na origem
    const ativos = transfOrigem.pastejo.filter(p => !p.data_saida)
    await Promise.all(ativos.map(p => supabase.from('pastejo').update({ data_saida: iso }).eq('id', p.id)))
    // Abre entrada no destino
    await supabase.from('pastejo').insert({
      roca_id: formTransf.destino_id, fazenda_id: fazendaId, data_entrada: iso,
      num_cabecas: parseInt(formTransf.num_cabecas) || cabecasAtuais(transfOrigem.pastejo),
      observacao: formTransf.observacao.trim() || `Transferido de ${transfOrigem.nome}`,
    })
    setSavingTransf(false); setOpenTransf(false); load(fazendaId)
  }

  async function excluirPastejo(id: string) {
    if (!confirm('Excluir este registro de pastejo?')) return
    await supabase.from('pastejo').delete().eq('id', id); load(fazendaId)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roças</h1>
          <p className="text-gray-500 text-sm mt-1">Controle de pastejo por área</p>
        </div>
        <Button onClick={abrirNovaRoca} className="bg-green-700 hover:bg-green-800 text-white gap-2">
          <Plus size={16} /> Nova roça
        </Button>
      </div>

      {/* Seletor de fazenda */}
      {fazendas.length > 1 && (
        <div className="mb-5 flex gap-2 flex-wrap">
          {fazendas.map(f => (
            <button key={f.id} onClick={() => setFazendaId(f.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${fazendaId === f.id ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>
              {f.nome}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Carregando...</div>
      ) : rocas.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm mb-3">Nenhuma roça cadastrada ainda.</p>
          <Button onClick={abrirNovaRoca} className="bg-green-700 hover:bg-green-800 text-white gap-2">
            <Plus size={16} /> Cadastrar primeira roça
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rocas.map(r => {
            const cabecas = cabecasAtuais(r.pastejo)
            const dias = diasNoAno(r.pastejo)
            const temAtivo = r.pastejo.some(p => !p.data_saida)
            const aberto = expandido === r.id
            const qtdAtivos = r.pastejo.filter(p => !p.data_saida).length

            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0 ${cabecas > 0 ? 'bg-green-600' : 'bg-gray-300'}`}>
                      {r.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{r.nome}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 flex-wrap">
                        {r.area_ha ? <><MapPin size={10} />{r.area_ha} ha · </> : null}
                        <span className={cabecas > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                          {cabecas > 0 ? `${cabecas} cabeças${qtdAtivos > 1 ? ` (${qtdAtivos} lotes)` : ''}` : 'Vazia'}
                        </span>
                        {' · '}
                        <span className="text-blue-600 font-medium">{dias} dias/{new Date().getFullYear()}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {/* Entrada — sempre visível */}
                    <button onClick={() => abrirEntrada(r)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors border border-green-200">
                      <LogIn size={12} /> Entrada
                    </button>

                    {/* Transferir e Saída — só quando tem gado */}
                    {temAtivo && rocas.length > 1 && (
                      <button onClick={() => abrirTransferencia(r)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors border border-blue-200">
                        <ArrowRightLeft size={12} /> Transferir
                      </button>
                    )}
                    {temAtivo && (
                      <button onClick={() => abrirSaida(r)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors border border-amber-200">
                        <LogOut size={12} /> Saída
                      </button>
                    )}

                    <button onClick={() => setExpandido(aberto ? null : r.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
                      {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button onClick={() => abrirEditarRoca(r)}
                      className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => excluirRoca(r.id, r.nome)}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Histórico expandido */}
                {aberto && (
                  <div className="border-t border-gray-100 px-5 py-3">
                    {r.pastejo.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">Nenhum registro de pastejo ainda.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 uppercase tracking-wide">
                            <th className="text-left pb-2 font-semibold">Entrada</th>
                            <th className="text-left pb-2 font-semibold">Saída</th>
                            <th className="text-left pb-2 font-semibold">Cabeças</th>
                            <th className="text-left pb-2 font-semibold">Dias</th>
                            <th className="text-left pb-2 font-semibold">Obs.</th>
                            <th className="pb-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {r.pastejo.map(p => {
                            const ent = new Date(p.data_entrada)
                            const sai = p.data_saida ? new Date(p.data_saida) : new Date()
                            const dias = Math.max(0, Math.ceil((sai.getTime() - ent.getTime()) / 86400000))
                            return (
                              <tr key={p.id} className="text-gray-600">
                                <td className="py-2">{fmtDate(p.data_entrada)}</td>
                                <td className="py-2">
                                  {p.data_saida
                                    ? fmtDate(p.data_saida)
                                    : <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Ativo</span>}
                                </td>
                                <td className="py-2 font-medium">{p.num_cabecas}</td>
                                <td className="py-2 text-blue-600 font-medium">{dias}d</td>
                                <td className="py-2 text-gray-400 truncate max-w-[120px]">{p.observacao ?? '—'}</td>
                                <td className="py-2">
                                  <button onClick={() => excluirPastejo(p.id)} className="text-gray-200 hover:text-red-400">
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                    <button onClick={() => abrirEntrada(r)}
                      className="mt-3 flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium">
                      <Plus size={12} /> Registrar entrada
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nova/editar roça */}
      <Dialog open={openRoca} onOpenChange={setOpenRoca}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editandoRoca ? 'Editar roça' : 'Nova roça'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Nome da roça *</label>
              <Input placeholder="Ex: Roça 1, Pasto do Rio..." value={formRoca.nome} onChange={e => setFormRoca(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Área (hectares)</label>
              <Input placeholder="Ex: 50" value={formRoca.area_ha} onChange={e => setFormRoca(p => ({ ...p, area_ha: e.target.value }))} inputMode="decimal" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpenRoca(false)}>Cancelar</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800 text-white" onClick={salvarRoca} disabled={savingRoca}>
                {savingRoca ? 'Salvando...' : editandoRoca ? 'Salvar alterações' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal entrada */}
      <Dialog open={openEntrada} onOpenChange={setOpenEntrada}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Entrada de gado — {entradaRoca?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Data *</label>
                <Input placeholder="DD/MM/AAAA" value={formEntrada.data} onChange={e => setFormEntrada(p => ({ ...p, data: e.target.value }))} maxLength={10} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Cabeças *</label>
                <Input placeholder="Ex: 50" value={formEntrada.num_cabecas} onChange={e => setFormEntrada(p => ({ ...p, num_cabecas: e.target.value }))} inputMode="numeric" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Observação</label>
              <Input placeholder="Opcional" value={formEntrada.observacao} onChange={e => setFormEntrada(p => ({ ...p, observacao: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpenEntrada(false)}>Cancelar</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800 text-white" onClick={salvarEntrada} disabled={savingEntrada}>
                {savingEntrada ? 'Salvando...' : 'Registrar entrada'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal saída */}
      <Dialog open={openSaida} onOpenChange={setOpenSaida}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Saída de gado — {saidaRoca?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {saidaRoca && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-sm text-amber-800">
                  Encerrando pastejo de <strong>{cabecasAtuais(saidaRoca.pastejo)} cabeças</strong>
                  {saidaRoca.pastejo.filter(p => !p.data_saida).length > 1 && (
                    <span className="text-amber-600"> ({saidaRoca.pastejo.filter(p => !p.data_saida).length} lotes ativos)</span>
                  )}.
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Data de saída *</label>
              <Input placeholder="DD/MM/AAAA" value={formSaida.data} onChange={e => setFormSaida(p => ({ ...p, data: e.target.value }))} maxLength={10} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpenSaida(false)}>Cancelar</Button>
              <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={salvarSaida} disabled={savingSaida}>
                {savingSaida ? 'Salvando...' : 'Registrar saída'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal transferência */}
      <Dialog open={openTransf} onOpenChange={setOpenTransf}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Transferir gado</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <div className="text-center flex-1">
                <p className="text-xs text-gray-500 mb-0.5">De</p>
                <p className="font-semibold text-gray-900 text-sm">{transfOrigem?.nome}</p>
              </div>
              <ArrowRightLeft size={18} className="text-blue-500 shrink-0" />
              <div className="text-center flex-1">
                <p className="text-xs text-gray-500 mb-0.5">Para</p>
                <select
                  className="font-semibold text-gray-900 text-sm bg-transparent border-0 outline-none w-full text-center"
                  value={formTransf.destino_id}
                  onChange={e => setFormTransf(p => ({ ...p, destino_id: e.target.value }))}>
                  {rocas.filter(r => r.id !== transfOrigem?.id).map(r => (
                    <option key={r.id} value={r.id}>{r.nome}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Data *</label>
                <Input placeholder="DD/MM/AAAA" value={formTransf.data} onChange={e => setFormTransf(p => ({ ...p, data: e.target.value }))} maxLength={10} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Cabeças</label>
                <Input placeholder="Ex: 50" value={formTransf.num_cabecas} onChange={e => setFormTransf(p => ({ ...p, num_cabecas: e.target.value }))} inputMode="numeric" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Observação</label>
              <Input placeholder="Opcional" value={formTransf.observacao} onChange={e => setFormTransf(p => ({ ...p, observacao: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpenTransf(false)}>Cancelar</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={salvarTransferencia} disabled={savingTransf}>
                {savingTransf ? 'Transferindo...' : 'Transferir'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
