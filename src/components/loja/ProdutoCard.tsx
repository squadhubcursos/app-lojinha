'use client'

import { Produto } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { produtosImagens } from '@/config/produtos-imagens'
import { Beer, Cookie, Candy, CircleDot, Package, Plus, Minus, Star, Ban } from 'lucide-react'

interface Props {
  produto: Produto
  quantidade: number
  onAdd: () => void
  onRemove: () => void
  preferido?: boolean
  esgotado?: boolean
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

export default function ProdutoCard({ produto, quantidade, onAdd, onRemove, preferido, esgotado }: Props) {
  const imagemUrl = produto.imagem_url || produtosImagens[produto.nome] || null

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-shadow ${esgotado ? 'border-gray-200 opacity-60' : 'border-gray-100 hover:shadow-md'}`}>
      {/* Image */}
      <div className="relative bg-gray-50 flex items-center justify-center h-36">
        {imagemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagemUrl}
            alt={produto.nome}
            className={`h-full w-full object-contain p-2 ${esgotado ? 'grayscale' : ''}`}
          />
        ) : (
          <CategoriaIcon categoria={produto.categoria} />
        )}
        {quantidade > 0 && !esgotado && (
          <div className="absolute top-2 right-2 bg-[#009ada] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {quantidade}
          </div>
        )}
        {esgotado && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40">
            <div className="flex flex-col items-center gap-1">
              <Ban size={28} className="text-gray-400" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Esgotado</span>
            </div>
          </div>
        )}
        {preferido && !esgotado && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-blue-600 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
            <Star size={10} className="fill-white" />
            Preferidos por você
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-sm font-semibold text-gray-800 leading-tight mb-1 flex-1">
          {produto.nome}
        </p>
        <p className={`font-bold text-base mb-3 ${esgotado ? 'text-gray-400' : 'text-[#009ada]'}`}>
          {formatCurrency(produto.preco)}
        </p>

        {/* Controls */}
        <div className="flex items-center justify-between">
          {esgotado ? (
            <div className="flex-1 bg-gray-100 text-gray-400 rounded-lg py-1.5 text-sm font-semibold flex items-center justify-center gap-1 cursor-not-allowed">
              Indisponível
            </div>
          ) : quantidade === 0 ? (
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