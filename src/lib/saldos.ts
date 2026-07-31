import { MovimentacaoTipo } from './types'

export type ContextoSaldo = 'estoque' | 'lojinha'

/** Campos minimos para calcular saldo. Use SELECT_SALDO ao buscar do Supabase. */
export interface MovSaldo {
  produto_id: string
  tipo: MovimentacaoTipo
  quantidade: number
  observacao?: string | null
  contexto?: string | null
}

export interface Saldos {
  estoque: Record<string, number>
  lojinha: Record<string, number>
}

/** Colunas necessarias para calcularSaldos. */
export const SELECT_SALDO = 'produto_id, tipo, quantidade, observacao, contexto'

/**
 * Ajustes gravados antes da coluna `contexto` existir guardavam o contexto
 * dentro do texto da observacao.
 */
export function contextoDoAjuste(m: MovSaldo): ContextoSaldo {
  if (m.contexto === 'estoque' || m.contexto === 'lojinha') return m.contexto
  return m.observacao?.includes('[lojinha]') ? 'lojinha' : 'estoque'
}

/**
 * Saldo de cada produto no almoxarifado e na prateleira, 100% derivado das
 * movimentacoes de entrada e saida.
 *
 *   estoque = entrada_estoque - saida_estoque + ajustes(contexto=estoque)
 *   lojinha = entrada_lojinha - saida_lojinha + ajustes(contexto=lojinha)
 */
export function calcularSaldos(movs: MovSaldo[]): Saldos {
  const estoque: Record<string, number> = {}
  const lojinha: Record<string, number> = {}

  for (const m of movs) {
    switch (m.tipo) {
      case 'entrada_estoque':
        estoque[m.produto_id] = (estoque[m.produto_id] ?? 0) + m.quantidade
        break
      case 'saida_estoque':
        estoque[m.produto_id] = (estoque[m.produto_id] ?? 0) - m.quantidade
        break
      case 'entrada_lojinha':
        lojinha[m.produto_id] = (lojinha[m.produto_id] ?? 0) + m.quantidade
        break
      case 'saida_lojinha':
        lojinha[m.produto_id] = (lojinha[m.produto_id] ?? 0) - m.quantidade
        break
      case 'ajuste_inventario': {
        const alvo = contextoDoAjuste(m) === 'lojinha' ? lojinha : estoque
        alvo[m.produto_id] = (alvo[m.produto_id] ?? 0) + m.quantidade
        break
      }
    }
  }

  return { estoque, lojinha }
}
