'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, GitFork, Scale, Heart, ShieldPlus,
  Wallet, Package, BarChart3, LogOut, Menu, X, Users, Droplets, Tag, TrendingUp, ChevronDown, Check,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

type Fazenda = { id: string; nome: string }

const ALL_NAV = [
  { href: '/dashboard',            label: 'Início',     icon: LayoutDashboard, cargos: ['admin','gerente','vaqueiro'] },
  { href: '/dashboard/rebanho',    label: 'Rebanho',    icon: GitFork,          cargos: ['admin','gerente','vaqueiro'] },
{ href: '/dashboard/irrigacao',  label: 'Irrigação',  icon: Droplets,         cargos: ['admin','gerente'] },
  { href: '/dashboard/pesagem',    label: 'Pesagem',    icon: Scale,            cargos: ['admin','gerente','vaqueiro'] },
  { href: '/dashboard/reproducao', label: 'Reprodução', icon: Heart,            cargos: ['admin','gerente'] },
  { href: '/dashboard/sanitario',  label: 'Sanitário',  icon: ShieldPlus,       cargos: ['admin','gerente','vaqueiro'] },
  { href: '/dashboard/lotes',      label: 'Lotes',      icon: Tag,              cargos: ['admin','gerente'] },
  { href: '/dashboard/operacoes',  label: 'Operações',  icon: TrendingUp,       cargos: ['admin','gerente'] },
  { href: '/dashboard/financeiro', label: 'Financeiro', icon: Wallet,           cargos: ['admin','gerente'] },
  { href: '/dashboard/estoque',    label: 'Estoque',    icon: Package,          cargos: ['admin','gerente'] },
  { href: '/dashboard/relatorios', label: 'Relatórios', icon: BarChart3,        cargos: ['admin','gerente'] },
  { href: '/dashboard/usuarios',   label: 'Usuários',   icon: Users,            cargos: ['admin'] },
]

const BOTTOM_NAV = [
  { href: '/dashboard',            label: 'Início',     icon: LayoutDashboard },
  { href: '/dashboard/rebanho',    label: 'Rebanho',    icon: GitFork },
  { href: '/dashboard/pesagem',    label: 'Pesagem',    icon: Scale },
  { href: '/dashboard/sanitario',  label: 'Sanitário',  icon: ShieldPlus },
]

function getCookieFazenda(): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(/(?:^|;\s*)fazenda_id=([^;]+)/)
  return m ? m[1] : ''
}

function setCookieFazenda(id: string) {
  if (id) {
    document.cookie = `fazenda_id=${id}; path=/; max-age=31536000; SameSite=Lax`
  } else {
    document.cookie = `fazenda_id=; path=/; max-age=0`
  }
}

