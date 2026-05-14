'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Compra } from '@/lib/types'
import UserLayout from '@/components/layout/UserLayout'
import { formatCurrency, formatDate, formatTime } from '@/lib/utils'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function HistoricoPage() {
  const router = useRouter()
  const [compras, setCompras] = useState<Compra[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const uid = localStorage.getItem('usuario_id')
    if (!uid) { router.replace('/identificacao'); return }

    async function fetchCompras() {
      const supabase = createClient()
      const { data } = await supabase
        .from('compras')
        .select('*, produto:produtos(*)')
        .eq('usuario_id', uid)
        .order('comprado_em', { ascending: false })
      setCompras(data ?? [])
      setLoading(false)
    }
    fetchCompras()
  }, [router])

  function filtrarPorPeriodo(periodo: string): Compra[] {
    const now = new Date()
    let inicio: Date
    let fim: Date

    if (periodo === 'semana') {
      inicio = startOfWeek(now, { weekStartsOn: 6 })
      fim = endOfWeek(now, { weekStartsOn: 6 })
    } else if (periodo === 'mes_atual') {
      inicio = startOfMonth(now)
      fim = endOfMonth(now)
    } else {
      const mesPassado = subMonths(now, 1)
      inicio = startOfMonth(mesPassado)
      fim = endOfMonth(mesPassado)
    }

    return compras.filter((c) => {
      const d = new Date(c.comprado_em)
      return d >= inicio && d <= fim
    })
  }

  function calcularTotal(lista: Compra[]): number {
    return lista.reduce((acc, c) => acc + c.preco_unit * c.quantidade, 0)
  }

  function TabelaCompras({ lista }: { lista: Compra[] }) {
    if (lista.length === 0) {
      return <p className="text-center text-gray-400 py-8">Nenhuma compra neste periodo.</p>
    }

    const total = calcularTotal(lista)

    return (
      <div>
        <div className="bg-[#009ada]/10 rounded-xl p-4 mb-4 flex items-center justify-between">
          <span className="text-gray-600 font-medium">Total do periodo</span>
          <span className="text-[#009ada] font-bold text-xl">{formatCurrency(total)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Data</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Horario</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Produto</th>
                <th className="text-center py-2 px-3 text-gray-500 font-medium">Qtd</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Unit.</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((compra) => (
                <tr key={compra.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{formatDate(compra.comprado_em)}</td>
                  <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{formatTime(compra.comprado_em)}</td>
                  <td className="py-2 px-3 font-medium text-gray-800">{compra.produto?.nome}</td>
                  <td className="py-2 px-3 text-center text-gray-600">{compra.quantidade}</td>
                  <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(compra.preco_unit)}</td>
                  <td className="py-2 px-3 text-right font-semibold text-gray-800">
                    {formatCurrency(compra.preco_unit * compra.quantidade)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <UserLayout>
      <div className="p-4 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Meu historico</h2>

        {loading ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl h-12" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="semana">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="semana" className="flex-1">Esta semana</TabsTrigger>
              <TabsTrigger value="mes_atual" className="flex-1">Este mes</TabsTrigger>
              <TabsTrigger value="mes_anterior" className="flex-1">Mes anterior</TabsTrigger>
            </TabsList>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <TabsContent value="semana">
                <TabelaCompras lista={filtrarPorPeriodo('semana')} />
              </TabsContent>
              <TabsContent value="mes_atual">
                <TabelaCompras lista={filtrarPorPeriodo('mes_atual')} />
              </TabsContent>
              <TabsContent value="mes_anterior">
                <TabelaCompras lista={filtrarPorPeriodo('mes_anterior')} />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </div>
    </UserLayout>
  )
}
