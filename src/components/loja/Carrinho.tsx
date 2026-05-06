'use client'

import { ItemCarrinho } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Minus, Plus, Trash2 } from 'lucide-react'

interface Props {
  itens: ItemCarrinho[]
  onAdd: (produtoId: string) => void
  onRemove: (produtoId: string) => void
  onConfirmar: () => void
  onFechar: () => void
  confirmando: boolean
}

export default function Carrinho({ itens, onAdd, onRemove, onConfirmar, onFechar, confirmando }: Props) {
  const total = itens.reduce((acc, item) => acc + item.produto.preco * item.quantidade, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {itens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p>Seu carrinho está vazio</p>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {itens.map((item) => (
              <div
                key={item.produto.id}
                className="flex items-center gap-3 bg-gray-50 rounded-xl p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {item.produto.nome}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(item.produto.preco)} cada
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onRemove(item.produto.id)}
                    className="bg-white border border-gray-200 rounded-lg w-7 h-7 flex items-center justify-center hover:bg-gray-100 active:scale-95"
                  >
                    {item.quantidade === 1 ? <Trash2 size={13} className="text-red-400" /> : <Minus size={13} />}
                  </button>
                  <span className="w-6 text-center font-bold text-sm">{item.quantidade}</span>
                  <button
                    onClick={() => onAdd(item.produto.id)}
                    className="bg-[#009ada] text-white rounded-lg w-7 h-7 flex items-center justify-center hover:bg-[#007bb5] active:scale-95"
                  >
                    <Plus size={13} />
                  </button>
                </div>
                <div className="text-right min-w-[60px]">
                  <p className="text-sm font-bold text-gray-800">
                    {formatCurrency(item.produto.preco * item.quantidade)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-700">Total</span>
          <span className="font-bold text-xl text-[#009ada]">{formatCurrency(total)}</span>
        </div>
        <button
          onClick={onConfirmar}
          disabled={itens.length === 0 || confirmando}
          className="w-full bg-[#009ada] text-white rounded-xl py-3 font-bold text-base hover:bg-[#007bb5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {confirmando ? 'Confirmando...' : 'Confirmar compra'}
        </button>
        <button
          onClick={onFechar}
          className="w-full text-gray-500 text-sm hover:text-gray-700"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}
