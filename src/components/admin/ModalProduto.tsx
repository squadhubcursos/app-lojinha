'use client'

import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { Produto } from '@/lib/types'
import toast from 'react-hot-toast'
import { Upload, X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  produto?: Produto | null
}

export default function ModalProduto({ open, onClose, onSaved, produto }: Props) {
  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [categoria, setCategoria] = useState('bebida')
  const [ativo, setAtivo] = useState(true)
  const [imagem, setImagem] = useState<File | null>(null)
  const [imagemPreview, setImagemPreview] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (produto) {
      setNome(produto.nome)
      setPreco(String(produto.preco))
      setCategoria(produto.categoria)
      setAtivo(produto.ativo)
      setImagemPreview(produto.imagem_url)
      setImagem(null)
    } else {
      setNome(''); setPreco(''); setCategoria('bebida'); setAtivo(true); setImagem(null); setImagemPreview(null)
    }
  }, [produto, open])

  function handleArquivo(file: File) {
    setImagem(file)
    setImagemPreview(URL.createObjectURL(file))
  }

  async function handleSalvar() {
    if (!nome || !preco) return
    setSalvando(true)
    const supabase = createClient()

    let imagem_url = produto?.imagem_url ?? null

    if (imagem) {
      const ext = imagem.name.split('.').pop()
      const fileName = `${Date.now()}.${ext}`
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('produtos')
        .upload(fileName, imagem, { upsert: true })

      if (uploadError) {
        toast.error('Erro ao fazer upload da imagem.')
        setSalvando(false)
        return
      }

      const { data: urlData } = supabase.storage.from('produtos').getPublicUrl(uploadData.path)
      imagem_url = urlData.publicUrl
    }

    const payload = { nome, preco: parseFloat(preco), categoria, ativo, imagem_url }

    if (produto) {
      const { error } = await supabase.from('produtos').update(payload).eq('id', produto.id)
      if (error) { toast.error('Erro ao atualizar produto.'); setSalvando(false); return }
      toast.success('Produto atualizado!')
    } else {
      const { error } = await supabase.from('produtos').insert(payload)
      if (error) { toast.error('Erro ao criar produto.'); setSalvando(false); return }
      toast.success('Produto criado!')
    }

    setSalvando(false)
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{produto ? 'Editar produto' : 'Novo produto'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Imagem */}
          <div>
            <Label>Imagem</Label>
            <div
              className="mt-1 border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-[#009ada] transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleArquivo(f) }}
            >
              {imagemPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagemPreview} alt="" className="h-24 object-contain rounded-lg" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setImagem(null); setImagemPreview(null) }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={24} className="text-gray-300" />
                  <p className="text-xs text-gray-400 text-center">Arraste ou clique para selecionar</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleArquivo(f) }} />
          </div>

          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1" placeholder="Nome do produto" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Preço (R$)</Label>
              <Input type="number" min="0" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} className="mt-1" placeholder="0,00" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v ?? 'bebida')}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bebida">Bebida</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                  <SelectItem value="doce">Doce</SelectItem>
                  <SelectItem value="chiclete">Chiclete</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="ativo" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="w-4 h-4 accent-[#009ada]" />
            <Label htmlFor="ativo">Produto ativo</Label>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button
              onClick={handleSalvar}
              disabled={salvando || !nome || !preco}
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
