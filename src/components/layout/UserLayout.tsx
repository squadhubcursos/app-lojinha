'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShoppingBag, LogOut, History } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

export default function UserLayout({ children }: Props) {
  const [nomeUsuario, setNomeUsuario] = useState('')
  const router = useRouter()

  useEffect(() => {
    const nome = localStorage.getItem('usuario_nome') || ''
    setNomeUsuario(nome)
  }, [])

  function handleLogout() {
    localStorage.removeItem('usuario_id')
    localStorage.removeItem('usuario_nome')
    router.push('/identificacao')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm py-3 px-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="bg-[#009ada] text-white p-1.5 rounded-lg">
            <ShoppingBag size={20} />
          </div>
          <span className="font-bold text-gray-800 text-sm sm:text-base">Banquinha SquadHub</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 hidden sm:block">
            Olá, <span className="font-semibold">{nomeUsuario}</span>
          </span>
          <Link
            href="/historico"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#009ada] transition-colors"
          >
            <History size={18} />
            <span className="hidden sm:inline">Histórico</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  )
}
