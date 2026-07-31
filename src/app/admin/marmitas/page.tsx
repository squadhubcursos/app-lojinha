'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Usuario, Produto } from '@/lib/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import toast from 'react-hot-toast'
import { Plus, Trash2, CheckCircle, UtensilsCrossed } from 'lucide-react'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/utils'

interface Linha {
  id: number
  usuarioId: string
  produtoId: string
  quantidade: string
  data: string
}

interface CompraRegistrada {
  id: string
  comprado_em: string
  quantidade: number
  preco_unit: number
  usuario_id: string
  produto_id: string
  usuario: { nome: string } | null
  produto: { nome: string } | null
}

const CAMPOS_HISTORICO =
  'id, comprado_em, quantidade, preco_unit, usuario_id, produto_id, usuario:usuarios(nome), produto:produtos(nome)'

export default function MarmitasPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [marmitas, setMarmitas] = useState<Produto[]>([])
  const [linhas, setLinhas] = useState<Linha[]>([{ id: 1, usuarioId: '', produtoId: '', quantidade: '1', data: format(new Date(), 'yyyy-MM-dd') }])
  const [salvando, setSalvando] = useState(false)
  const [historico, setHistorico] = useState<CompraRegistrada[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(true)

  const [filtroUsuario, setFiltroUsuario] = useState('todos')
  const [filtroProduto, setFiltroProduto] = useState('todos')

  const carregarHistorico = useCallback(async (idsMarmitas: string[]) => {
    if (idsMarmitas.length === 0) { setHistorico([]); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('compras')
      .select(CAMPOS_HISTORICO)
      .in('produto_id', idsMarmitas)
      .order('comprado_em', { ascending: false })
      .limit(100)
    setHistorico((data ?? []) as unknown as CompraRegistrada[])
  }, [])

  useEffect(() => {
    if (!localStorage.getItem('isAdmin')) { router.replace('/admin'); return }
    const supabase = createClient()

    Promise.all([
      supabase.from('usuarios').select('*').eq('ativo', true).order('nome'),
      supabase.from('produtos').select('*').eq('categoria', 'marmita').eq('ativo', true).order('nome'),
    ]).then(async ([{ data: us }, { data: ms }]) => {
      setUsuarios(us ?? [])
      const marmitaList = ms ?? []
      setMarmitas(marmitaList)
      await carregarHistorico(marmitaList.map((m) => m.id))
      setLoadingHistorico(false)
    })
  }, [router, carregarHistorico])

  function addLinha() {
    const ultima = linhas[linhas.length - 1]
    setLinhas((prev) => [
      ...prev,
      {
        id: Date.now(),
        usuarioId: ultima?.usuarioId ?? '',
        produtoId: ultima?.produtoId ?? '',
        quantidade: '1',
        data: ultima?.data ?? format(new Date(), 'yyyy-MM-dd'),
      },
    ])
  }

  function removeLinha(id: number) {
    if (linhas.length === 1) return
    setLinhas((prev) => prev.filter((l) => l.id !== id))
  }

  function updateLinha(id: number, field: keyof Linha, value: string) {
    setLinhas((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l))
  }

  async function handleSalvar() {
    const invalidas = linhas.filter((l) => !l.usuarioId || !l.produtoId || !l.quantidade || !l.data || parseInt(l.quantidade) < 1)
    if (invalidas.length > 0) {
      toast.error('Preencha todos os campos de cada linha.')
      return
    }

    setSalvando(true)
    const supabase = createClient()

    try {
      const comprasData = linhas.map((l) => {
        const produto = marmitas.find((m) => m.id === l.produtoId)
        const dataLocal = new Date(l.data + 'T12:00:00')
        return {
          usuario_id: l.usuarioId,
          produto_id: l.produtoId,
          quantidade: parseInt(l.quantidade),
          preco_unit: produto?.preco ?? 0,
          comprado_em: dataLocal.toISOString(),
        }
      })

      // A baixa em estoque_movimentacoes e criada pela trigger sync_mov_venda.
      const { error: comprasError } = await supabase.from('compras').insert(comprasData)
      if (comprasError) throw comprasError

      toast.success('Compras registradas!')
      setLinhas([{ id: Date.now(), usuarioId: '', produtoId: '', quantidade: '1', data: format(new Date(), 'yyyy-MM-dd') }])

      await carregarHistorico(marmitas.map((m) => m.id))
    } catch (err) {
      console.error(err)
      toast.error('Erro ao registrar compras.')
    } finally {
      setSalvando(false)
    }
  }

  const historicoFiltrado = historico.filter((c) => {
    if (filtroUsuario !== 'todos' && c.usuario_id !== filtroUsuario) return false
    if (filtroProduto !== 'todos' && c.produto_id !== filtroProduto) return false
    return true
  })
  const filtrosAtivos = filtroUsuario !== 'todos' || filtroProduto !== 'todos'
  const totalFiltrado = historicoFiltrado.reduce((acc, c) => acc + c.preco_unit * c.quantidade, 0)

  async function handleDelete(id: string) {
    const supabase = createClient()
    // A baixa vinculada sai junto pela cascata de compra_id.
    const { error } = await supabase.from('compras').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir.'); return }

    toast.success('Removido.')
    setHistorico((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <UtensilsCrossed size={24} />
          Marmitas
        </h1>

        {marmitas.length === 0 && !loadingHistorico && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
            Nenhum produto com categoria "marmita" cadastrado. Cadastre os produtos 300g e 370g em Produtos primeiro.
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">Nova compra</h2>

          <div className="space-y-3">
            {linhas.map((linha, idx) => (
              <div key={linha.id} className="grid grid-cols-[1fr_1fr_80px_140px_36px] gap-2 items-end">
                <div>
                  {idx === 0 && <Label className="mb-1 block text-xs">Usuário</Label>}
                  <Select value={linha.usuarioId} onValueChange={(v) => updateLinha(linha.id, 'usuarioId', v ?? '')}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  {idx === 0 && <Label className="mb-1 block text-xs">Marmita</Label>}
                  <Select value={linha.produtoId} onValueChange={(v) => updateLinha(linha.id, 'produtoId', v ?? '')}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{marmitas.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  {idx === 0 && <Label className="mb-1 block text-xs">Qtd</Label>}
                  <Input type="number" min="1" value={linha.quantidade} onChange={(e) => updateLinha(linha.id, 'quantidade', e.target.value)} />
                </div>
                <div>
                  {idx === 0 && <Label className="mb-1 block text-xs">Data</Label>}
                  <Input type="date" value={linha.data} onChange={(e) => updateLinha(linha.id, 'data', e.target.value)} />
                </div>
                <div className={idx === 0 ? 'mt-5' : ''}>
                  <button
                    onClick={() => removeLinha(linha.id)}
                    disabled={linhas.length === 1}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 disabled:opacity-30"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={addLinha}
              className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <Plus size={15} />
              Adicionar linha
            </button>
            <button
              onClick={handleSalvar}
              disabled={salvando}
              className="flex items-center gap-2 bg-[#009ada] text-white rounded-lg px-5 py-2 text-sm font-semibold hover:bg-[#007bb5] disabled:opacity-50"
            >
              <CheckCircle size={15} />
              {salvando ? 'Salvando...' : 'Registrar compras'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b space-y-4">
            <h2 className="font-semibold text-gray-800">Histórico recente</h2>

            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Usuário</label>
                <Select value={filtroUsuario} onValueChange={(v) => setFiltroUsuario(v ?? 'todos')}>
                  <SelectTrigger className="h-9 w-48 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os usuários</SelectItem>
                    {usuarios.map((u) => (<SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Marmita</label>
                <Select value={filtroProduto} onValueChange={(v) => setFiltroProduto(v ?? 'todos')}>
                  <SelectTrigger className="h-9 w-48 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as marmitas</SelectItem>
                    {marmitas.map((m) => (<SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              {filtrosAtivos && (
                <div className="flex flex-col gap-1 justify-end">
                  <button
                    onClick={() => { setFiltroUsuario('todos'); setFiltroProduto('todos') }}
                    className="h-9 px-3 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-md transition-colors"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
          </div>
          {loadingHistorico ? (
            <div className="p-5 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : historicoFiltrado.length === 0 ? (
            <p className="p-5 text-sm text-gray-400 text-center">
              {filtrosAtivos ? 'Nenhuma compra para este filtro.' : 'Nenhuma compra registrada.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">Usuário</th>
                    <th className="px-4 py-3 text-left">Marmita</th>
                    <th className="px-4 py-3 text-center">Qtd</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historicoFiltrado.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{new Date(c.comprado_em).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{c.usuario?.nome ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-700">{c.produto?.nome ?? '-'}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{c.quantidade}</td>
                      <td className="px-4 py-3 text-right text-gray-800 font-medium">{formatCurrency(c.preco_unit * c.quantidade)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total {filtrosAtivos ? 'filtrado' : ''} ({historicoFiltrado.length} registros)
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totalFiltrado)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}