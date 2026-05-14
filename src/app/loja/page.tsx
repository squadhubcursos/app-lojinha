'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { Produto, ItemCarrinho } from '@/lib/types'
import UserLayout from '@/components/layout/UserLayout'
import ProdutoCard from '@/components/loja/ProdutoCard'
import FiltroCategoria from '@/components/loja/FiltroCategoria'
import CarrinhoFlutuante from '@/components/loja/CarrinhoFlutuante'
import Carrinho from '@/components/loja/Carrinho'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'

export default function LojaPage() {
  const router = useRouter()
  const [usuarioId, setUsuarioId] = useState('')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos')
  const [carrinhoAberto, setCarrinhoAberto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const uid = localStorage.getItem('usuario_id')
    if (!uid) { router.replace('/identificacao'); return }
    setUsuarioId(uid)

    async function fetchProdutos() {
      const supabase = createClient()
      const { data } = await supabase
        .from('produtos')
        .select('*')
        .eq('ativo', true)
        .order('categoria')
        .order('nome')
      setProdutos(data ?? [])
      setLoading(false)
    }
    fetchProdutos()
  }, [router])

  const produtosFiltrados = categoriaAtiva === 'todos'
    ? produtos
    : produtos.filter((p) => p.categoria === categoriaAtiva)

  function getQuantidade(produtoId: string): number {
    return carrinho.find((i) => i.produto.id === produtoId)?.quantidade ?? 0
  }

  function handleAdd(produto: Produto) {
    setCarrinho((prev) => {
      const existing = prev.find((i) => i.produto.id === produto.id)
      if (existing) {
        return prev.map((i) => i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      }
      return [...prev, { produto, quantidade: 1 }]
    })
  }

  function handleRemove(produtoId: string) {
    setCarrinho((prev) => {
      const existing = prev.find((i) => i.produto.id === produtoId)
      if (!existing) return prev
      if (existing.quantidade === 1) return prev.filter((i) => i.produto.id !== produtoId)
      return prev.map((i) => i.produto.id === produtoId ? { ...i, quantidade: i.quantidade - 1 } : i)
    })
  }

  const handleConfirmar = useCallback(async () => {
    if (!usuarioId || carrinho.length === 0) return
    setConfirmando(true)
    const supabase = createClient()

    try {
      const agora = new Date().toISOString()

      const comprasData = carrinho.map((item) => ({
        usuario_id: usuarioId,
        produto_id: item.produto.id,
        quantidade: item.quantidade,
        preco_unit: item.produto.preco,
        comprado_em: agora,
      }))

      const { error: comprasError } = await supabase.from('compras').insert(comprasData)
      if (comprasError) throw comprasError

      const movimentacoes = carrinho.map((item) => ({
        produto_id: item.produto.id,
        tipo: 'saida_lojinha' as const,
        quantidade: item.quantidade,
        custo_unit: null,
        observacao: 'Venda lojinha',
        usuario_id: usuarioId,
        registrado_em: agora,
      }))

      const { error: movError } = await supabase.from('estoque_movimentacoes').insert(movimentacoes)
      if (movError) throw movError

      localStorage.setItem('ultimo_pedido', JSON.stringify(carrinho))
      localStorage.setItem('ultimo_pedido_horario', agora)
      setCarrinho([])
      setCarrinhoAberto(false)
      router.push('/pedido-confirmado')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao confirmar compra. Tente novamente.')
    } finally {
      setConfirmando(false)
    }
  }, [usuarioId, carrinho, router])

  const totalItens = carrinho.reduce((acc, i) => acc + i.quantidade, 0)
  const totalPreco = carrinho.reduce((acc, i) => acc + i.produto.preco * i.quantidade, 0)

  return (
    <UserLayout>
      <div className="p-4 max-w-5xl mx-auto pb-28">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Lojinha</h2>

        <div className="mb-6">
          <FiltroCategoria categoriaAtiva={categoriaAtiva} onChange={setCategoriaAtiva} />
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-56 animate-pulse" />
            ))}
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <p className="text-center text-gray-400 py-10">Nenhum produto disponivel nesta categoria.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {produtosFiltrados.map((produto) => (
              <ProdutoCard
                key={produto.id}
                produto={produto}
                quantidade={getQuantidade(produto.id)}
                onAdd={() => handleAdd(produto)}
                onRemove={() => handleRemove(produto.id)}
              />
            ))}
          </div>
        )}
      </div>

      <CarrinhoFlutuante totalItens={totalItens} totalPreco={totalPreco} onAbrir={() => setCarrinhoAberto(true)} />

      <Drawer open={carrinhoAberto} onOpenChange={setCarrinhoAberto}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Seu carrinho</DrawerTitle>
          </DrawerHeader>
          <Carrinho
            itens={carrinho}
            onAdd={(id) => { const prod = produtos.find((p) => p.id === id); if (prod) handleAdd(prod) }}
            onRemove={handleRemove}
            onConfirmar={handleConfirmar}
            onFechar={() => setCarrinhoAberto(false)}
            confirmando={confirmando}
          />
        </DrawerContent>
      </Drawer>
    </UserLayout>
  )
}
