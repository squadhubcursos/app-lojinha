export type PerfilTipo = 'usuario' | 'admin'
export type MovimentacaoTipo = 'entrada_estoque' | 'saida_estoque' | 'entrada_lojinha' | 'saida_lojinha' | 'ajuste_inventario'
export type Categoria = 'bebida' | 'snack' | 'doce' | 'chiclete' | 'marmita' | 'outro'

export interface Usuario {
  id: string
  nome: string
  perfil: PerfilTipo
  ativo: boolean
  criado_em: string
  foto_url?: string | null
}

export interface Produto {
  id: string
  nome: string
  preco: number
  categoria: string
  imagem_url: string | null
  ativo: boolean
  criado_em: string
}

export interface Compra {
  id: string
  usuario_id: string
  produto_id: string
  quantidade: number
  preco_unit: number
  comprado_em: string
  produto?: Produto
  usuario?: Usuario
}

export interface EstoqueMovimentacao {
  id: string
  produto_id: string
  tipo: MovimentacaoTipo
  quantidade: number
  custo_unit: number | null
  observacao: string | null
  registrado_em: string
  usuario_id?: string | null
  /** Venda que originou a baixa. Preenchido pela trigger sync_mov_venda. */
  compra_id?: string | null
  /** Contagem que originou o ajuste de inventario. */
  contagem_id?: string | null
  /** Une as duas pernas de uma transferencia estoque -> lojinha. */
  grupo_id?: string | null
  /** Onde o ajuste_inventario incide: 'estoque' ou 'lojinha'. */
  contexto?: string | null
  produto?: Produto
  usuario?: Usuario
}

export interface InventarioContagem {
  id: string
  produto_id: string
  contexto: string | null
  quantidade_sistema: number
  quantidade_contada: number
  divergencia: number
  ajuste_confirmado: boolean
  contado_em: string
  admin_id?: string | null
  produto?: { nome: string }
}

export interface ItemCarrinho {
  produto: Produto
  quantidade: number
}
