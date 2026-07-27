'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center gap-1 mb-3">
            {/* Touro Nelore */}
            <svg width="72" height="60" viewBox="0 0 72 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* corpo */}
              <ellipse cx="36" cy="38" rx="22" ry="13" fill="#5a3e1b"/>
              {/* giba */}
              <ellipse cx="28" cy="26" rx="9" ry="7" fill="#5a3e1b"/>
              {/* pescoço */}
              <rect x="20" y="26" width="10" height="12" rx="4" fill="#5a3e1b"/>
              {/* cabeça */}
              <ellipse cx="16" cy="28" rx="8" ry="6" fill="#4a3010"/>
              {/* focinho */}
              <ellipse cx="9" cy="30" rx="4" ry="3" fill="#6b4c22"/>
              {/* narinas */}
              <ellipse cx="8" cy="30" rx="1" ry="0.7" fill="#3a2008"/>
              <ellipse cx="11" cy="30" rx="1" ry="0.7" fill="#3a2008"/>
              {/* olho */}
              <circle cx="14" cy="25" r="1.2" fill="#1a0f00"/>
              <circle cx="13.5" cy="24.6" r="0.4" fill="white"/>
              {/* chifres */}
              <path d="M12 22 Q8 16 4 18" stroke="#c8a265" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <path d="M20 22 Q22 15 26 17" stroke="#c8a265" strokeWidth="2" strokeLinecap="round" fill="none"/>
              {/* orelha */}
              <ellipse cx="10" cy="27" rx="3" ry="2" fill="#6b4c22" transform="rotate(-20 10 27)"/>
              {/* papo/barbela */}
              <ellipse cx="14" cy="34" rx="4" ry="3" fill="#7a5a30"/>
              {/* pernas */}
              <rect x="20" y="48" width="5" height="10" rx="2" fill="#4a3010"/>
              <rect x="28" y="49" width="5" height="9" rx="2" fill="#4a3010"/>
              <rect x="38" y="49" width="5" height="9" rx="2" fill="#4a3010"/>
              <rect x="46" y="48" width="5" height="10" rx="2" fill="#4a3010"/>
              {/* cascos */}
              <rect x="20" y="56" width="5" height="3" rx="1" fill="#2a1a00"/>
              <rect x="28" y="56" width="5" height="3" rx="1" fill="#2a1a00"/>
              <rect x="38" y="56" width="5" height="3" rx="1" fill="#2a1a00"/>
              <rect x="46" y="56" width="5" height="3" rx="1" fill="#2a1a00"/>
              {/* rabo */}
              <path d="M58 36 Q66 30 64 38 Q62 44 60 46" stroke="#5a3e1b" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <path d="M60 46 Q58 50 56 52" stroke="#3a2008" strokeWidth="3" strokeLinecap="round" fill="none"/>
            </svg>
            {/* Vaca Nelore */}
            <svg width="64" height="56" viewBox="0 0 64 56" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* corpo */}
              <ellipse cx="32" cy="36" rx="19" ry="11" fill="#b5b0a8"/>
              {/* giba menor */}
              <ellipse cx="24" cy="26" rx="7" ry="5" fill="#b5b0a8"/>
              {/* pescoço */}
              <rect x="17" y="25" width="9" height="11" rx="4" fill="#b5b0a8"/>
              {/* cabeça */}
              <ellipse cx="13" cy="26" rx="7" ry="5.5" fill="#9e9890"/>
              {/* focinho */}
              <ellipse cx="7" cy="28" rx="3.5" ry="2.5" fill="#b8b0a0"/>
              {/* narinas */}
              <ellipse cx="6" cy="28" rx="0.8" ry="0.6" fill="#6a6460"/>
              <ellipse cx="9" cy="28" rx="0.8" ry="0.6" fill="#6a6460"/>
              {/* olho */}
              <circle cx="11" cy="23" r="1.1" fill="#1a0f00"/>
              <circle cx="10.6" cy="22.6" r="0.35" fill="white"/>
              {/* chifres menores */}
              <path d="M9 20 Q6 15 3 17" stroke="#c8a265" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <path d="M17 20 Q19 14 22 16" stroke="#c8a265" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              {/* orelha */}
              <ellipse cx="8" cy="25" rx="2.5" ry="1.8" fill="#aaa098" transform="rotate(-20 8 25)"/>
              {/* barbela pequena */}
              <ellipse cx="12" cy="31" rx="3" ry="2" fill="#c0b8b0"/>
              {/* úbere */}
              <ellipse cx="32" cy="47" rx="7" ry="4" fill="#e8c8b8"/>
              {/* pernas */}
              <rect x="17" y="44" width="4" height="9" rx="2" fill="#8a8480"/>
              <rect x="24" y="45" width="4" height="8" rx="2" fill="#8a8480"/>
              <rect x="33" y="45" width="4" height="8" rx="2" fill="#8a8480"/>
              <rect x="40" y="44" width="4" height="9" rx="2" fill="#8a8480"/>
              {/* cascos */}
              <rect x="17" y="51" width="4" height="2.5" rx="1" fill="#4a4440"/>
              <rect x="24" y="51" width="4" height="2.5" rx="1" fill="#4a4440"/>
              <rect x="33" y="51" width="4" height="2.5" rx="1" fill="#4a4440"/>
              <rect x="40" y="51" width="4" height="2.5" rx="1" fill="#4a4440"/>
              {/* rabo */}
              <path d="M51 34 Q58 28 56 36 Q54 41 53 43" stroke="#b5b0a8" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <path d="M53 43 Q51 47 49 48" stroke="#8a8480" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-green-700">FazendaPro</h1>
          <p className="text-gray-500 text-sm mt-1">Gestão pecuária simplificada</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">E-mail</label>
            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Senha</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <Button
            type="submit"
            className="w-full bg-green-700 hover:bg-green-800 text-white"
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
