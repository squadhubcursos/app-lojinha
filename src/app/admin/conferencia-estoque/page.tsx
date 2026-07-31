'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import ConferenciaTab, { SaldoInfo } from '@/components/admin/ConferenciaTab'
import { InventarioContagem } from '@/lib/types'
import { calcularSaldos, SELECT_SALDO, ContextoSaldo } from '@/lib/saldos'
import { formatDate } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronDown, ChevronUp, X, Trash2, Pencil, Save } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ConferenciaEstoquePage() {
  const router = useRouter()
  const [aba, setAba] = useState<ContextoSaldo>('estoque')
  const [saldosEstoque, setSaldosEstoque] = useState<SaldoInfo[]>([])
  const [saldosLojinha, setSaldosLojinha] = useState<SaldoInfo[]>([])
  const [historico, setHistorico] = useState<InventarioContagem[]>([])
  const [loading, setLoading] = useState(true)

  const [historicoEstoqueAberto, setHistoricoEstoqueAberto] = useState(false)
  const [historicoLojinhaAberto, setHistoricoLojinhaAberto] = useState(false)
  const [excluindoHistorico, setExcluindoHistorico] = useState<string | null>(null)
  const [filtroProduto, setFiltroProduto] = useState('todos')

  const [editandoContagem, setEditandoContagem] = useState<string | null>(null)
  const [editValues, setEditValues] = useState({ quantidade_sistema: '', quantidade_contada: '' })
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  const fetchSaldos = useCallback(async () => {
    const supabase = createClient()
    const [{ data: produtos }, { data: movs }] = await Promise.all([
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
      supabase.from('estoque_movimentacoes').select(SELECT_SALDO),
    ])

    const { estoque, lojinha } = calcularSaldos(movs ?? [])
    const prods = produtos ?? []
    setSaldosEstoque(prods.map((p) => ({ produto: p, saldoSistema: estoque[p.id] ?? 0 })))
    setSaldosLojinha(prods.map((p) => ({ produto: p, saldoSistema: lojinha[p.id] ?? 0 })))
    setLoading(false)
  }, [])

  const fetchHistorico = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('inventario_contagens')
      .select('*, produto:produtos(nome)')
      .order('contado_em', { ascending: false })
      .limit(200)
    setHistorico((data ?? []) as InventarioContagem[])
  }, [])

  useEffect(() => {
    if (!localStorage.getItem('isAdmin')) { router.replace('/admin'); return }
    fetchSaldos()
    fetchHistorico()
  }, [router, fetchSaldos, fetchHistorico])

  const atualizar = useCallback(() => {
    fetchSaldos()
    fetchHistorico()
  }, [fetchSaldos, fetchHistorico])

  const produtos = saldosEstoque.map((s) => s.produto)
  const historicoFiltrado = historico.filter(
    (c) => filtroProduto === 'todos' || c.produto_id === filtroProduto
  )
  const historicoEstoqueItems = historicoFiltrado.filter((c) => c.contexto === 'estoque')
  const historicoLojinhaItems = historicoFiltrado.filter((c) => c.contexto === 'lojinha')

  /** O ajuste vinculado sai junto pela cascata de contagem_id. */
  async function handleDeleteHistorico(contagem: InventarioContagem) {
    setExcluindoHistorico(contagem.id)
    const supabase = createClient()
    const { error } = await supabase.from('inventario_contagens').delete().eq('id', contagem.id)
    if (error) {
      toast.error('Erro ao excluir.')
    } else {
      toast.success('Registro excluido. O saldo do sistema foi recalculado.')
      setHistorico((prev) => prev.filter((c) => c.id !== contagem.id))
      fetchSaldos()
    }
    setExcluindoHistorico(null)
  }

  function handleIniciarEdicao(c: InventarioContagem) {
    setEditandoContagem(c.id)
    setEditValues({
      quantidade_sistema: String(c.quantidade_sistema),
      quantidade_contada: String(c.quantidade_contada),
    })
  }

  /** A divergencia e o ajuste vinculado sao recalculados pelas triggers. */
  async function handleSalvarEdicao(id: string) {
    setSalvandoEdicao(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('inventario_contagens')
      .update({
        quantidade_sistema: parseInt(editValues.quantidade_sistema) || 0,
        quantidade_contada: parseInt(editValues.quantidade_contada) || 0,
      })
      .eq('id', id)

    if (error) {
      toast.error('Erro ao atualizar.')
    } else {
      toast.success('Registro atualizado!')
      setEditandoContagem(null)
      fetchHistorico()
      fetchSaldos()
    }
    setSalvandoEdicao(false)
  }

  function renderHistoricoTabela(items: InventarioContagem[]) {
    if (items.length === 0) {
      return <p className="text-sm text-gray-400 text-center py-8">Nenhuma contagem registrada ainda.</p>
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Data</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Produto</th>
              <th className="text-right px-5 py-3 text-gray-500 font-medium">Sistema</th>
              <th className="text-right px-5 py-3 text-gray-500 font-medium">Contado</th>
              <th className="text-right px-5 py-3 text-gray-500 font-medium">Divergencia</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const isEditing = editandoContagem === c.id
              const editedDiv = isEditing
                ? (parseInt(editValues.quantidade_contada) || 0) - (parseInt(editValues.quantidade_sistema) || 0)
                : c.divergencia
              return (
                <tr key={c.id} className={`border-t ${isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(c.contado_em)}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{c.produto?.nome ?? '-'}</td>
                  <td className="px-5 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.quantidade_sistema}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, quantidade_sistema: e.target.value }))}
                        className="w-20 border border-blue-300 rounded px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    ) : (
                      <span className="text-gray-600">{c.quantidade_sistema}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.quantidade_contada}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, quantidade_contada: e.target.value }))}
                        className="w-20 border border-blue-300 rounded px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    ) : (
                      <span className="text-gray-600">{c.quantidade_contada}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`font-semibold ${editedDiv > 0 ? 'text-blue-600' : editedDiv < 0 ? 'text-red-500' : 'text-gray-400'}`}
                    >
                      {editedDiv > 0 ? '+' : ''}
                      {editedDiv}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleSalvarEdicao(c.id)}
                          disabled={salvandoEdicao}
                          className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                          title="Salvar"
                        >
                          <Save size={14} />
                        </button>
                        <button
                          onClick={() => setEditandoContagem(null)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="Cancelar"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleIniciarEdicao(c)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteHistorico(c)}
                          disabled={excluindoHistorico === c.id}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                          title="Excluir"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Conferencia de Estoque</h1>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(['estoque', 'lojinha'] as ContextoSaldo[]).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                aba === a ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {a === 'estoque' ? 'Conferencia do Estoque' : 'Conferencia da Lojinha'}
            </button>
          ))}
        </div>

        {/* Ambas as abas ficam montadas para preservar a contagem em andamento ao trocar */}
        <div className={aba === 'estoque' ? '' : 'hidden'}>
          <ConferenciaTab contexto="estoque" saldos={saldosEstoque} loading={loading} onAtualizar={atualizar} />
        </div>
        <div className={aba === 'lojinha' ? '' : 'hidden'}>
          <ConferenciaTab contexto="lojinha" saldos={saldosLojinha} loading={loading} onAtualizar={atualizar} />
        </div>

        {/* FILTRO DOS HISTORICOS */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Filtrar historicos por produto</label>
            <Select value={filtroProduto} onValueChange={(v) => setFiltroProduto(v ?? 'todos')}>
              <SelectTrigger className="h-9 w-56 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os produtos</SelectItem>
                {produtos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filtroProduto !== 'todos' && (
            <button
              onClick={() => setFiltroProduto('todos')}
              className="h-9 px-3 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-md transition-colors"
            >
              Limpar filtro
            </button>
          )}
        </div>

        {/* HISTORICO DO ESTOQUE */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setHistoricoEstoqueAberto((v) => !v)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium border border-orange-100">
                Estoque
              </span>
              <h2 className="font-semibold text-gray-700">
                Historico de contagens — Estoque ({historicoEstoqueItems.length})
              </h2>
            </div>
            {historicoEstoqueAberto ? (
              <ChevronUp size={18} className="text-gray-400" />
            ) : (
              <ChevronDown size={18} className="text-gray-400" />
            )}
          </button>
          {historicoEstoqueAberto && <div className="border-t">{renderHistoricoTabela(historicoEstoqueItems)}</div>}
        </div>

        {/* HISTORICO DA LOJINHA */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setHistoricoLojinhaAberto((v) => !v)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium border border-purple-100">
                Lojinha
              </span>
              <h2 className="font-semibold text-gray-700">
                Historico de contagens — Lojinha ({historicoLojinhaItems.length})
              </h2>
            </div>
            {historicoLojinhaAberto ? (
              <ChevronUp size={18} className="text-gray-400" />
            ) : (
              <ChevronDown size={18} className="text-gray-400" />
            )}
          </button>
          {historicoLojinhaAberto && <div className="border-t">{renderHistoricoTabela(historicoLojinhaItems)}</div>}
        </div>
      </div>
    </AdminLayout>
  )
}
