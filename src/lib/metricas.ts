import { Compra, EstoqueMovimentacao, Produto, InventarioContagem } from './types'

export interface MetricaProduto {
  produtoId: string
  nome: string
  /** Unidades vendidas no periodo */
  quantidade: number
  receita: number
  custoMedio: number
  /** Custo das mercadorias vendidas */
  cmv: number
  lucro: number
  /** Fracao entre 0 e 1. null quando nao houve receita. */
  margem: number | null
  /** Unidades que sumiram da prateleira sem venda registrada */
  inadimplenciaQtd: number
  inadimplenciaValor: number
  /** Produto sem nenhuma entrada de estoque com custo: CMV nao e confiavel */
  semCusto: boolean
}

export interface Metricas {
  receita: number
  cmv: number
  lucro: number
  margem: number | null
  /** Quanto foi gasto reabastecendo no periodo (nao entra no lucro) */
  custoCompras: number
  inadimplenciaQtd: number
  inadimplenciaValor: number
  transacoes: number
  porProduto: MetricaProduto[]
}

/**
 * Custo unitario medio ponderado de cada produto, a partir das entradas de estoque.
 * Produtos que nunca tiveram entrada com custo ficam de fora do mapa.
 */
export function custoMedioPorProduto(
  entradas: Pick<EstoqueMovimentacao, 'produto_id' | 'tipo' | 'quantidade' | 'custo_unit'>[]
): Record<string, number> {
  const acumulado: Record<string, { valor: number; qtd: number }> = {}

  for (const e of entradas) {
    if (e.tipo !== 'entrada_estoque' || e.custo_unit == null || e.quantidade <= 0) continue
    const a = (acumulado[e.produto_id] ??= { valor: 0, qtd: 0 })
    a.valor += e.quantidade * Number(e.custo_unit)
    a.qtd += e.quantidade
  }

  const custos: Record<string, number> = {}
  for (const [id, a] of Object.entries(acumulado)) {
    if (a.qtd > 0) custos[id] = a.valor / a.qtd
  }
  return custos
}

interface Entrada {
  compras: Compra[]
  /** Todas as entradas de estoque, sem recorte de periodo: definem o custo medio */
  entradasTodas: Pick<EstoqueMovimentacao, 'produto_id' | 'tipo' | 'quantidade' | 'custo_unit'>[]
  /** Entradas de estoque dentro do periodo: definem o custo de reposicao */
  entradasPeriodo: Pick<EstoqueMovimentacao, 'produto_id' | 'tipo' | 'quantidade' | 'custo_unit'>[]
  /** Contagens da lojinha no periodo */
  contagens: InventarioContagem[]
  produtos: Produto[]
}

/**
 * Consolida receita, custo, lucro e inadimplencia do periodo.
 *
 * Inadimplencia = produto retirado da prateleira sem a compra ter sido registrada
 * no app. So aparece quando uma contagem fisica da lojinha acusa falta, e e
 * valorada a preco de venda porque e receita que deixou de entrar.
 */
export function calcularMetricas({
  compras,
  entradasTodas,
  entradasPeriodo,
  contagens,
  produtos,
}: Entrada): Metricas {
  const custos = custoMedioPorProduto(entradasTodas)
  const porId = new Map(produtos.map((p) => [p.id, p]))

  const linhas = new Map<string, MetricaProduto>()
  function linha(produtoId: string): MetricaProduto {
    let l = linhas.get(produtoId)
    if (!l) {
      const custoMedio = custos[produtoId] ?? 0
      l = {
        produtoId,
        nome: porId.get(produtoId)?.nome ?? '(produto removido)',
        quantidade: 0,
        receita: 0,
        custoMedio,
        cmv: 0,
        lucro: 0,
        margem: null,
        inadimplenciaQtd: 0,
        inadimplenciaValor: 0,
        semCusto: custos[produtoId] == null,
      }
      linhas.set(produtoId, l)
    }
    return l
  }

  for (const c of compras) {
    const l = linha(c.produto_id)
    l.quantidade += c.quantidade
    l.receita += Number(c.preco_unit) * c.quantidade
    l.cmv += l.custoMedio * c.quantidade
  }

  for (const ct of contagens) {
    if (ct.contexto !== 'lojinha' || ct.divergencia >= 0) continue
    const l = linha(ct.produto_id)
    const faltando = Math.abs(ct.divergencia)
    l.inadimplenciaQtd += faltando
    l.inadimplenciaValor += faltando * Number(porId.get(ct.produto_id)?.preco ?? 0)
  }

  for (const l of linhas.values()) {
    l.lucro = l.receita - l.cmv
    l.margem = l.receita > 0 ? l.lucro / l.receita : null
  }

  const custoCompras = entradasPeriodo.reduce(
    (acc, e) =>
      e.tipo === 'entrada_estoque' && e.custo_unit != null
        ? acc + e.quantidade * Number(e.custo_unit)
        : acc,
    0
  )

  const porProduto = [...linhas.values()].sort((a, b) => b.lucro - a.lucro)
  const receita = porProduto.reduce((a, l) => a + l.receita, 0)
  const cmv = porProduto.reduce((a, l) => a + l.cmv, 0)

  return {
    receita,
    cmv,
    lucro: receita - cmv,
    margem: receita > 0 ? (receita - cmv) / receita : null,
    custoCompras,
    inadimplenciaQtd: porProduto.reduce((a, l) => a + l.inadimplenciaQtd, 0),
    inadimplenciaValor: porProduto.reduce((a, l) => a + l.inadimplenciaValor, 0),
    transacoes: compras.length,
    porProduto,
  }
}
