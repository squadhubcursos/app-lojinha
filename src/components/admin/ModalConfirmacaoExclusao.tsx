'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { Produto } from '@/lib/types'
import toast from 'react-hot-toast'
import { AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onDeleted: () => void
  produto: Produto | null
}

export default function ModalConfirmacaoExclusao({ open, onClose, onDeleted, produto }: Props) {
  const [temCompras, setTemCompras] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [executando, setExecutando] = useState(false)

  useEffect(() => {
    if (open && produto) {
      setCarregando(true)
      const supabase = createClient()
      supabase
        .from('compras')
        .select('id', { count: 'exact', head: true })
        .eq('produto_id', produto.id)
        .then(({ count }) => {
          setTemCompras((count ?? 0) > 0)
          setCarregando(false)
        })
    }
  }, [open, produto])

  async function handleDesativar() {
    if (!produto) return
    setExecutando(true)
    const supabase = createClient()
    const { error } = await supabase.from('produtos').update({ ativo: false }).eq('id', produto.id)
    if (error) { toast.error('Erro ao desativar produto.') }
    else { toast.success('Produto desativado!'); onDeleted() }
    setExecutando(false)
    onClose()
  }

  async function handleExcluir() {
    if (!produto) return
    setExecutando(true)
    const supabase = createClient()
    const { error } = await supabase.from('produtos').delete().eq('id', produto.id)
    if (error) { toast.error('Erro ao excluir produto.') }
    else { toast.success('Produto excluído!'); onDeleted() }
    setExecutando(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remover produto</DialogTitle>
        </DialogHeader>

        {carregando ? (
          <p className="text-gray-400 text-sm py-4">Verificando...</p>
        ) : (
          <div className="space-y-4 mt-2">
            {temCompras ? (
              <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 text-sm">Produto tem histórico de compras</p>
                  <p className="text-amber-600 text-xs mt-1">
                    Não é possível excluir. O produto será desativado e não aparecerá na loja.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-600 text-sm">
                Tem certeza que deseja excluir <span className="font-semibold">{produto?.nome}</span>? Esta ação não pode ser desfeita.
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              {temCompras ? (
                <button
                  onClick={handleDesativar}
                  disabled={executando}
                  className="flex-1 bg-amber-500 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-amber-600 disabled:opacity-50"
                >
                  {executando ? 'Desativando...' : 'Desativar'}
                </button>
              ) : (
                <button
                  onClick={handleExcluir}
                  disabled={executando}
                  className="flex-1 bg-red-500 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
                >
                  {executando ? 'Excluindo...' : 'Excluir'}
                </button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
