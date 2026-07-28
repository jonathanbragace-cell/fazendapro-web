import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function verificarAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('cargo').eq('id', user.id).single()
  if (profile?.cargo !== 'admin') return null
  return user
}

export async function GET() {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const adm = adminClient()
  const { data: { users }, error } = await adm.auth.admin.listUsers({ perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profiles } = await adm.from('profiles').select('*')
  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))

  const result = users.map(u => ({
    id: u.id,
    email: u.email,
    nome: profileMap[u.id]?.nome ?? u.email,
    cargo: profileMap[u.id]?.cargo ?? 'vaqueiro',
    created_at: u.created_at,
  }))

  return NextResponse.json({ users: result })
}

export async function POST(req: NextRequest) {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { nome, email, senha, cargo } = await req.json()
  if (!nome || !email || !senha || !cargo) {
    return NextResponse.json({ error: 'Campos obrigatórios: nome, email, senha, cargo' }, { status: 400 })
  }

  const adm = adminClient()
  const { data, error } = await adm.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, cargo },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Garante que o perfil existe (trigger pode demorar)
  await adm.from('profiles').upsert({ id: data.user.id, nome, cargo })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await req.json()
  if (id === admin.id) return NextResponse.json({ error: 'Não pode excluir a própria conta' }, { status: 400 })

  const adm = adminClient()
  const { error } = await adm.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id, cargo, nome } = await req.json()
  const adm = adminClient()
  await adm.from('profiles').update({ cargo, nome }).eq('id', id)

  return NextResponse.json({ ok: true })
}
