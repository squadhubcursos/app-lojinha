'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, ShoppingBag, ArrowLeft } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ItemCarrinho } from '@/lib/types'

export default function PedidoConfirmadoPage() {
  const router = useRouter()
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [itens, setItens] = useState<ItemCarrinho[]>([])
  const [horario, setHorario] = useState('')

  useEffect(() => {
    const nome = localStorage.getItem('usuario_nome') ?? ''
    const pedidoRaw = localStorage.getItem('ultimo_pedido')
    const horarioRaw = localStorage.getItem('ultimo_pedido_horario')

    if (!nome || !pedidoRaw) {
      router.replace('/identificacao')
      return
    }

    setNomeUsuario(nome)
    setItens(JSON.parse(pedidoRaw))
    setHorario(horarioRaw ?? new Date().toISOString())
  }, [router])

  const total = itens.reduce((acc, i) => acc + i.produto.preco * i.quantidade, 0)

  function handleNovaCompra() {
    localStorage.removeItem('usuario_id')
    localStorage.removeItem('usuario_nome')
    localStorage.removeItem('ultimo_pedido')
    localStorage.removeItem('ultimo_pedido_horario')
    router.push('/identificacao')
  }

  if (!nomeUsuario) return null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm overflow-hidden">

        {/* Header verde de sucesso */}
        <div className="bg-[#009ada] px-6 pt-10 pb-8 flex flex-col items-center text-white">
          <div className="bg-white/20 rounded-full p-4 mb-4">
            <CheckCircle size={48} className="text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-center">Compra registrada!</h1>
          <p className="text-white/80 text-sm mt-1 text-center">
            Obrigado, <span className="font-semibold text-white">{nomeUsuario.split(' ')[0]}</span>! Seu pedido foi anotado.
          </p>
        </div>

        {/* Resumo do pedido */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">Resumo do pedido</span>
            <span className="text-xs text-gray-400">{formatDate(horario)} · {new Date(horario).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <div className="space-y-3">
            {itens.map((item) => (
              <div key={item.produto.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="bg-gray-100 text-gray-600 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {item.quantidade}
                  </span>
                  <span className="text-sm text-gray-700">{item.produto.nome}</span>
                </div>
                <span className="text-sm font-medium text-gray-800">
                  {formatCurrency(item.produto.preco * item.quantidade)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed mt-4 pt-4 flex items-center justify-between">
            <span className="font-semibold text-gray-700">Total</span>
            <span className="text-lg font-bold text-[#009ada]">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Botões */}
        <div className="px-6 pb-6 space-y-3">
          <button
            onClick={handleNovaCompra}
            className="w-full flex items-center justify-center gap-2 bg-[#009ada] text-white font-semibold rounded-2xl py-4 text-base hover:bg-[#007bb5] transition-colors"
          >
            <ShoppingBag size={18} />
            Iniciar nova compra
          </button>
          <button
            onClick={() => router.push('/historico')}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 font-medium rounded-2xl py-3.5 text-sm hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={16} />
            Ver meu histórico
          </button>
        </div>
      </div>
    </div>
  )
}
