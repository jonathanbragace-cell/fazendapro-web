'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, GitFork, Scale, Heart, ShieldPlus,
  Wallet, Package, BarChart3, LogOut, Menu, X, Leaf, Users, Droplets,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

const ALL_NAV = [
  { href: '/dashboard',            label: 'Início',     icon: LayoutDashboard, cargos: ['admin','gerente','vaqueiro'] },
  { href: '/dashboard/rebanho',    label: 'Rebanho',    icon: GitFork,          cargos: ['admin','gerente','vaqueiro'] },
  { href: '/dashboard/pesagem',    label: 'Pesagem',    icon: Scale,            cargos: ['admin','gerente','vaqueiro'] },
  { href: '/dashboard/reproducao', label: 'Reprodução', icon: Heart,            cargos: ['admin','gerente'] },
  { href: '/dashboard/sanitario',  label: 'Sanitário',  icon: ShieldPlus,       cargos: ['admin','gerente','vaqueiro'] },
  { href: '/dashboard/rocas',      label: 'Roças',      icon: Leaf,             cargos: ['admin','gerente','vaqueiro'] },
  { href: '/dashboard/irrigacao',  label: 'Irrigação',  icon: Droplets,         cargos: ['admin','gerente'] },
  { href: '/dashboard/financeiro', label: 'Financeiro', icon: Wallet,           cargos: ['admin','gerente'] },
  { href: '/dashboard/estoque',    label: 'Estoque',    icon: Package,          cargos: ['admin','gerente'] },
  { href: '/dashboard/relatorios', label: 'Relatórios', icon: BarChart3,        cargos: ['admin','gerente'] },
  { href: '/dashboard/usuarios',   label: 'Usuários',   icon: Users,            cargos: ['admin'] },
]

// Itens fixos da barra inferior (visíveis para todos os cargos)
const BOTTOM_NAV = [
  { href: '/dashboard',            label: 'Início',     icon: LayoutDashboard },
  { href: '/dashboard/rebanho',    label: 'Rebanho',    icon: GitFork },
  { href: '/dashboard/pesagem',    label: 'Pesagem',    icon: Scale },
  { href: '/dashboard/sanitario',  label: 'Sanitário',  icon: ShieldPlus },
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

  // Conteúdo do sidebar desktop
  const NavContent = () => (
    <>
      <div className="px-4 py-5 border-b border-green-800">
        <div className="flex items-center gap-2">
          <img src="/touro.png" alt="" className="w-10 h-10 rounded-lg object-cover object-center shrink-0" />
          <div>
            <p className="font-bold text-white text-sm">FazendaPro</p>
            <p className="text-green-300 text-xs">Gestão Pecuária</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-green-600 text-white' : 'text-green-100 hover:bg-green-800 hover:text-white'
              )}>
              <item.icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-2 py-4 border-t border-green-800">
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-green-100 hover:bg-green-800 hover:text-white transition-colors">
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* ── DESKTOP sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 bg-green-900 h-screen sticky top-0 shrink-0">
        <NavContent />
      </aside>

      {/* ── MOBILE: barra superior ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-green-900 h-14 flex items-center px-4 gap-3 shadow-md">
        <img src="/touro.png" alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
        <p className="font-bold text-white text-sm flex-1">FazendaPro</p>
        <button onClick={() => setMobileOpen(v => !v)} className="text-white p-1.5 rounded-lg hover:bg-green-800 transition-colors">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ── MOBILE: menu fullscreen ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-green-900 flex flex-col">
          <div className="flex items-center px-4 h-14 border-b border-green-800 shrink-0">
            <p className="font-bold text-white flex-1">Menu</p>
            <button onClick={() => setMobileOpen(false)} className="text-white p-1.5 rounded-lg hover:bg-green-800">
              <X size={22} />
            </button>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                  className={cn('flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium transition-colors',
                    active ? 'bg-green-600 text-white' : 'text-green-100 hover:bg-green-800'
                  )}>
                  <item.icon size={22} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="px-3 py-4 border-t border-green-800 shrink-0">
            <button onClick={handleLogout}
              className="flex items-center gap-4 px-4 py-3.5 w-full rounded-xl text-base font-medium text-green-100 hover:bg-green-800 transition-colors">
              <LogOut size={22} />
              Sair
            </button>
          </div>
        </div>
      )}

      {/* ── MOBILE: barra de navegação inferior ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex safe-bottom">
        {BOTTOM_NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={cn('flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors',
                active ? 'text-green-700' : 'text-gray-400'
              )}>
              <item.icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
        <button onClick={() => setMobileOpen(v => !v)}
          className={cn('flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors',
            mobileOpen ? 'text-green-700' : 'text-gray-400'
          )}>
          <Menu size={22} strokeWidth={1.8} />
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </nav>
    </>
  )
}
