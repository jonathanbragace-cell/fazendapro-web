'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, GitFork, Scale, Heart, ShieldPlus,
  Wallet, Package, BarChart3, LogOut, Menu, X, Leaf, Users,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

const ALL_NAV = [
  { href: '/dashboard',             label: 'Início',      icon: LayoutDashboard, cargos: ['admin','gerente','vaqueiro'] },
  { href: '/dashboard/rebanho',     label: 'Rebanho',     icon: GitFork,          cargos: ['admin','gerente','vaqueiro'] },
  { href: '/dashboard/pesagem',     label: 'Pesagem',     icon: Scale,            cargos: ['admin','gerente','vaqueiro'] },
  { href: '/dashboard/reproducao',  label: 'Reprodução',  icon: Heart,            cargos: ['admin','gerente'] },
  { href: '/dashboard/sanitario',   label: 'Sanitário',   icon: ShieldPlus,       cargos: ['admin','gerente','vaqueiro'] },
  { href: '/dashboard/rocas',       label: 'Roças',       icon: Leaf,             cargos: ['admin','gerente','vaqueiro'] },
  { href: '/dashboard/financeiro',  label: 'Financeiro',  icon: Wallet,           cargos: ['admin','gerente'] },
  { href: '/dashboard/estoque',     label: 'Estoque',     icon: Package,          cargos: ['admin','gerente'] },
  { href: '/dashboard/relatorios',  label: 'Relatórios',  icon: BarChart3,        cargos: ['admin','gerente'] },
  { href: '/dashboard/usuarios',    label: 'Usuários',    icon: Users,            cargos: ['admin'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cargo, setCargo] = useState<string>('admin')

  useEffect(() => {
    async function fetchCargo() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('cargo').eq('id', user.id).single()
      if (data?.cargo) setCargo(data.cargo)
    }
    fetchCargo()
  }, [])

  const navItems = ALL_NAV.filter(item => item.cargos.includes(cargo))

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-green-800">
        <div className="flex items-center gap-2">
          <img src="/touro.png" alt="Touro Nelore" className="w-10 h-10 rounded-lg object-cover object-center shrink-0" />
          <div>
            <p className="font-bold text-white text-sm">FazendaPro</p>
            <p className="text-green-300 text-xs">Gestão Pecuária</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-green-600 text-white'
                  : 'text-green-100 hover:bg-green-800 hover:text-white'
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 py-4 border-t border-green-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-green-100 hover:bg-green-800 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-green-900 h-screen sticky top-0 shrink-0">
        <NavContent />
      </aside>

      {/* Mobile toggle */}
      <button
        className="md:hidden fixed top-3 left-3 z-50 bg-green-900 text-white p-2 rounded-lg shadow-lg"
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <aside className="flex flex-col w-56 bg-green-900 h-full">
            <NavContent />
          </aside>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}