function VersionBadge({ light }: { light?: boolean }) {
  const sha = process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'dev'
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME
  const shortSha = sha === 'dev' ? 'dev' : sha.slice(0, 7)
  const buildLabel = buildTime
    ? new Date(buildTime).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '—'
  if (light) {
    return (
      <div className="mt-2 px-3 py-1.5 rounded-lg bg-gray-100">
        <p className="text-[10px] font-mono text-gray-500 leading-tight">v {shortSha}</p>
        <p className="text-[10px] text-gray-400 leading-tight">{buildLabel}</p>
      </div>
    )
  }
  return (
    <div className="mt-2 px-3 py-1.5 rounded-lg bg-green-950/60">
      <p className="text-[10px] font-mono text-green-500 leading-tight">v {shortSha}</p>
      <p className="text-[10px] text-green-600 leading-tight">{buildLabel}</p>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cargo, setCargo] = useState<string>('admin')
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [selectedFazendaId, setSelectedFazendaId] = useState<string>('')
  const [showFazendaPicker, setShowFazendaPicker] = useState(false)
  const [showMobilePicker, setShowMobilePicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: profile }, { data: fazs }] = await Promise.all([
        supabase.from('profiles').select('cargo').eq('id', user.id).single(),
        supabase.from('fazendas').select('id, nome').order('nome'),
      ])
      if (profile?.cargo) setCargo(profile.cargo)
      const list = fazs ?? []
      setFazendas(list)
      const saved = getCookieFazenda()
      if (saved && list.some((f: Fazenda) => f.id === saved)) {
        setSelectedFazendaId(saved)
      } else if (list.length === 1) {
        setSelectedFazendaId(list[0].id)
        setCookieFazenda(list[0].id)
      }
    }
    init()
  }, [])

  // Close picker when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowFazendaPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectFazenda(id: string) {
    setSelectedFazendaId(id)
    setCookieFazenda(id)
    setShowFazendaPicker(false)
    router.refresh()
  }

  const navItems = ALL_NAV.filter(item => item.cargos.includes(cargo))
  const selectedFazenda = fazendas.find(f => f.id === selectedFazendaId)
  const displayFazenda = selectedFazenda?.nome ?? (fazendas.length === 1 ? fazendas[0]?.nome : 'Selecionar fazenda')

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
          <img src="/touro.png" alt="" className="w-10 h-10 rounded-lg object-cover object-center shrink-0" />
          <div>
            <p className="font-bold text-white text-sm">FazendaPro</p>
            <p className="text-green-300 text-xs">Gestão Pecuária</p>
          </div>
        </div>
      </div>

      {/* Farm selector */}
      {fazendas.length > 0 && (
        <div className="px-3 py-2.5 border-b border-green-800" ref={pickerRef}>
          <button
            onClick={() => setShowFazendaPicker(v => !v)}
            className="w-full flex items-center justify-between gap-2 bg-green-800 hover:bg-green-700 transition-colors rounded-lg px-3 py-2"
          >
            <span className="text-sm font-semibold text-white truncate">{displayFazenda}</span>
            <ChevronDown
              size={14}
              className={cn('shrink-0 text-green-300 transition-transform', showFazendaPicker && 'rotate-180')}
            />
          </button>

          {showFazendaPicker && (
            <div className="absolute left-3 right-3 mt-1 bg-white rounded-xl shadow-2xl z-50 overflow-hidden border border-gray-100">
              {fazendas.map(f => (
                <button
                  key={f.id}
                  onClick={() => selectFazenda(f.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 text-sm flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors',
                    selectedFazendaId === f.id ? 'text-green-700 font-semibold bg-green-50' : 'text-gray-900'
                  )}
                >
                  <span className="truncate">{f.nome}</span>
                  {selectedFazendaId === f.id && <Check size={14} className="shrink-0 text-green-600" />}
                </button>
              ))}
              {fazendas.length > 1 && (
                <button
                  onClick={() => selectFazenda('')}
                  className={cn(
                    'w-full text-left px-4 py-3 text-sm border-t border-gray-100 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2',
                    !selectedFazendaId ? 'text-green-700 font-semibold bg-green-50' : 'text-gray-500'
                  )}
                >
                  <span>Todas as fazendas</span>
                  {!selectedFazendaId && <Check size={14} className="shrink-0 text-green-600" />}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
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
        <VersionBadge />
      </div>
    </>
  )

  return (
    <>
      {/* ── DESKTOP sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 bg-green-900 h-screen sticky top-0 shrink-0 relative">
        <NavContent />
      </aside>

      {/* ── MOBILE: barra superior ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-green-900 h-14 flex items-center px-4 gap-3 shadow-md">
        <img src="/touro.png" alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
        <p className="font-bold text-white text-sm flex-1 truncate">
          {selectedFazenda?.nome ?? 'FazendaPro'}
        </p>
        <button onClick={() => setMobileOpen(v => !v)} className="text-white p-1.5 rounded-lg hover:bg-green-800 transition-colors">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ── MOBILE: menu fullscreen ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center px-4 h-14 border-b border-gray-100 shrink-0">
            <p className="font-bold text-gray-900 flex-1">Menu</p>
            <button onClick={() => setMobileOpen(false)} className="text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
              <X size={22} />
            </button>
          </div>

          {/* Farm selector mobile — compact dropdown */}
          {fazendas.length > 0 && (
            <div className="px-3 py-3 border-b border-gray-100 shrink-0">
              <button
                onClick={() => setShowMobilePicker(v => !v)}
                className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-800 truncate">{displayFazenda}</span>
                <ChevronDown size={14} className={cn('shrink-0 text-gray-400 transition-transform', showMobilePicker && 'rotate-180')} />
              </button>
              {showMobilePicker && (
                <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden shadow-md">
                  {fazendas.map(f => (
                    <button
                      key={f.id}
                      onClick={() => { selectFazenda(f.id); setShowMobilePicker(false); setMobileOpen(false) }}
                      className={cn(
                        'w-full text-left px-4 py-3 text-sm flex items-center justify-between gap-2 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors',
                        selectedFazendaId === f.id ? 'text-green-700 font-semibold bg-green-50' : 'text-gray-800'
                      )}
                    >
                      <span className="truncate">{f.nome}</span>
                      {selectedFazendaId === f.id && <Check size={14} className="shrink-0 text-green-600" />}
                    </button>
                  ))}
                  {fazendas.length > 1 && (
                    <button
                      onClick={() => { selectFazenda(''); setShowMobilePicker(false); setMobileOpen(false) }}
                      className={cn(
                        'w-full text-left px-4 py-3 text-sm flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors border-t border-gray-100',
                        !selectedFazendaId ? 'text-green-700 font-semibold bg-green-50' : 'text-gray-500'
                      )}
                    >
                      <span>Todas as fazendas</span>
                      {!selectedFazendaId && <Check size={14} className="shrink-0 text-green-600" />}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
            {navItems.map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                  className={cn('flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                    active ? 'bg-green-50 text-green-700' : 'text-gray-700 hover:bg-gray-50'
                  )}>
                  <item.icon size={20} className={active ? 'text-green-600' : 'text-gray-400'} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="px-3 py-4 border-t border-gray-100 shrink-0">
            <button onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <LogOut size={20} className="text-gray-400" />
              Sair
            </button>
            <VersionBadge light />
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
