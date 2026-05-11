'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { Usuario } from '@/lib/types'
import toast from 'react-hot-toast'
import bcrypt from 'bcryptjs'
import { Camera } from 'lucide-react'

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
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (usuario) {
      setNome(usuario.nome)
      setPerfil(usuario.perfil)
      setAtivo(usuario.ativo)
      setSenha('')
      setFotoPreview(usuario.foto_url ?? null)
      setFotoFile(null)
    } else {
      setNome(''); setPerfil('usuario'); setSenha(''); setAtivo(true)
      setFotoPreview(null); setFotoFile(null)
    }
  }, [usuario, open])

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  async function uploadFoto(file: File, usuarioId: string): Promise<string | null> {
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${usuarioId}.${ext}`
    const { error } = await supabase.storage.from('usuarios-fotos').upload(path, file, { upsert: true })
    if (error) { toast.error('Erro ao enviar foto.'); return null }
    const { data } = supabase.storage.from('usuarios-fotos').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSalvar() {
    if (!nome) return
    setSalvando(true)
    const supabase = createClient()

    const payload: Record<string, unknown> = { nome, perfil, ativo }

    if (perfil === 'admin' && senha) {
      payload.senha_hash = await bcrypt.hash(senha, 10)
    }

    if (usuario) {
      if (fotoFile) {
        const url = await uploadFoto(fotoFile, usuario.id)
        if (url) payload.foto_url = url
      }
      const { error } = await supabase.from('usuarios').update(payload).eq('id', usuario.id)
      if (error) { toast.error('Erro ao atualizar usuário.'); setSalvando(false); return }
      toast.success('Usuário atualizado!')
    } else {
      const { data, error } = await supabase.from('usuarios').insert(payload).select().single()
      if (error || !data) { toast.error('Erro ao criar usuário.'); setSalvando(false); return }
      if (fotoFile) {
        const url = await uploadFoto(fotoFile, data.id)
        if (url) {
          await supabase.from('usuarios').update({ foto_url: url }).eq('id', data.id)
        }
      }
      toast.success('Usuário criado!')
    }

    setSalvando(false)
    onSaved()
    onClose()
  }

  function getInitials(n: string) {
    return n.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{usuario ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Foto */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-dashed border-gray-300 hover:border-[#009ada] transition-colors group"
            >
              {fotoPreview ? (
                <Image src={fotoPreview} alt="Foto" fill className="object-cover object-top" />
              ) : (
                <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-400 group-hover:text-[#009ada]">
                  {nome ? (
                    <span className="text-lg font-bold">{getInitials(nome)}</span>
                  ) : (
                    <Camera size={24} />
                  )}
                </div>
              )}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera size={18} className="text-white" />
              </div>
            </button>
            <span className="text-xs text-gray-400">Clique para adicionar foto</span>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
          </div>

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
