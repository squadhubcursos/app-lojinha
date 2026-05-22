'use client'

import { useEffect, useState } from 'react'
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
  usuario: { nome: string } | null
  produto: { nome: string } | null
}

export default function MarmitasPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [marmitas, setMarmitas] = useState<Produto[]>([])
  const [linhas, setLinhas] = useState<Linha[]>([{ id: 1, usuarioId: '', produtoId: '', quantidade: '1', data: format(new Date(), 'yyyy-MM-dd') }])
  const [salvando, setSalvando] = useState(false)
  const [historico, setHistorico] = useState<CompraRegistrada[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('isAdmin')) { router.replace('/admin'); return }
    const supabase = createClient()

    Promise.all([
      supabase.from('usuarios').select('*').eq('ativo', true).order('nome'),
      supabase.from('produtos').select('*').eq('categoria', 'marmita').eq('ativo', true).order('nome'),
      supabase
        .from('compras')
        .select('id, comprado_em, quantidade, preco_unit, usuario:usuarios(nome), produto:produtos(nome)')
        .in('produto_id', [] as string[])
        .order('comprado_em', { ascending: false })
        .limit(50),
    ]).then(async ([{ data: us }, { data: ms }]) => {
      setUsuarios(us ?? [])
      const marmitaList = ms ?? []
      setMarmitas(marmitaList)

      if (marmitaList.length > 0) {
        const ids = marmitaList.map((m) => m.id)
        const { data: hist } = await supabase
          .from('compras')
          .select('id, comprado_em, quantidade, preco_unit, usuario:usuarios(nome), produto:produtos(nome)')
          .in('produto_id', ids)
          .order('comprado_em', { ascending: false })
          .limit(100)
        setHistorico((hist ?? []) as unknown as CompraRegistrada[])
      }
      setLoadingHistorico(false)
    })
  }, [router])

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

      const { error: comprasError } = await supabase.from('compras').insert(comprasData)
      if (comprasError) throw comprasError

      const movimentacoes = linhas.map((l) => {
        const dataLocal = new Date(l.data + 'T12:00:00')
        return {
          produto_id: l.produtoId,
          tipo: 'saida_lojinha' as const,
          quantidade: parseInt(l.quantidade),
          custo_unit: null,
          observacao: 'Venda marmita',
          usuario_id: l.usuarioId,
          registrado_em: dataLocal.toISOString(),
        }
      })

      const { error: movError } = await supabase.from('estoque_movimentacoes').insert(movimentacoes)
      if (movError) throw movError

      toast.success('Compras registradas!')
      setLinhas([{ id: Date.now(), usuarioId: '', produtoId: '', quantidade: '1', data: format(new Date(), 'yyyy-MM-dd') }])

      if (marmitas.length > 0) {
        const ids = marmitas.map((m) => m.id)
        const { data: hist } = await supabase
          .from('compras')
          .select('id, comprado_em, quantidade, preco_unit, usuario:usuarios(nome), produto:produtos(nome)')
          .in('produto_id', ids)
          .order('comprado_em', { ascending: false })
          .limit(100)
        setHistorico((hist ?? []) as unknown as CompraRegistrada[])
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao registrar compras.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const compra = historico.find((c) => c.id === id)
    const { error } = await supabase.from('compras').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir.'); return }

    if (compra) {
      const tsInicio = new Date(new Date(compra.comprado_em).getTime() - 60000).toISOString()
      const tsFim = new Date(new Date(compra.comprado_em).getTime() + 60000).toISOString()
      await supabase
        .from('estoque_movimentacoes')
        .delete()
        .eq('tipo', 'saida_lojinha')
        .gte('registrado_em', tsInicio)
        .lte('registrado_em', tsFim)
    }

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
          <div className="p-5 border-b">
            <h2 className="font-semibold text-gray-800">Histórico recente</h2>
          </div>
          {loadingHistorico ? (
            <div className="p-5 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : historico.length === 0 ? (
            <p className="p-5 text-sm text-gray-400 text-center">Nenhuma compra registrada.</p>
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
                  {historico.map((c) => (
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
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}