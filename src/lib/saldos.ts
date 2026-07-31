export type ContextoSaldo = 'estoque' | 'lojinha'

/**
 * Uma linha por produto, vinda da view public.saldos_produtos.
 *
 * A soma e feita no banco de proposito. Antes as telas baixavam a tabela inteira
 * de movimentacoes e somavam no navegador, mas o PostgREST corta a resposta em
 * 1000 linhas — quando o extrato passou disso, as movimentacoes mais recentes
 * sumiam da conta e o saldo aparecia errado, sem nenhum aviso.
 */
export interface SaldoProduto {
  produto_id: string
  saldo_estoque: number
  saldo_lojinha: number
}

export interface Saldos {
  estoque: Record<string, number>
  lojinha: Record<string, number>
}

export const VIEW_SALDOS = 'saldos_produtos'

export function mapearSaldos(linhas: SaldoProduto[]): Saldos {
  const estoque: Record<string, number> = {}
  const lojinha: Record<string, number> = {}

  for (const l of linhas) {
    estoque[l.produto_id] = l.saldo_estoque
    lojinha[l.produto_id] = l.saldo_lojinha
  }

  return { estoque, lojinha }
}
