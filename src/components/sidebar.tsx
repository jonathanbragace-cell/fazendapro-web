'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, GitFork, Scale, Heart, ShieldPlus,
  Wallet, Package, BarChart3, LogOut, Menu, X, Leaf,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard',              label: 'Início',      icon: LayoutDashboard },
  { href: '/dashboard/rebanho',      label: 'Rebanho',     icon: GitFork },
  { href: '/dashboard/pesagem',      label: 'Pesagem',     icon: Scale },
  { href: '/dashboard/reproducao',   label: 'Reprodução',  icon: Heart },
  { href: '/dashboard/sanitario',    label: 'Sanitário',   icon: ShieldPlus },
  { href: '/dashboard/rocas',         label: 'Roças',       icon: Leaf },
  { href: '/dashboard/financeiro',   label: 'Financeiro',  icon: Wallet },
  { href: '/dashboard/estoque',      label: 'Estoque',     icon: Package },
  { href: '/dashboard/relatorios',   label: 'Relatórios',  icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

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
          <span className="text-2xl">🐄</span>
          <div>
            <p className="font-bold text-white text-sm">FazendaPro</p>
            <p className="text-green-300 text-xs">Gestão Pecuária</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
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
