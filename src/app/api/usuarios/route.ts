import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Cliente público (anon key) sem cookies — apenas para criar usuários
function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function verificarAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('cargo').eq('id', user.id).single()
  // Sem perfil = primeiro usuário = admin
  if (!profile || profile.cargo === 'admin') return user
  return null
}

export async function GET() {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const supabase = await createServerClient()
  const { data: profiles } = await supabase.from('profiles').select('id, nome, cargo, created_at')

  // Busca e-mails via service role se disponível, senão usa só os perfis
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  let emailMap: Record<string, string> = {}

  if (serviceKey) {
    const adm = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const { data: { users } } = await adm.auth.admin.listUsers({ perPage: 1000 })
    emailMap = Object.fromEntries((users ?? []).map(u => [u.id, u.email ?? '']))
  }

  const result = (profiles ?? []).map((p: any) => ({
    id: p.id,
    nome: p.nome,
    cargo: p.cargo,
    email: emailMap[p.id] ?? '—',
    created_at: p.created_at,
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

  // Tenta com service role key se disponível
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey) {
    const adm = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const { data, error } = await adm.auth.admin.createUser({
      email, password: senha, email_confirm: true,
      user_metadata: { nome, cargo },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await adm.from('profiles').upsert({ id: data.user.id, nome, cargo })
    return NextResponse.json({ ok: true })
  }

  // Fallback: usa signUp público (requer "Confirm email" desativado no Supabase)
  const client = publicClient()
  const { data, error } = await client.auth.signUp({
    email, password: senha,
    options: { data: { nome, cargo } },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data.user) return NextResponse.json({ error: 'Usuário não criado. Verifique se "Confirm email" está desativado no Supabase.' }, { status: 500 })

  // Aguarda trigger criar o perfil, senão insere manualmente
  const supabase = await createServerClient()
  await new Promise(r => setTimeout(r, 500))
  await supabase.from('profiles').upsert({ id: data.user.id, nome, cargo })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await req.json()
  if (id === admin.id) return NextResponse.json({ error: 'Não pode excluir a própria conta' }, { status: 400 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Exclusão requer SUPABASE_SERVICE_ROLE_KEY no Vercel.' }, { status: 500 })

  const adm = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { error } = await adm.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id, cargo, nome } = await req.json()
  const supabase = await createServerClient()
  await supabase.from('profiles').update({ cargo, nome }).eq('id', id)

  return NextResponse.json({ ok: true })
}
