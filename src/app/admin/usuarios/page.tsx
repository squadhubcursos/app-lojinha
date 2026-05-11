'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Usuario } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { Plus, Pencil, UserX, UserCheck, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import ModalUsuario from '@/components/admin/ModalUsuario'
import toast from 'react-hot-toast'

export default function UsuariosPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<Usuario | null>(null)
  const [excluindo, setExcluindo] = useState(false)

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

  async function handleExcluir() {
    if (!confirmandoExclusao) return
    setExcluindo(true)
    const supabase = createClient()
    const { error } = await supabase.from('usuarios').delete().eq('id', confirmandoExclusao.id)
    if (error) {
      toast.error('Erro ao excluir usuário.')
    } else {
      toast.success('Usuário excluído.')
      fetchUsuarios()
    }
    setExcluindo(false)
    setConfirmandoExclusao(null)
  }

  function getInitials(nome: string) {
    return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {u.foto_url ? (
                            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                              <Image src={u.foto_url} alt={u.nome} width={40} height={40} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                              {getInitials(u.nome)}
                            </div>
                          )}
                          <span className="font-medium text-gray-800">{u.nome}</span>
                        </div>
                      </td>
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
                            className={`p-1.5 transition-colors ${u.ativo ? 'text-gray-400 hover:text-orange-500' : 'text-gray-400 hover:text-green-500'}`}
                          >
                            {u.ativo ? <UserX size={15} /> : <UserCheck size={15} />}
                          </button>
                          <button
                            onClick={() => setConfirmandoExclusao(u)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={15} />
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

      {/* Modal de confirmação de exclusão */}
      {confirmandoExclusao && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Excluir usuário</h3>
                <p className="text-sm text-gray-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Tem certeza que deseja excluir <span className="font-semibold text-gray-800">{confirmandoExclusao.nome}</span>? Todos os dados do usuário serão removidos permanentemente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmandoExclusao(null)}
                disabled={excluindo}
                className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleExcluir}
                disabled={excluindo}
                className="flex-1 bg-red-500 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
              >
                {excluindo ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
