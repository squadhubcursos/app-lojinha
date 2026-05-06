'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShoppingBag, Lock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import toast from 'react-hot-toast'
import bcrypt from 'bcryptjs'

export default function AdminLoginPage() {
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!senha) return
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: admins } = await supabase
        .from('usuarios')
        .select('*')
        .eq('perfil', 'admin')
        .eq('ativo', true)

      if (!admins || admins.length === 0) {
        toast.error('Nenhum administrador cadastrado.')
        setLoading(false)
        return
      }

      let adminEncontrado = null
      for (const admin of admins) {
        if (admin.senha_hash) {
          const valido = await bcrypt.compare(senha, admin.senha_hash)
          if (valido) {
            adminEncontrado = admin
            break
          }
        }
      }

      if (!adminEncontrado) {
        toast.error('Senha incorreta.')
        setLoading(false)
        return
      }

      localStorage.setItem('isAdmin', 'true')
      localStorage.setItem('admin_nome', adminEncontrado.nome)
      router.push('/admin/dashboard')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao fazer login.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-[#009ada] text-white p-3 rounded-2xl mb-4">
            <ShoppingBag size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Acesso Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Banquinha SquadHub</p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="senha">Senha de administrador</Label>
            <div className="relative mt-1">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Digite a senha"
                className="pl-9"
              />
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading || !senha}
            className="w-full bg-[#009ada] text-white rounded-lg py-2.5 font-semibold hover:bg-[#007bb5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </div>

        <div className="mt-6 text-center">
          <a href="/identificacao" className="text-sm text-gray-400 hover:text-gray-600">
            ← Voltar para seleção de usuário
          </a>
        </div>
      </div>
    </div>
  )
}
