'use client'

import { cn } from '@/lib/utils'

interface Props {
  categoriaAtiva: string
  onChange: (categoria: string) => void
}

const categorias = [
  { value: 'todos', label: 'Todos' },
  { value: 'bebida', label: 'Bebidas' },
  { value: 'snack', label: 'Snacks' },
  { value: 'doce', label: 'Doces' },
  { value: 'chiclete', label: 'Chicletes' },
]

export default function FiltroCategoria({ categoriaAtiva, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {categorias.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onChange(cat.value)}
          className={cn(
            'px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0',
            categoriaAtiva === cat.value
              ? 'bg-[#009ada] text-white shadow-sm'
              : 'border border-gray-300 text-gray-600 hover:border-[#009ada] hover:text-[#009ada]'
          )}
        >
          {cat.label}
        </button>
      ))}
    </div>
  )
}
