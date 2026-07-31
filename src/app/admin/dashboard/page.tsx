'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import FiltroPeriodo, { PresetPeriodo, periodoDoPreset, rotuloPeriodo } from '@/components/admin/FiltroPeriodo'
import { formatCurrency } from '@/lib/utils'
import { calcularMetricas } from '@/lib/metricas'
import { Compra, EstoqueMovimentacao, Produto, Usuario, InventarioContagem } from '@/lib/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, Wallet, PiggyBank, ShoppingBasket, AlertTriangle } from 'lucide-react'

interface CompraComDetalhes extends Compra {
  produto: Produto
  usuario: Usuario
}

type EntradaCusto = Pick<EstoqueMovimentacao, 'produto_id' | 'tipo' | 'quantidade' | 'custo_unit'> & {
  registrado_em: string
}

function formatPercent(v: number | null): string {
  return v == null ? '—' : `${(v * 100).toFixed(1).replace('.', ',')}%`
}

export default function DashboardPage() {
  const router = useRouter()
  const [preset, setPreset] = useState<PresetPeriodo>('semana')
  const [dataInicio, setDataInicio] = useState(() => format(periodoDoPreset('semana').inicio, 'yyyy-MM-dd'))
  const [dataFim, setDataFim] = useState(() => format(periodoDoPreset('semana').fim, 'yyyy-MM-dd'))

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [entradasTodas, setEntradasTodas] = useState<EntradaCusto[]>([])
  const [compras, setCompras] = useState<CompraComDetalhes[]>([])
  const [contagens, setContagens] = useState<InventarioContagem[]>([])
  const [loading, setLoading] = useState(true)

  const periodo = useMemo(() => {
    if (preset !== 'personalizado') return periodoDoPreset(preset)
    return {
      inicio: new Date(`${dataInicio}T00:00:00`),
      fim: new Date(`${dataFim}T23:59:59`),
    }
  }, [preset, dataInicio, dataFim])

  function handlePreset(p: PresetPeriodo) {
    setPreset(p)
    if (p !== 'personalizado') {
      const { inicio, fim } = periodoDoPreset(p)
      setDataInicio(format(inicio, 'yyyy-MM-dd'))
      setDataFim(format(fim, 'yyyy-MM-dd'))
    }
  }

  // Custo medio usa todo o historico de entradas, nao so o do periodo
  const fetchBase = useCallback(async () => {
    const supabase = createClient()
    const [{ data: prods }, { data: entradas }] = await Promise.all([
      supabase.from('produtos').select('*'),
      supabase
        .from('estoque_movimentacoes')
        .select('produto_id, tipo, quantidade, custo_unit, registrado_em')
        .eq('tipo', 'entrada_estoque'),
    ])
    setProdutos(prods ?? [])
    setEntradasTodas((entradas ?? []) as EntradaCusto[])
  }, [])

  const fetchPeriodo = useCallback(async () => {
    if (Number.isNaN(periodo.inicio.getTime()) || Number.isNaN(periodo.fim.getTime())) return
    setLoading(true)
    const supabase = createClient()
    const inicio = periodo.inicio.toISOString()
    const fim = periodo.fim.toISOString()

    const [{ data: comprasData }, { data: contagensData }] = await Promise.all([
      supabase
        .from('compras')
        .select('*, produto:produtos(*), usuario:usuarios(*)')
        .gte('comprado_em', inicio)
        .lte('comprado_em', fim)
        .order('comprado_em', { ascending: false }),
      supabase
        .from('inventario_contagens')
        .select('*')
        .eq('contexto', 'lojinha')
        .lt('divergencia', 0)
        .gte('contado_em', inicio)
        .lte('contado_em', fim),
    ])

    setCompras((comprasData ?? []) as CompraComDetalhes[])
    setContagens((contagensData ?? []) as InventarioContagem[])
    setLoading(false)
  }, [periodo])

  useEffect(() => {
    if (!localStorage.getItem('isAdmin')) { router.replace('/admin'); return }
    fetchBase()
  }, [router, fetchBase])

  useEffect(() => {
    fetchPeriodo()
  }, [fetchPeriodo])

  const metricas = useMemo(() => {
    const dentroDoPeriodo = entradasTodas.filter((e) => {
      const d = new Date(e.registrado_em)
      return d >= periodo.inicio && d <= periodo.fim
    })
    return calcularMetricas({
      compras,
      entradasTodas,
      entradasPeriodo: dentroDoPeriodo,
      contagens,
      produtos,
    })
  }, [compras, entradasTodas, contagens, produtos, periodo])

  // Vendas por dia
  const chartData = useMemo(() => {
    const dias: Record<string, number> = {}
    for (const c of compras) {
      const dia = format(new Date(c.comprado_em), 'dd/MM', { locale: ptBR })
      dias[dia] = (dias[dia] ?? 0) + Number(c.preco_unit) * c.quantidade
    }
    return Object.entries(dias)
      .map(([dia, valor]) => ({ dia, valor }))
      .reverse()
  }, [compras])

  // Compras por pessoa
  const pessoas = useMemo(() => {
    const mapa: Record<string, { nome: string; total: number; qtd: number }> = {}
    for (const c of compras) {
      const p = (mapa[c.usuario_id] ??= { nome: c.usuario?.nome ?? c.usuario_id, total: 0, qtd: 0 })
      p.total += Number(c.preco_unit) * c.quantidade
      p.qtd += c.quantidade
    }
    return Object.values(mapa).sort((a, b) => b.total - a.total)
  }, [compras])

  const produtosNoPrejuizo = metricas.porProduto.filter(
    (l) => !l.semCusto && l.quantidade > 0 && l.margem != null && l.margem < 0
  )

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{rotuloPeriodo(periodo)}</p>
        </div>

        <FiltroPeriodo
          preset={preset}
          onPreset={handlePreset}
          dataInicio={dataInicio}
          dataFim={dataFim}
          onDataInicio={setDataInicio}
          onDataFim={setDataFim}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <Card
            icone={<TrendingUp size={20} className="text-[#009ada]" />}
            cor="bg-blue-50"
            titulo="Receita"
            valor={formatCurrency(metricas.receita)}
            rodape={`${metricas.transacoes} transacoes`}
          />
          <Card
            icone={<Wallet size={20} className="text-orange-500" />}
            cor="bg-orange-50"
            titulo="Custo do vendido"
            valor={formatCurrency(metricas.cmv)}
            rodape="CMV pelo custo medio"
          />
          <Card
            icone={<PiggyBank size={20} className="text-green-500" />}
            cor="bg-green-50"
            titulo="Lucro bruto"
            valor={formatCurrency(metricas.lucro)}
            rodape={`Margem ${formatPercent(metricas.margem)}`}
            destaque={metricas.lucro < 0 ? 'text-red-600' : 'text-gray-800'}
          />
          <Card
            icone={<ShoppingBasket size={20} className="text-purple-500" />}
            cor="bg-purple-50"
            titulo="Compras no periodo"
            valor={formatCurrency(metricas.custoCompras)}
            rodape="Reposicao de estoque"
          />
          <Card
            icone={<AlertTriangle size={20} className="text-red-500" />}
            cor="bg-red-50"
            titulo="Inadimplencia"
            valor={formatCurrency(metricas.inadimplenciaValor)}
            rodape={`${metricas.inadimplenciaQtd} unid. sem venda registrada`}
            destaque={metricas.inadimplenciaValor > 0 ? 'text-red-600' : 'text-gray-800'}
          />
        </div>

        {produtosNoPrejuizo.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">Produto vendido abaixo do custo</p>
              <p className="mt-0.5">
                {produtosNoPrejuizo
                  .map((l) => `${l.nome} (custo ${formatCurrency(l.custoMedio)})`)
                  .join(', ')}
                . Cada venda desses itens da prejuizo.
              </p>
            </div>
          </div>
        )}

        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-4">Vendas por dia</h2>
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

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-semibold text-gray-700">Resultado por produto</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Ordenado por lucro. Inadimplencia vem das faltas apuradas na conferencia da lojinha.
            </p>
          </div>
          {loading ? (
            <p className="p-5 text-gray-400 text-sm">Carregando...</p>
          ) : metricas.porProduto.length === 0 ? (
            <p className="p-5 text-gray-400 text-sm">Nenhum movimento neste periodo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">Produto</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">Qtd</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">Receita</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">Custo unit.</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">CMV</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">Lucro</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">Margem</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">Inadimplencia</th>
                  </tr>
                </thead>
                <tbody>
                  {metricas.porProduto.map((l) => (
                    <tr key={l.produtoId} className="border-t hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">
                        {l.nome}
                        {l.semCusto && (
                          <span
                            className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full"
                            title="Nenhuma entrada de estoque com custo cadastrado"
                          >
                            sem custo
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">{l.quantidade}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{formatCurrency(l.receita)}</td>
                      <td className="px-5 py-3 text-right text-gray-500">
                        {l.semCusto ? '—' : formatCurrency(l.custoMedio)}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">{formatCurrency(l.cmv)}</td>
                      <td
                        className={`px-5 py-3 text-right font-semibold ${l.lucro < 0 ? 'text-red-600' : 'text-gray-800'}`}
                      >
                        {formatCurrency(l.lucro)}
                      </td>
                      <td
                        className={`px-5 py-3 text-right ${l.margem != null && l.margem < 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}`}
                      >
                        {formatPercent(l.margem)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {l.inadimplenciaQtd > 0 ? (
                          <span className="text-red-600 font-semibold">
                            {formatCurrency(l.inadimplenciaValor)}
                            <span className="text-xs text-red-400 font-normal ml-1">
                              ({l.inadimplenciaQtd} un.)
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold text-gray-700 mb-4">Compras por pessoa</h2>
          {loading ? (
            <p className="text-gray-400">Carregando...</p>
          ) : pessoas.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhuma compra neste periodo.</p>
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
                {pessoas.map((p, i) => (
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

function Card({
  icone, cor, titulo, valor, rodape, destaque = 'text-gray-800',
}: {
  icone: React.ReactNode
  cor: string
  titulo: string
  valor: string
  rodape?: string
  destaque?: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className={`${cor} p-2 rounded-lg`}>{icone}</div>
        <span className="text-gray-500 text-sm">{titulo}</span>
      </div>
      <p className={`text-2xl font-bold ${destaque}`}>{valor}</p>
      {rodape && <p className="text-xs text-gray-400 mt-1">{rodape}</p>}
    </div>
  )
}
