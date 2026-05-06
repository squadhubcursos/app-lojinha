'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { Usuario } from '@/lib/types'
import toast from 'react-hot-toast'
import bcrypt from 'bcryptjs'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  usuario?: Usuario | null
}

export default function ModalUsuario({ open, onClose, onSaved, usuario }: Props) {
  const [nome, setNome] = useState('')
  const [perfil, setPerfil] = useState<'usuario' | 'admin'>('usuario')
  const [senha, setSenha] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (usuario) {
      setNome(usuario.nome)
      setPerfil(usuario.perfil)
      setAtivo(usuario.ativo)
      setSenha('')
    } else {
      setNome(''); setPerfil('usuario'); setSenha(''); setAtivo(true)
    }
  }, [usuario, open])

  async function handleSalvar() {
    if (!nome) return
    setSalvando(true)
    const supabase = createClient()

    const payload: Record<string, unknown> = { nome, perfil, ativo }

    if (perfil === 'admin' && senha) {
      payload.senha_hash = await bcrypt.hash(senha, 10)
    }

    if (usuario) {
      const { error } = await supabase.from('usuarios').update(payload).eq('id', usuario.id)
      if (error) { toast.error('Erro ao atualizar usuário.'); setSalvando(false); return }
      toast.success('Usuário atualizado!')
    } else {
      const { error } = await supabase.from('usuarios').insert(payload)
      if (error) { toast.error('Erro ao criar usuário.'); setSalvando(false); return }
      toast.success('Usuário criado!')
    }

    setSalvando(false)
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{usuario ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1" placeholder="Nome completo" />
          </div>

          <div>
            <Label>Perfil</Label>
            <Select value={perfil} onValueChange={(v) => setPerfil(v as 'usuario' | 'admin')}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usuario">Usuário</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {perfil === 'admin' && (
            <div>
              <Label>{usuario ? 'Nova senha (deixe em branco para manter)' : 'Senha'}</Label>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="mt-1" placeholder="Senha" />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="checkbox" id="ativo_u" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="w-4 h-4 accent-[#009ada]" />
            <Label htmlFor="ativo_u">Usuário ativo</Label>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button
              onClick={handleSalvar}
              disabled={salvando || !nome}
              className="flex-1 bg-[#009ada] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#007bb5] disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
