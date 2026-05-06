'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Usuario } from '@/lib/types'
import { ShoppingBag } from 'lucide-react'

interface Props {
  usuarios: Usuario[]
}

function getInitials(nome: string): string {
  return nome
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

const avatarColors = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-red-500',
  'bg-indigo-500',
]

export default function IdentificacaoClient({ usuarios }: Props) {
  const router = useRouter()

  function handleSelect(usuario: Usuario) {
    localStorage.setItem('usuario_id', usuario.id)
    localStorage.setItem('usuario_nome', usuario.nome)
    router.push('/loja')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-6 flex items-center gap-3">
        <div className="bg-[#009ada] text-white p-2 rounded-lg">
          <ShoppingBag size={24} />
        </div>
        <h1 className="text-xl font-bold text-gray-800">Banquinha SquadHub</h1>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-3xl">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-2">
            Olá! Quem é você?
          </h2>
          <p className="text-gray-500 text-center mb-10">
            Selecione seu nome para acessar a lojinha
          </p>

          {usuarios.length === 0 ? (
            <p className="text-center text-gray-400">
              Nenhum usuário cadastrado. Acesse o painel admin para adicionar usuários.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {usuarios.map((usuario, index) => (
                <button
                  key={usuario.id}
                  onClick={() => handleSelect(usuario)}
                  className="flex flex-col items-center gap-3 bg-white rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200 border border-gray-100 cursor-pointer"
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold ${
                      avatarColors[index % avatarColors.length]
                    }`}
                  >
                    {getInitials(usuario.nome)}
                  </div>
                  <span className="text-sm font-semibold text-gray-700 text-center leading-tight">
                    {usuario.nome}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 flex justify-center">
        <Link
          href="/admin"
          className="text-sm text-gray-400 hover:text-[#009ada] transition-colors border border-gray-200 rounded-lg px-4 py-2 hover:border-[#009ada]"
        >
          Acesso administrativo
        </Link>
      </footer>
    </div>
  )
}
