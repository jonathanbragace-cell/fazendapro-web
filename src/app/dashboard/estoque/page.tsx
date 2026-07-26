'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, AlertTriangle, Package, Pencil, ArrowUpDown } from 'lucide-react'

type Item = {
  id: string; fazenda_id: string; produto: string; categoria: string
  quantidade: number; unidade: string; estoque_minimo: number; localizacao?: string
}
type Fazenda = { id: string; nome: string }

const CATS: Record<string, string> = {
  racao:'Ração', sal:'Sal mineral', medicamento:'Medicamento', vacina:'Vacina', outro:'Outro',
}
const UNIDADES = ['kg', 'L', 'un', 'cx', 'sc', 'g', 'mL']

const EMPTY_ITEM = { produto:'', categoria:'racao', quantidade:'', unidade:'kg', estoque_minimo:'', localizacao:'', fazenda_id:'' }
const EMPTY_MOV  = { item_id:'', tipo:'entrada' as 'entrada'|'saida', qtd:'', motivo:'' }

export default function EstoquePage() {
  const supabase = createClient()
  const [itens, setItens] = useState<Item[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [loading, setLoading] = useState(true)
  const [openItem, setOpenItem] = useState(false)
  const [openMov, setOpenMov] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [form, setForm]       = useState({ ...EMPTY_ITEM })
  const [mov, setMov]         = useState({ ...EMPTY_MOV })
  const [saving, setSaving]   = useState(false)

  async function load() {
    setLoading(true)
    const { data: faz } = await supabase.from('fazendas').select('id, nome').order('nome')
    const { data } = await supabase.from('estoque').select('*').order('produto')
    setFazendas(faz ?? [])
    setItens(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const criticos = itens.filter(i => i.quantidade <= i.estoque_minimo)

  function setF(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }
  function setM(k: string, v: string) { setMov(prev => ({ ...prev, [k]: v })) }

  function openEditItem(i: Item) {
    setEditing(i)
    setForm({ produto: i.produto, categoria: i.categoria, quantidade: String(i.quantidade),
      unidade: i.unidade, estoque_minimo: String(i.estoque_minimo),
      localizacao: i.localizacao ?? '', fazenda_id: i.fazenda_id })
    setOpenItem(true)
  }

  async function handleSaveItem() {
    const qtd = parseFloat(form.quantidade.replace(',', '.'))
    const min = parseFloat(form.estoque_minimo.replace(',', '.'))
    if (!form.produto.trim() || isNaN(qtd)) return
    setSaving(true)
    const payload = {
      fazenda_id: form.fazenda_id || fazendas[0]?.id,
      produto: form.produto.trim(), categoria: form.categoria,
      quantidade: qtd, unidade: form.unidade, estoque_minimo: isNaN(min) ? 0 : min,
      localizacao: form.localizacao.trim() || null,
    }
    if (editing) {
      await supabase.from('estoque').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('estoque').insert(payload)
    }
    setSaving(false)
    setOpenItem(false)
    setEditing(null)
    load()
  }

  function openMovimento(i: Item) {
    setMov({ ...EMPTY_MOV, item_id: i.id })
    setOpenMov(true)
  }

  async function handleSaveMov() {
    const qtd = parseFloat(mov.qtd.replace(',', '.'))
    if (!qtd || qtd <= 0 || !mov.item_id) return
    const item = itens.find(i => i.id === mov.item_id)
    if (!item) return
    if (mov.tipo === 'saida' && qtd > item.quantidade) {
      if (!confirm(`Estoque ficará negativo (${item.quantidade - qtd} ${item.unidade}). Continuar?`)) return
    }
    setSaving(true)
    const novaQtd = mov.tipo === 'entrada' ? item.quantidade + qtd : item.quantidade - qtd
    await supabase.from('estoque').update({ quantidade: novaQtd }).eq('id', item.id)
    await supabase.from('movimentos_estoque').insert({
      estoque_id: item.id, tipo: mov.tipo, quantidade: qtd,
      data: new Date().toISOString().split('T')[0], motivo: mov.motivo.trim() || null,
    })
    setSaving(false)
    setOpenMov(false)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque</h1>
          <p className="text-gray-500 text-sm mt-1">{itens.length} produto(s) · {criticos.length} crítico(s)</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ ...EMPTY_ITEM, fazenda_id: fazendas[0]?.id ?? '' }); setOpenItem(true) }}
          className="bg-green-700 hover:bg-green-800 text-white gap-2">
          <Plus size={16} /> Novo produto
        </Button>
      </div>

      {criticos.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 mt-0.5 shrink-0" size={18} />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Estoque crítico</p>
            <p className="text-amber-700 text-xs mt-0.5">{criticos.map(i => i.produto).join(', ')}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading
          ? <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          : itens.length === 0
            ? <div className="p-8 text-center text-gray-400 text-sm">Nenhum produto no estoque.</div>
            : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Produto', 'Categoria', 'Quantidade', 'Mínimo', 'Status', 'Ações'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itens.map(i => {
                    const critico = i.quantidade <= i.estoque_minimo
                    return (
                      <tr key={i.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{i.produto}</td>
                        <td className="px-4 py-3 text-gray-500">{CATS[i.categoria] ?? i.categoria}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{i.quantidade} {i.unidade}</td>
                        <td className="px-4 py-3 text-gray-400">{i.estoque_minimo} {i.unidade}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${critico ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {critico ? 'Crítico' : 'Em dia'}
                          </span>
                        </td>
                        <td className="px-4 py-3 flex gap-2">
                          <button onClick={() => openMovimento(i)} className="text-gray-400 hover:text-blue-600" title="Movimentação"><ArrowUpDown size={15} /></button>
                          <button onClick={() => openEditItem(i)} className="text-gray-400 hover:text-green-600" title="Editar"><Pencil size={15} /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
        }
      </div>

      {/* Modal produto */}
      <Dialog open={openItem} onOpenChange={setOpenItem}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar produto' : 'Novo produto'}</DialogTitle></DialogHeader>
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
              <label className="text-sm font-medium text-gray-700 block mb-1">Produto *</label>
              <Input placeholder="Ex: Ração Confinamento" value={form.produto} onChange={e => setF('produto', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Categoria</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CATS).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setF('categoria', k)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${form.categoria === k ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Quantidade *</label>
                <Input placeholder="0" value={form.quantidade} onChange={e => setF('quantidade', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Unidade</label>
                <div className="flex flex-wrap gap-1">
                  {UNIDADES.map(u => (
                    <button key={u} type="button" onClick={() => setF('unidade', u)}
                      className={`px-2 py-1 rounded border text-xs font-medium ${form.unidade === u ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600'}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Estoque mínimo</label>
              <Input placeholder="0" value={form.estoque_minimo} onChange={e => setF('estoque_minimo', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Localização</label>
              <Input placeholder="Ex: Depósito A" value={form.localizacao} onChange={e => setF('localizacao', e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpenItem(false)}>Cancelar</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800 text-white" onClick={handleSaveItem} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal movimentação */}
      <Dialog open={openMov} onOpenChange={setOpenMov}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Movimentação de estoque</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Tipo</label>
              <div className="flex gap-2">
                {(['entrada', 'saida'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setM('tipo', t)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${mov.tipo === t ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600'}`}>
                    {t === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Quantidade *</label>
              <Input placeholder="0" value={mov.qtd} onChange={e => setM('qtd', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Motivo</label>
              <Input placeholder="Opcional" value={mov.motivo} onChange={e => setM('motivo', e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpenMov(false)}>Cancelar</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800 text-white" onClick={handleSaveMov} disabled={saving}>
                {saving ? 'Salvando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
