'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Usuario, Compra } from '@/lib/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import TabelaRelatorio from '@/components/relatorios/TabelaRelatorio'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Download, FileText } from 'lucide-react'

export default function RelatoriosPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [usuarioId, setUsuarioId] = useState('')
  const [dataInicio, setDataInicio] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [dataFim, setDataFim] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [compras, setCompras] = useState<Compra[]>([])
  const [previewAtivo, setPreviewAtivo] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('isAdmin')) { router.replace('/admin'); return }
    const supabase = createClient()
    supabase.from('usuarios').select('*').order('nome').then(({ data }) => setUsuarios(data ?? []))
  }, [router])

  function getRange() {
    const inicio = new Date(dataInicio + 'T00:00:00')
    const fim = new Date(dataFim + 'T23:59:59')
    return { inicio, fim }
  }

  function labelPeriodo() {
    if (!dataInicio || !dataFim) return ''
    const inicio = new Date(dataInicio + 'T00:00:00')
    const fim = new Date(dataFim + 'T23:59:59')
    return `${format(inicio, 'dd/MM/yyyy')} a ${format(fim, 'dd/MM/yyyy')}`
  }

  async function fetchCompras() {
    if (!usuarioId) return
    setCarregando(true)
    setPreviewAtivo(false)
    const supabase = createClient()
    const { inicio, fim } = getRange()

    const { data } = await supabase
      .from('compras')
      .select('*, produto:produtos(*)')
      .eq('usuario_id', usuarioId)
      .gte('comprado_em', inicio.toISOString())
      .lte('comprado_em', fim.toISOString())
      .order('comprado_em')

    setCompras((data ?? []) as Compra[])
    setPreviewAtivo(true)
    setCarregando(false)
  }

  async function handleGerarPreview() {
    if (!usuarioId) { toast.error('Selecione um usuario.'); return }
    if (!dataInicio || !dataFim) { toast.error('Selecione o intervalo de datas.'); return }
    if (dataInicio > dataFim) { toast.error('A data inicial deve ser anterior à data final.'); return }
    await fetchCompras()
  }

  async function handleDeleteCompra(compraId: string) {
    const supabase = createClient()
    const compra = compras.find((c) => c.id === compraId)

    const { error } = await supabase.from('compras').delete().eq('id', compraId)
    if (error) { toast.error('Erro ao excluir compra.'); return }

    if (compra) {
      const tsInicio = new Date(new Date(compra.comprado_em).getTime() - 60000).toISOString()
      const tsFim = new Date(new Date(compra.comprado_em).getTime() + 60000).toISOString()
      await supabase
        .from('estoque_movimentacoes')
        .delete()
        .eq('tipo', 'saida_lojinha')
        .eq('produto_id', compra.produto_id)
        .eq('quantidade', compra.quantidade)
        .gte('registrado_em', tsInicio)
        .lte('registrado_em', tsFim)
    }

    toast.success('Compra removida.')
    setCompras((prev) => prev.filter((c) => c.id !== compraId))
  }

  async function handleAjustarQtd(compraId: string, novaQtd: number) {
    if (novaQtd < 1) return
    const supabase = createClient()
    const { error } = await supabase.from('compras').update({ quantidade: novaQtd }).eq('id', compraId)
    if (error) { toast.error('Erro ao ajustar quantidade.'); return }
    toast.success('Quantidade atualizada.')
    setCompras((prev) => prev.map((c) => c.id === compraId ? { ...c, quantidade: novaQtd } : c))
  }

  async function handleBaixarPdf() {
    if (!usuarioId || !previewAtivo) return
    setGerandoPdf(true)
    const { inicio, fim } = getRange()
    const periodoLabel = labelPeriodo()

    try {
      const res = await fetch('/api/pdf/relatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: usuarioId, inicio: inicio.toISOString(), fim: fim.toISOString(), periodo_label: periodoLabel }),
      })

      if (!res.ok) throw new Error('Erro ao gerar PDF')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const usuario = usuarios.find((u) => u.id === usuarioId)
      a.href = url
      a.download = `relatorio-${usuario?.nome?.replace(/\s+/g, '-').toLowerCase()}-${dataInicio}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao gerar PDF.')
    } finally {
      setGerandoPdf(false)
    }
  }

  const usuario = usuarios.find((u) => u.id === usuarioId)

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Relatórios</h1>

        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Usuário</Label>
              <Select value={usuarioId} onValueChange={(v) => setUsuarioId(v ?? '')}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o usuario" /></SelectTrigger>
                <SelectContent>{usuarios.map((u) => (<SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data início</Label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <Label>Data fim</Label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <button
            onClick={handleGerarPreview}
            disabled={!usuarioId || carregando}
            className="flex items-center gap-2 bg-[#009ada] text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-[#007bb5] disabled:opacity-50"
          >
            <FileText size={16} />
            {carregando ? 'Carregando...' : 'Gerar prévia'}
          </button>
        </div>

        {previewAtivo && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <p className="font-bold text-gray-800">{usuario?.nome}</p>
                <p className="text-sm text-gray-500">{labelPeriodo()}</p>
              </div>
              <button
                onClick={handleBaixarPdf}
                disabled={gerandoPdf || compras.length === 0}
                className="flex items-center gap-2 bg-green-500 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
              >
                <Download size={15} />
                {gerandoPdf ? 'Gerando...' : 'Baixar PDF'}
              </button>
            </div>
            <div className="p-5">
              {compras.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Nenhuma compra neste período.</p>
              ) : (
                <TabelaRelatorio
                  compras={compras}
                  onDelete={handleDeleteCompra}
                  onAjustarQtd={handleAjustarQtd}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}