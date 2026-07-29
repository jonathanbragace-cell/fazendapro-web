'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Trash2, Pencil, ShieldCheck, User } from 'lucide-react'

type Usuario = { id: string; email: string; nome: string; cargo: string; created_at: string }

const CARGOS = [
  { value: 'admin',   label: 'Administrador', desc: 'Acesso total ao sistema' },
  { value: 'gerente', label: 'Gerente',        desc: 'Tudo exceto gerenciar usuários' },
  { value: 'vaqueiro',label: 'Vaqueiro',       desc: 'Rebanho, Pesagem, Sanitário e Roças' },
]

const cargoColor: Record<string, string> = {
  admin:    'bg-purple-100 text-purple-700',
  gerente:  'bg-blue-100 text-blue-700',
  vaqueiro: 'bg-green-100 text-green-700',
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({ nome: '', email: '', senha: '', cargo: 'vaqueiro' })

  async function load() {
    setLoading(true)
    const res = await fetch('/api/usuarios')
    const data = await res.json()
    setUsuarios(data.users ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({ nome: '', email: '', senha: '', cargo: 'vaqueiro' })
    setErro('')
    setOpen(true)
  }

  function abrirEditar(u: Usuario) {
    setEditando(u)
    setForm({ nome: u.nome, email: u.email, senha: '', cargo: u.cargo })
    setErro('')
    setOpen(true)
  }

  async function salvar() {
    if (!form.nome.trim() || !form.email.trim()) { setErro('Nome e e-mail são obrigatórios.'); return }
    if (!editando && !form.senha.trim()) { setErro('Informe uma senha.'); return }
    setSaving(true); setErro('')

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      const method = editando ? 'PATCH' : 'POST'
      const body = editando
        ? { id: editando.id, nome: form.nome, cargo: form.cargo }
        : { nome: form.nome, email: form.email, senha: form.senha, cargo: form.cargo }

      const res = await fetch('/api/usuarios', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const data = await res.json()
      if (data.error) { setErro(data.error); setSaving(false); return }
    } catch (e: any) {
      setErro(e.name === 'AbortError' ? 'Tempo esgotado. Verifique se o deploy foi feito após adicionar a SUPABASE_SERVICE_ROLE_KEY no Vercel.' : `Erro: ${e.message}`)
      setSaving(false)
      return
    }

    setSaving(false); setOpen(false); load()
  }

  async function excluir(u: Usuario) {
    if (!confirm(`Excluir o usuário "${u.nome}" (${u.email})?`)) return
    await fetch('/api/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id }),
    })
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-500 text-sm mt-1">{usuarios.length} usuário(s) cadastrado(s)</p>
        </div>
        <Button onClick={abrirNovo} className="bg-green-700 hover:bg-green-800 text-white gap-2">
          <Plus size={16} /> Novo usuário
        </Button>
      </div>

      {/* Cards de cargos */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {CARGOS.map(c => (
          <div key={c.value} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={16} className="text-green-600" />
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cargoColor[c.value]}`}>{c.label}</span>
            </div>
            <p className="text-xs text-gray-500">{c.desc}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
        ) : usuarios.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Nenhum usuário.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Usuário', 'E-mail', 'Cargo', 'Criado em', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                        <User size={14} className="text-green-700" />
                      </div>
                      <span className="font-medium text-gray-900">{u.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cargoColor[u.cargo] ?? 'bg-gray-100 text-gray-600'}`}>
                      {CARGOS.find(c => c.value === u.cargo)?.label ?? u.cargo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 flex items-center gap-2 justify-end">
                    <button onClick={() => abrirEditar(u)} className="text-gray-300 hover:text-blue-500 transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => excluir(u)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Nome *</label>
              <Input placeholder="Nome completo" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
            </div>
            {!editando && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">E-mail *</label>
                  <Input type="email" placeholder="email@exemplo.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Senha *</label>
                  <Input type="password" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))} />
                </div>
              </>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Cargo *</label>
              <div className="space-y-2">
                {CARGOS.map(c => (
                  <button key={c.value} type="button" onClick={() => setForm(p => ({ ...p, cargo: c.value }))}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${form.cargo === c.value ? 'bg-green-50 border-green-500' : 'border-gray-200 hover:border-green-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 text-sm">{c.label}</span>
                      {form.cargo === c.value && <div className="w-2 h-2 bg-green-600 rounded-full" />}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{c.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            {erro && <p className="text-red-500 text-xs">{erro}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800 text-white" onClick={salvar} disabled={saving}>
                {saving ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar usuário'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
