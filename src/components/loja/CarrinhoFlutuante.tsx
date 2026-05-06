'use client'

import { ShoppingCart } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Props {
  totalItens: number
  totalPreco: number
  onAbrir: () => void
}

export default function CarrinhoFlutuante({ totalItens, totalPreco, onAbrir }: Props) {
  if (totalItens === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <button
        onClick={onAbrir}
        className="w-full max-w-xl mx-auto bg-[#009ada] text-white rounded-2xl py-4 px-6 flex items-center justify-between shadow-lg hover:bg-[#007bb5] transition-colors active:scale-[0.98] block"
      >
        <div className="flex items-center gap-3">
          <div className="bg-white/20 rounded-lg p-1.5">
            <ShoppingCart size={20} />
          </div>
          <span className="font-semibold">
            {totalItens} {totalItens === 1 ? 'item' : 'itens'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">{formatCurrency(totalPreco)}</span>
          <span className="text-white/80 text-sm">Ver carrinho →</span>
        </div>
      </button>
    </div>
  )
}
