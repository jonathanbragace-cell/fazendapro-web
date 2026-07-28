'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, MapPin, Trash2 } from 'lucide-react'

type Fazenda = { id: string; nome: string; area_ha?: number; cidade?: string; estado?: string }

export function FazendaManager({ fazendas }: { fazendas: Fazenda[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({ nome: '', area_ha: '', cidade: '', estado: '' })

  function setF(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSave() {
    if (!form.nome.trim()) return
    setSaving(true)
    setErro('')
    const { error } = await supabase.from('fazendas').insert({ nome: form.nome.trim() })
    if (error) {
      setErro(`Erro: ${error.message}`)
      setSaving(false)
      return
    }
    setSaving(false)
    setOpen(false)
    setForm({ nome: '', area_ha: '', cidade: '', estado: '' })
    router.refresh()
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Excluir a fazenda "${nome}"? Todos os dados vinculados serão perdidos.`)) return
    await supabase.from('fazendas').delete().eq('id', id)
    router.refresh()
  }

  return (
    <>
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-700">Fazendas</p>
          <Button onClick={() => setOpen(true)} size="sm"
            className="bg-green-700 hover:bg-green-800 text-white gap-1.5 text-xs">
            <Plus size={14} /> Nova fazenda
          </Button>
        </div>

        {fazendas.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm mb-3">Nenhuma fazenda cadastrada ainda.</p>
            <Button onClick={() => setOpen(true)}
              className="bg-green-700 hover:bg-green-800 text-white gap-2">
              <Plus size={16} /> Cadastrar primeira fazenda
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {fazendas.map(f => (
              <div key={f.id} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {f.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{f.nome}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      {f.cidade && f.estado ? <><MapPin size={10} />{f.cidade} — {f.estado}</> :
                       f.cidade ? <><MapPin size={10} />{f.cidade}</> :
                       f.area_ha ? `${f.area_ha} ha` : 'Sem detalhes'}
                      {f.area_ha && (f.cidade || f.estado) ? ` · ${f.area_ha} ha` : ''}
                    </p>
                  </div>
                </div>
                <button onClick={() => handleDelete(f.id, f.nome)}
                  className="text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova fazenda</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Nome da fazenda *</label>
              <Input placeholder="Ex: Fazenda Santa Maria" value={form.nome} onChange={e => setF('nome', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Área (hectares)</label>
              <Input placeholder="Ex: 500" value={form.area_ha} onChange={e => setF('area_ha', e.target.value)} inputMode="decimal" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Cidade</label>
                <Input placeholder="Ex: Uberaba" value={form.cidade} onChange={e => setF('cidade', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Estado</label>
                <Input placeholder="Ex: MG" value={form.estado} onChange={e => setF('estado', e.target.value)} maxLength={2} />
              </div>
            </div>
            {erro && <p className="text-red-500 text-xs">{erro}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800 text-white" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
