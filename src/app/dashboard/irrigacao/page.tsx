'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Droplets, ChevronDown, ChevronUp } from 'lucide-react'

type Fazenda = { id: string; nome: string }
type Custo = { id: string; silagem_id: string; descricao: string; valor: number; data: string }
type Silagem = {
  id: string
  fazenda_id: string
  data_plantio: string
  data_colheita: string | null
  area_ha: number | null
  resultado_esperado_ton: number | null
  resultado_obtido_ton: number | null
  observacao: string | null
  status: string
  custos: Custo[]
}

const supabase = createClient()

export default function IrrigacaoPage() {
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [fazendaSel, setFazendaSel] = useState('')
  const [silagens, setSilagens] = useState<Silagem[]>([])
  const [loading, setLoading] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)

  const [modalSilagem, setModalSilagem] = useState(false)
  const [editSilagem, setEditSilagem] = useState<Silagem | null>(null)
  const [formS, setFormS] = useState({
    data_plantio: '',
    data_colheita: '',
    area_ha: '',
    resultado_esperado_ton: '',
    resultado_obtido_ton: '',
    observacao: '',
  })

  const [modalCustoId, setModalCustoId] = useState<string | null>(null)
  const [editCusto, setEditCusto] = useState<Custo | null>(null)
  const [formC, setFormC] = useState({ descricao: '', valor: '', data: '' })

  const [saving, setSaving] = useState(false)
  const [erroGeral, setErroGeral] = useState('')
  const [erroForm, setErroForm] = useState('')

  useEffect(() => {
    supabase.from('fazendas').select('id, nome').order('nome').then(({ data }) => {
      if (data?.length) { setFazendas(data); setFazendaSel(data[0].id) }
    })
  }, [])

  useEffect(() => { if (fazendaSel) carregar() }, [fazendaSel])

  async function carregar() {
    setLoading(true)
    setErroGeral('')
    const { data: sl, error: errSl } = await supabase
      .from('silagem').select('*').eq('fazenda_id', fazendaSel).order('data_plantio', { ascending: false })

    if (errSl) {
      const sql = `CREATE TABLE IF NOT EXISTS silagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id uuid NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
  data_plantio date NOT NULL,
  data_colheita date,
  area_ha numeric,
  resultado_esperado_ton numeric,
  resultado_obtido_ton numeric,
  observacao text,
  status text NOT NULL DEFAULT 'em_andamento',
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS silagem_custos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  silagem_id uuid NOT NULL REFERENCES silagem(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);`
      setErroGeral(sql)
      setSilagens([]); setLoading(false); return
    }
    if (!sl?.length) { setSilagens([]); setLoading(false); return }

    const { data: custos } = await supabase
      .from('silagem_custos').select('*').in('silagem_id', sl.map(s => s.id)).order('data', { ascending: false })

    const map: Record<string, Custo[]> = {}
    for (const c of custos ?? []) {
      if (!map[c.silagem_id]) map[c.silagem_id] = []
      map[c.silagem_id].push(c)
    }

    setSilagens(sl.map(s => ({ ...s, custos: map[s.id] ?? [] })))
    setLoading(false)
  }

  function abrirNovaSilagem() {
    setEditSilagem(null)
    setErroForm('')
    setFormS({ data_plantio: new Date().toISOString().split('T')[0], data_colheita: '', area_ha: '', resultado_esperado_ton: '', resultado_obtido_ton: '', observacao: '' })
    setModalSilagem(true)
  }

  function abrirEditarSilagem(s: Silagem) {
    setEditSilagem(s)
    setErroForm('')
    setFormS({
      data_plantio: s.data_plantio,
      data_colheita: s.data_colheita ?? '',
      area_ha: s.area_ha?.toString() ?? '',
      resultado_esperado_ton: s.resultado_esperado_ton?.toString() ?? '',
      resultado_obtido_ton: s.resultado_obtido_ton?.toString() ?? '',
      observacao: s.observacao ?? '',
    })
    setModalSilagem(true)
  }

  async function salvarSilagem() {
    if (!formS.data_plantio) return
    setSaving(true)
    setErroForm('')
    const payload: any = {
      fazenda_id: fazendaSel,
      data_plantio: formS.data_plantio,
      data_colheita: formS.data_colheita || null,
      area_ha: formS.area_ha ? parseFloat(formS.area_ha) : null,
      resultado_esperado_ton: formS.resultado_esperado_ton ? parseFloat(formS.resultado_esperado_ton) : null,
      resultado_obtido_ton: formS.resultado_obtido_ton ? parseFloat(formS.resultado_obtido_ton) : null,
      observacao: formS.observacao || null,
      status: formS.data_colheita ? 'colhido' : 'em_andamento',
    }
    let err
    if (editSilagem) {
      const r = await supabase.from('silagem').update(payload).eq('id', editSilagem.id)
      err = r.error
    } else {
      const r = await supabase.from('silagem').insert(payload)
      err = r.error
    }
    if (err) { setErroForm(`Erro ao salvar: ${err.message}`); setSaving(false); return }
    setSaving(false)
    setModalSilagem(false)
    carregar()
  }

  async function excluirSilagem(id: string) {
    if (!confirm('Excluir esta safra e todos os custos?')) return
    await supabase.from('silagem').delete().eq('id', id)
    carregar()
  }

  function abrirNovoCusto(silagemId: string) {
    setEditCusto(null)
    setFormC({ descricao: '', valor: '', data: new Date().toISOString().split('T')[0] })
    setModalCustoId(silagemId)
  }

  async function salvarCusto() {
    if (!modalCustoId || !formC.descricao || !formC.valor) return
    setSaving(true)
    setErroForm('')
    const payload = { silagem_id: modalCustoId, descricao: formC.descricao, valor: parseFloat(formC.valor), data: formC.data }
    let err
    if (editCusto) {
      const r = await supabase.from('silagem_custos').update(payload).eq('id', editCusto.id)
      err = r.error
    } else {
      const r = await supabase.from('silagem_custos').insert(payload)
      err = r.error
    }
    if (err) { setErroForm(`Erro: ${err.message}`); setSaving(false); return }
    const id = modalCustoId
    setSaving(false)
    setModalCustoId(null)
    setExpandido(id)
    carregar()
  }

  async function excluirCusto(id: string) {
    if (!confirm('Excluir este custo?')) return
    await supabase.from('silagem_custos').delete().eq('id', id)
    carregar()
  }

  const totalCustos = (custos: Custo[]) => custos.reduce((s, c) => s + Number(c.valor), 0)
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Irrigação / Silagem</h1>
          <p className="text-gray-500 text-sm mt-1">Controle de safras, colheita e custos</p>
        </div>
        <Button onClick={abrirNovaSilagem} disabled={!fazendaSel} className="bg-green-700 hover:bg-green-800 text-white gap-2">
          <Plus size={16} /> Nova safra
        </Button>
      </div>

      {/* SQL de setup quando tabela não existe */}
      {erroGeral && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            Tabelas não encontradas. Execute este SQL no{' '}
            <a href="https://supabase.com/dashboard/project/lcqmbuocthnqlwmqvcwj/sql/new" target="_blank" className="underline">
              Supabase → SQL Editor
            </a>:
          </p>
          <pre className="bg-white border border-amber-200 rounded p-3 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">{erroGeral}</pre>
          <button
            onClick={() => { navigator.clipboard.writeText(erroGeral); alert('SQL copiado!') }}
            className="mt-2 text-xs text-amber-700 font-semibold hover:underline">
            Copiar SQL
          </button>
        </div>
      )}

      {/* Seletor de fazenda */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {fazendas.map(f => (
          <button key={f.id} onClick={() => setFazendaSel(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${fazendaSel === f.id ? 'bg-green-700 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-green-400'}`}>
            {f.nome}
          </button>
        ))}
      </div>

      {/* Lista de safras */}
      {loading ? (
        <div className="text-center text-gray-400 py-10">Carregando...</div>
      ) : silagens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 bg-white rounded-xl border border-gray-200 text-gray-400">
          <Droplets size={36} className="mb-3 opacity-25" />
          <p className="text-sm">Nenhuma safra cadastrada para esta fazenda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {silagens.map(s => {
            const total = totalCustos(s.custos)
            const aberto = expandido === s.id
            const superou = s.resultado_obtido_ton != null && s.resultado_esperado_ton != null
              ? s.resultado_obtido_ton >= s.resultado_esperado_ton
              : null

            return (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.status === 'colhido' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {s.status === 'colhido' ? 'Colhido' : 'Em andamento'}
                        </span>
                        {s.area_ha && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{s.area_ha} ha</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Plantio</p>
                          <p className="font-medium text-gray-800">{fmtDate(s.data_plantio)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Colheita</p>
                          <p className="font-medium text-gray-800">{s.data_colheita ? fmtDate(s.data_colheita) : <span className="text-gray-400">—</span>}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Esperado</p>
                          <p className="font-medium text-gray-800">{s.resultado_esperado_ton != null ? `${s.resultado_esperado_ton} t` : <span className="text-gray-400">—</span>}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Obtido</p>
                          <p className={`font-semibold ${superou === true ? 'text-green-600' : superou === false ? 'text-red-500' : 'text-gray-800'}`}>
                            {s.resultado_obtido_ton != null ? `${s.resultado_obtido_ton} t` : <span className="text-gray-400 font-normal">—</span>}
                          </p>
                        </div>
                      </div>

                      {s.observacao && (
                        <p className="text-xs text-gray-400 mt-2 italic">{s.observacao}</p>
                      )}

                      <div className="mt-3 flex items-center gap-1">
                        <span className="text-xs text-gray-400">Custos totais:</span>
                        <span className="text-sm font-bold text-gray-800 ml-1">{fmt(total)}</span>
                        {s.custos.length > 0 && (
                          <span className="text-xs text-gray-400 ml-1">({s.custos.length} lançamento{s.custos.length > 1 ? 's' : ''})</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => abrirEditarSilagem(s)} className="p-2 text-gray-300 hover:text-blue-500 transition-colors rounded-lg hover:bg-gray-50">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => excluirSilagem(s.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-gray-50">
                        <Trash2 size={15} />
                      </button>
                      <button onClick={() => setExpandido(aberto ? null : s.id)} className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-50">
                        {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Custos expandido */}
                {aberto && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700">Custos detalhados</h3>
                      <button onClick={() => abrirNovoCusto(s.id)} className="flex items-center gap-1 text-xs text-green-700 font-semibold hover:underline">
                        <Plus size={12} /> Adicionar custo
                      </button>
                    </div>

                    {s.custos.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">Nenhum custo registrado.</p>
                    ) : (
                      <div className="space-y-2">
                        {s.custos.map(c => (
                          <div key={c.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{c.descricao}</p>
                              <p className="text-xs text-gray-400">{fmtDate(c.data)}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-gray-700">{fmt(Number(c.valor))}</span>
                              <button
                                onClick={() => {
                                  setEditCusto(c)
                                  setFormC({ descricao: c.descricao, valor: c.valor.toString(), data: c.data })
                                  setModalCustoId(s.id)
                                }}
                                className="text-gray-300 hover:text-blue-500 transition-colors">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => excluirCusto(c.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-end pt-1 pr-1">
                          <span className="text-sm font-bold text-gray-800">Total: {fmt(total)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Nova/Editar Safra */}
      <Dialog open={modalSilagem} onOpenChange={setModalSilagem}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editSilagem ? 'Editar safra' : 'Nova safra'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Data do plantio *</label>
                <Input type="date" value={formS.data_plantio} onChange={e => setFormS(p => ({ ...p, data_plantio: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Data da colheita</label>
                <Input type="date" value={formS.data_colheita} onChange={e => setFormS(p => ({ ...p, data_colheita: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Área (ha)</label>
              <Input type="number" placeholder="Ex: 15.5" inputMode="decimal" value={formS.area_ha} onChange={e => setFormS(p => ({ ...p, area_ha: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Resultado esperado (t)</label>
                <Input type="number" placeholder="Toneladas" inputMode="decimal" value={formS.resultado_esperado_ton} onChange={e => setFormS(p => ({ ...p, resultado_esperado_ton: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Resultado obtido (t)</label>
                <Input type="number" placeholder="Toneladas" inputMode="decimal" value={formS.resultado_obtido_ton} onChange={e => setFormS(p => ({ ...p, resultado_obtido_ton: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Observação</label>
              <Input placeholder="Variedade, condições, etc." value={formS.observacao} onChange={e => setFormS(p => ({ ...p, observacao: e.target.value }))} />
            </div>
            {erroForm && <p className="text-red-500 text-xs">{erroForm}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModalSilagem(false)}>Cancelar</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800 text-white" onClick={salvarSilagem} disabled={saving || !formS.data_plantio}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Custo */}
      <Dialog open={!!modalCustoId} onOpenChange={v => !v && setModalCustoId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editCusto ? 'Editar custo' : 'Novo custo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Descrição *</label>
              <Input placeholder="Ex: Semente, Fertilizante, Combustível..." value={formC.descricao} onChange={e => setFormC(p => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Valor (R$) *</label>
              <Input type="number" placeholder="0,00" inputMode="decimal" value={formC.valor} onChange={e => setFormC(p => ({ ...p, valor: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Data</label>
              <Input type="date" value={formC.data} onChange={e => setFormC(p => ({ ...p, data: e.target.value }))} />
            </div>
            {erroForm && <p className="text-red-500 text-xs">{erroForm}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModalCustoId(null)}>Cancelar</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800 text-white" onClick={salvarCusto} disabled={saving || !formC.descricao || !formC.valor}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
