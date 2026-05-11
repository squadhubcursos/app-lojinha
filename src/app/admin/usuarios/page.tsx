'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Usuario } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { Plus, Pencil, UserX, UserCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import ModalUsuario from '@/components/admin/ModalUsuario'
import toast from 'react-hot-toast'

export default function UsuariosPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null)

  useEffect(() => {
    if (!localStorage.getItem('isAdmin')) { router.replace('/admin'); return }
    fetchUsuarios()
  }, [router])

  async function fetchUsuarios() {
    const supabase = createClient()
    const { data } = await supabase.from('usuarios').select('*').order('nome')
    setUsuarios(data ?? [])
    setLoading(false)
  }

  async function toggleAtivo(usuario: Usuario) {
    const supabase = createClient()
    const { error } = await supabase.from('usuarios').update({ ativo: !usuario.ativo }).eq('id', usuario.id)
    if (error) { toast.error('Erro ao alterar status.') }
    else { toast.success(usuario.ativo ? 'Usuário desativado.' : 'Usuário ativado.'); fetchUsuarios() }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Usuários</h1>
          <button
            onClick={() => { setUsuarioEditando(null); setModalAberto(true) }}
            className="flex items-center gap-2 bg-[#009ada] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[#007bb5] transition-colors"
          >
            <Plus size={16} />
            Novo usuário
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Nome</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Perfil</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Criado em</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{u.nome}</td>
                      <td className="px-4 py-3">
                        <Badge variant={u.perfil === 'admin' ? 'default' : 'secondary'} className={u.perfil === 'admin' ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' : ''}>
                          {u.perfil === 'admin' ? 'Admin' : 'Usuário'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.ativo ? 'default' : 'secondary'} className={u.ativo ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(u.criado_em)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => { setUsuarioEditando(u); setModalAberto(true) }}
                            className="p-1.5 text-gray-400 hover:text-[#009ada] transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => toggleAtivo(u)}
                            className={`p-1.5 transition-colors ${u.ativo ? 'text-gray-400 hover:text-red-500' : 'text-gray-400 hover:text-green-500'}`}
                          >
                            {u.ativo ? <UserX size={15} /> : <UserCheck size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ModalUsuario
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        onSaved={fetchUsuarios}
        usuario={usuarioEditando}
      />
    </AdminLayout>
  )
}
