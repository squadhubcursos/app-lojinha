'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Produto } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { produtosImagens } from '@/config/produtos-imagens'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import ModalProduto from '@/components/admin/ModalProduto'
import ModalConfirmacaoExclusao from '@/components/admin/ModalConfirmacaoExclusao'

export default function ProdutosPage() {
  const router = useRouter()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null)
  const [modalExclusao, setModalExclusao] = useState(false)
  const [produtoExcluindo, setProdutoExcluindo] = useState<Produto | null>(null)

  useEffect(() => {
    if (!localStorage.getItem('isAdmin')) { router.replace('/admin'); return }
    fetchProdutos()
  }, [router])

  async function fetchProdutos() {
    const supabase = createClient()
    const { data } = await supabase.from('produtos').select('*').order('nome')
    setProdutos(data ?? [])
    setLoading(false)
  }

  const produtosFiltrados = produtos.filter((p) => {
    const matchBusca = p.nome.toLowerCase().includes(busca.toLowerCase())
    const matchCat = categoriaFiltro === 'todos' || p.categoria === categoriaFiltro
    return matchBusca && matchCat
  })

  const categorias = [
    { value: 'todos', label: 'Todos' },
    { value: 'bebida', label: 'Bebidas' },
    { value: 'snack', label: 'Snacks' },
    { value: 'doce', label: 'Doces' },
    { value: 'chiclete', label: 'Chicletes' },
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Produtos</h1>
          <button
            onClick={() => { setProdutoEditando(null); setModalAberto(true) }}
            className="flex items-center gap-2 bg-[#009ada] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[#007bb5] transition-colors"
          >
            <Plus size={16} />
            Novo produto
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto..." className="pl-9" />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {categorias.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategoriaFiltro(c.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  categoriaFiltro === c.value ? 'bg-[#009ada] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#009ada]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-white rounded-2xl h-48 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {produtosFiltrados.map((produto) => {
              const imgSrc = produto.imagem_url || produtosImagens[produto.nome] || null
              return (
                <div key={produto.id} className={`bg-white rounded-2xl p-4 shadow-sm border flex flex-col gap-2 ${!produto.ativo ? 'opacity-60' : ''}`}>
                  <div className="bg-gray-50 rounded-xl h-28 flex items-center justify-center overflow-hidden">
                    {imgSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgSrc} alt={produto.nome} className="h-full w-full object-contain p-2" />
                    ) : (
                      <span className="text-gray-300 text-xs">Sem imagem</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 leading-tight">{produto.nome}</p>
                  <p className="text-[#009ada] font-bold text-sm">{formatCurrency(produto.preco)}</p>
                  <div className="flex items-center justify-between">
                    <Badge variant={produto.ativo ? 'default' : 'secondary'} className={produto.ativo ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                      {produto.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setProdutoEditando(produto); setModalAberto(true) }}
                        className="p-1.5 text-gray-400 hover:text-[#009ada] transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => { setProdutoExcluindo(produto); setModalExclusao(true) }}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ModalProduto
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        onSaved={fetchProdutos}
        produto={produtoEditando}
      />
      <ModalConfirmacaoExclusao
        open={modalExclusao}
        onClose={() => setModalExclusao(false)}
        onDeleted={fetchProdutos}
        produto={produtoExcluindo}
      />
    </AdminLayout>
  )
}
