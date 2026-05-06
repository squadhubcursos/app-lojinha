'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { formatCurrency, formatDate } from '@/lib/utils'
import { startOfWeek, endOfWeek, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, ShoppingCart, Package } from 'lucide-react'
import { Compra, Produto, Usuario } from '@/lib/types'

interface CompraComDetalhes extends Compra {
  produto: Produto
  usuario: Usuario
}

export default function DashboardPage() {
  const router = useRouter()
  const [compras, setCompras] = useState<CompraComDetalhes[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('isAdmin')) {
      router.replace('/admin')
      return
    }
    fetchData()
  }, [router])

  async function fetchData() {
    const supabase = createClient()
    const now = new Date()
    const inicio = startOfWeek(now, { weekStartsOn: 1 })
    const fim = endOfWeek(now, { weekStartsOn: 1 })

    const { data } = await supabase
      .from('compras')
      .select('*, produto:produtos(*), usuario:usuarios(*)')
      .gte('comprado_em', inicio.toISOString())
      .lte('comprado_em', fim.toISOString())
      .order('comprado_em', { ascending: false })

    setCompras((data ?? []) as CompraComDetalhes[])
    setLoading(false)
  }

  const totalVendido = compras.reduce((acc, c) => acc + c.preco_unit * c.quantidade, 0)
  const totalTransacoes = compras.length

  // Top produto
  const produtoMap: Record<string, { nome: string; total: number }> = {}
  compras.forEach((c) => {
    const id = c.produto_id
    if (!produtoMap[id]) produtoMap[id] = { nome: c.produto?.nome ?? id, total: 0 }
    produtoMap[id].total += c.quantidade
  })
  const topProduto = Object.values(produtoMap).sort((a, b) => b.total - a.total)[0]

  // Vendas por dia
  const diasMap: Record<string, number> = {}
  compras.forEach((c) => {
    const dia = format(new Date(c.comprado_em), 'EEE', { locale: ptBR })
    diasMap[dia] = (diasMap[dia] ?? 0) + c.preco_unit * c.quantidade
  })
  const chartData = Object.entries(diasMap).map(([dia, valor]) => ({ dia, valor }))

  // Vendas por pessoa
  const pessoaMap: Record<string, { nome: string; total: number; qtd: number }> = {}
  compras.forEach((c) => {
    const id = c.usuario_id
    if (!pessoaMap[id]) pessoaMap[id] = { nome: c.usuario?.nome ?? id, total: 0, qtd: 0 }
    pessoaMap[id].total += c.preco_unit * c.quantidade
    pessoaMap[id].qtd += c.quantidade
  })
  const pessoasOrdenadas = Object.values(pessoaMap).sort((a, b) => b.total - a.total)

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 text-sm -mt-4">Semana atual</p>

        {/* Cards de métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-50 p-2 rounded-lg">
                <TrendingUp size={20} className="text-[#009ada]" />
              </div>
              <span className="text-gray-500 text-sm">Total vendido</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{formatCurrency(totalVendido)}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-green-50 p-2 rounded-lg">
                <ShoppingCart size={20} className="text-green-500" />
              </div>
              <span className="text-gray-500 text-sm">Transações</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{totalTransacoes}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-purple-50 p-2 rounded-lg">
                <Package size={20} className="text-purple-500" />
              </div>
              <span className="text-gray-500 text-sm">Produto mais vendido</span>
            </div>
            <p className="text-xl font-bold text-gray-800 truncate">{topProduto?.nome ?? '-'}</p>
            {topProduto && <p className="text-sm text-gray-400">{topProduto.total} unid.</p>}
          </div>
        </div>

        {/* Gráfico */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-4">Vendas por dia da semana</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="valor" fill="#009ada" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabela por pessoa */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold text-gray-700 mb-4">Compras por pessoa</h2>
          {loading ? (
            <p className="text-gray-400">Carregando...</p>
          ) : pessoasOrdenadas.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhuma compra esta semana.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-gray-500 font-medium">Pessoa</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Qtd itens</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {pessoasOrdenadas.map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 font-medium text-gray-800">{p.nome}</td>
                    <td className="py-2 text-right text-gray-600">{p.qtd}</td>
                    <td className="py-2 text-right font-semibold text-gray-800">{formatCurrency(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
