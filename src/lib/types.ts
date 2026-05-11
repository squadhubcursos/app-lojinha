export type PerfilTipo = 'usuario' | 'admin'
export type MovimentacaoTipo = 'entrada_estoque' | 'saida_estoque' | 'entrada_lojinha' | 'saida_lojinha' | 'ajuste_inventario'
export type Categoria = 'bebida' | 'snack' | 'doce' | 'chiclete' | 'outro'

export interface Usuario {
  id: string
  nome: string
  perfil: PerfilTipo
  ativo: boolean
  criado_em: string
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
  produto?: Produto
}

export interface ItemCarrinho {
  produto: Produto
  quantidade: number
}
