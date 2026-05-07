'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Produto, EstoqueMovimentacao } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'

export default function EstoquePage() {
  const router = useRouter()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [movimentacoes, setMovimentacoes] = useState<EstoqueMovimentacao[]>([])
  const [loading, setLoading] = useState(true)

  // Form entrada estoque
  const [entradaProduto, setEntradaProduto] = useState('')
  const [entradaQtd, setEntradaQtd] = useState('')
  const [entradaCusto, setEntradaCusto] = useState('')
  const [entradaObs, setEntradaObs] = useState('')
  const [salvandoEntrada, setSalvandoEntrada] = useState(false)

  // Form lojinha
  const [lojinhaProduto, setLojinhaProduto] = useState('')
  const [lojinhaQtd, setLojinhaQtd] = useState('')
  const [lojinhaObs, setLojinhaObs] = useState('')
  const [salvandoLojinha, setSalvandoLojinha] = useState(false)

  // Modais de confirmação
  const [confirmLimparHistorico, setConfirmLimparHistorico] = useState(false)
  const [confirmLimparSaldo, setConfirmLimparSaldo] = useState(false)
  const [limpando, setLimpando] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('isAdmin')) { router.replace('/admin'); return }
    fetchData()
  }, [router])

  async function fetchData() {
    const supabase = createClient()
    const [{ data: prods }, { data: movs }] = await Promise.all([
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
      supabase.from('estoque_movimentacoes').select('*, produto:produtos(nome)').order('registrado_em', { ascending: false }),
    ])
    setProdutos(prods ?? [])
    setMovimentacoes((movs ?? []) as EstoqueMovimentacao[])
    setLoading(false)
  }

  // Saldos independentes por produto
  const saldoEstoqueMap: Record<string, number> = {}
  const saldoLojinhaMap: Record<string, number> = {}
  movimentacoes.forEach((m) => {
    if (m.tipo === 'entrada_estoque') {
      saldoEstoqueMap[m.produto_id] = (saldoEstoqueMap[m.produto_id] ?? 0) + m.quantidade
    } else if (m.tipo === 'saida_estoque') {
      saldoEstoqueMap[m.produto_id] = (saldoEstoqueMap[m.produto_id] ?? 0) - m.quantidade
    } else if (m.tipo === 'entrada_lojinha') {
      saldoLojinhaMap[m.produto_id] = (saldoLojinhaMap[m.produto_id] ?? 0) + m.quantidade
    } else if (m.tipo === 'saida_lojinha') {
      saldoLojinhaMap[m.produto_id] = (saldoLojinhaMap[m.produto_id] ?? 0) - m.quantidade
    } else if (m.tipo === 'ajuste_inventario') {
      if (m.observacao?.includes('[lojinha]')) {
        saldoLojinhaMap[m.produto_id] = (saldoLojinhaMap[m.produto_id] ?? 0) + m.quantidade
      } else {
        saldoEstoqueMap[m.produto_id] = (saldoEstoqueMap[m.produto_id] ?? 0) + m.quantidade
      }
    }
  })

  async function handleEntradaEstoque() {
    if (!entradaProduto || !entradaQtd) return
    setSalvandoEntrada(true)
    const supabase = createClient()
    const { error } = await supabase.from('estoque_movimentacoes').insert({
      produto_id: entradaProduto,
      tipo: 'entrada_estoque',
      quantidade: parseInt(entradaQtd),
      custo_unit: entradaCusto ? parseFloat(entradaCusto) : null,
      observacao: entradaObs || null,
    })
    if (error) { toast.error('Erro ao registrar entrada.'); }
    else { toast.success('Entrada registrada!'); setEntradaProduto(''); setEntradaQtd(''); setEntradaCusto(''); setEntradaObs(''); fetchData() }
    setSalvandoEntrada(false)
  }

  async function handleMovLojinha() {
    if (!lojinhaProduto || !lojinhaQtd) return
    setSalvandoLojinha(true)
    const supabase = createClient()
    const qtd = parseInt(lojinhaQtd)
    const obs = lojinhaObs || 'Transferência estoque → lojinha'
    const { error } = await supabase.from('estoque_movimentacoes').insert([
      { produto_id: lojinhaProduto, tipo: 'saida_estoque', quantidade: qtd, custo_unit: null, observacao: obs },
      { produto_id: lojinhaProduto, tipo: 'entrada_lojinha', quantidade: qtd, custo_unit: null, observacao: obs },
    ])
    if (error) { toast.error('Erro ao registrar movimentação.'); }
    else { toast.success('Movimentação registrada!'); setLojinhaProduto(''); setLojinhaQtd(''); setLojinhaObs(''); fetchData() }
    setSalvandoLojinha(false)
  }

  async function handleLimparHistorico() {
    setLimpando(true)
    const supabase = createClient()
    const { error } = await supabase.from('estoque_movimentacoes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) { toast.error('Erro ao limpar histórico.') }
    else { toast.success('Histórico limpo com sucesso!'); fetchData() }
    setLimpando(false)
    setConfirmLimparHistorico(false)
  }

  async function handleLimparSaldo() {
    setLimpando(true)
    const supabase = createClient()
    const { error } = await supabase.from('estoque_movimentacoes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) { toast.error('Erro ao zerar saldos.') }
    else { toast.success('Saldos zerados com sucesso!'); fetchData() }
    setLimpando(false)
    setConfirmLimparSaldo(false)
  }

  const tipoLabels: Record<string, string> = {
    entrada_estoque: 'Entrada estoque',
    saida_estoque: 'Saída estoque',
    entrada_lojinha: 'Entrada lojinha',
    saida_lojinha: 'Saída lojinha',
    ajuste_inventario: 'Ajuste inventário',
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Estoque</h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Entrada de estoque */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-4">Registrar entrada</h2>
            <div className="space-y-3">
              <div>
                <Label>Produto</Label>
                <Select value={entradaProduto} onValueChange={(v) => setEntradaProduto(v ?? '')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" min="1" value={entradaQtd} onChange={(e) => setEntradaQtd(e.target.value)} className="mt-1" placeholder="0" />
                </div>
                <div>
                  <Label>Custo unitário (R$)</Label>
                  <Input type="number" min="0" step="0.01" value={entradaCusto} onChange={(e) => setEntradaCusto(e.target.value)} className="mt-1" placeholder="0,00" />
                </div>
              </div>
              <div>
                <Label>Observação</Label>
                <Input value={entradaObs} onChange={(e) => setEntradaObs(e.target.value)} className="mt-1" placeholder="Opcional" />
              </div>
              <button
                onClick={handleEntradaEstoque}
                disabled={salvandoEntrada || !entradaProduto || !entradaQtd}
                className="w-full bg-[#009ada] text-white rounded-lg py-2.5 font-semibold hover:bg-[#007bb5] transition-colors disabled:opacity-50"
              >
                {salvandoEntrada ? 'Salvando...' : 'Registrar entrada'}
              </button>
            </div>
          </div>

          {/* Mover para lojinha */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-4">Mover para lojinha</h2>
            <div className="space-y-3">
              <div>
                <Label>Produto</Label>
                <Select value={lojinhaProduto} onValueChange={(v) => setLojinhaProduto(v ?? '')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={lojinhaQtd} onChange={(e) => setLojinhaQtd(e.target.value)} className="mt-1" placeholder="0" />
              </div>
              <div>
                <Label>Observação</Label>
                <Input value={lojinhaObs} onChange={(e) => setLojinhaObs(e.target.value)} className="mt-1" placeholder="Opcional" />
              </div>
              <button
                onClick={handleMovLojinha}
                disabled={salvandoLojinha || !lojinhaProduto || !lojinhaQtd}
                className="w-full bg-green-500 text-white rounded-lg py-2.5 font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {salvandoLojinha ? 'Salvando...' : 'Mover para lojinha'}
              </button>
            </div>
          </div>
        </div>

        {/* Saldo atual */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">Saldo atual por produto</h2>
            <button
              onClick={() => setConfirmLimparSaldo(true)}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 size={13} />
              Zerar saldos
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-gray-500 font-medium">Produto</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Saldo Estoque</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Saldo Lojinha</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => {
                  const se = saldoEstoqueMap[p.id] ?? 0
                  const sl = saldoLojinhaMap[p.id] ?? 0
                  const total = se + sl
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 font-medium text-gray-800">{p.nome}</td>
                      <td className={`py-2 text-right font-semibold ${se < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                        {se} unid.
                      </td>
                      <td className={`py-2 text-right font-semibold ${sl < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                        {sl} unid.
                      </td>
                      <td className={`py-2 text-right font-bold ${total < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                        {total} unid.
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Histórico */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">Histórico de movimentações</h2>
            <button
              onClick={() => setConfirmLimparHistorico(true)}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 size={13} />
              Limpar histórico
            </button>
          </div>
          {loading ? (
            <p className="text-gray-400">Carregando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-gray-500 font-medium">Data</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Produto</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Tipo</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Qtd</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Custo unit.</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoes.map((m) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 text-gray-600">{formatDate(m.registrado_em)}</td>
                      <td className="py-2 font-medium text-gray-800">{m.produto?.nome}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          m.tipo.startsWith('entrada') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {tipoLabels[m.tipo] ?? m.tipo}
                        </span>
                      </td>
                      <td className="py-2 text-right text-gray-700">{m.quantidade}</td>
                      <td className="py-2 text-right text-gray-600">{m.custo_unit ? formatCurrency(m.custo_unit) : '-'}</td>
                      <td className="py-2 text-gray-500 text-xs">{m.observacao ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: limpar histórico */}
      <Dialog open={confirmLimparHistorico} onOpenChange={setConfirmLimparHistorico}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Limpar histórico de movimentações?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 mt-1">
            Todos os registros de movimentações serão apagados permanentemente. Os saldos calculados também serão zerados. <strong>Esta ação não pode ser desfeita.</strong>
          </p>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setConfirmLimparHistorico(false)} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={handleLimparHistorico}
              disabled={limpando}
              className="flex-1 bg-red-500 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
            >
              {limpando ? 'Limpando...' : 'Sim, limpar tudo'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: zerar saldos */}
      <Dialog open={confirmLimparSaldo} onOpenChange={setConfirmLimparSaldo}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Zerar saldo de todos os produtos?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 mt-1">
            O saldo é calculado a partir das movimentações. Zerar o saldo apaga <strong>todo o histórico de movimentações</strong>, incluindo entradas, saídas e ajustes. <strong>Esta ação não pode ser desfeita.</strong>
          </p>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setConfirmLimparSaldo(false)} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={handleLimparSaldo}
              disabled={limpando}
              className="flex-1 bg-red-500 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
            >
              {limpando ? 'Zerando...' : 'Sim, zerar tudo'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
