'use client'

import { Produto } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { produtosImagens } from '@/config/produtos-imagens'
import { Beer, Cookie, Candy, CircleDot, Package, Plus, Minus } from 'lucide-react'

interface Props {
  produto: Produto
  quantidade: number
  onAdd: () => void
  onRemove: () => void
}

function CategoriaIcon({ categoria }: { categoria: string }) {
  const cls = 'w-12 h-12 text-gray-300'
  switch (categoria) {
    case 'bebida': return <Beer className={cls} />
    case 'snack': return <Cookie className={cls} />
    case 'doce': return <Candy className={cls} />
    case 'chiclete': return <CircleDot className={cls} />
    default: return <Package className={cls} />
  }
}

export default function ProdutoCard({ produto, quantidade, onAdd, onRemove }: Props) {
  const imagemUrl = produto.imagem_url || produtosImagens[produto.nome] || null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative bg-gray-50 flex items-center justify-center h-36">
        {imagemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagemUrl}
            alt={produto.nome}
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <CategoriaIcon categoria={produto.categoria} />
        )}
        {quantidade > 0 && (
          <div className="absolute top-2 right-2 bg-[#009ada] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {quantidade}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-sm font-semibold text-gray-800 leading-tight mb-1 flex-1">
          {produto.nome}
        </p>
        <p className="text-[#009ada] font-bold text-base mb-3">
          {formatCurrency(produto.preco)}
        </p>

        {/* Controls */}
        <div className="flex items-center justify-between">
          {quantidade === 0 ? (
            <button
              onClick={onAdd}
              className="flex-1 bg-[#009ada] text-white rounded-lg py-1.5 text-sm font-semibold flex items-center justify-center gap-1 hover:bg-[#007bb5] transition-colors active:scale-95"
            >
              <Plus size={16} />
              Adicionar
            </button>
          ) : (
            <div className="flex items-center gap-2 w-full justify-between">
              <button
                onClick={onRemove}
                className="bg-gray-100 text-gray-700 rounded-lg w-8 h-8 flex items-center justify-center hover:bg-gray-200 transition-colors active:scale-95"
              >
                <Minus size={16} />
              </button>
              <span className="font-bold text-gray-800 text-lg">{quantidade}</span>
              <button
                onClick={onAdd}
                className="bg-[#009ada] text-white rounded-lg w-8 h-8 flex items-center justify-center hover:bg-[#007bb5] transition-colors active:scale-95"
              >
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
