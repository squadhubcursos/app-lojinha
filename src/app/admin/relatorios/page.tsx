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
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { Send, FileText } from 'lucide-react'

export default function RelatoriosPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [usuarioId, setUsuarioId] = useState('')
  const [dataInicio, setDataInicio] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [dataFim, setDataFim] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [horaInicio, setHoraInicio] = useState('00:00')
  const [horaFim, setHoraFim] = useState('23:59')
  const [compras, setCompras] = useState<Compra[]>([])
  const [previewAtivo, setPreviewAtivo] = useState(false)
  const [enviandoSlack, setEnviandoSlack] = useState(false)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('isAdmin')) { router.replace('/admin'); return }
    const supabase = createClient()
    supabase.from('usuarios').select('*').order('nome').then(({ data }) => setUsuarios(data ?? []))
  }, [router])

  function getRange() {
    const inicio = new Date(`${dataInicio}T${horaInicio}:00`)
    const fim = new Date(`${dataFim}T${horaFim}:59`)
    return { inicio, fim }
  }

  function labelPeriodo() {
    if (!dataInicio || !dataFim) return ''
    const inicio = new Date(`${dataInicio}T${horaInicio}:00`)
    const fim = new Date(`${dataFim}T${horaFim}:59`)
    return `${format(inicio, 'dd/MM/yyyy HH:mm')} a ${format(fim, 'dd/MM/yyyy HH:mm')}`
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
    if (new Date(`${dataInicio}T${horaInicio}:00`) > new Date(`${dataFim}T${horaFim}:59`)) { toast.error('O intervalo de datas/horas é inválido.'); return }
    await fetchCompras()
  }

  async function handleDeleteCompra(compraId: string) {
    const supabase = createClient()
    // A baixa vinculada sai junto pela cascata de compra_id.
    const { error } = await supabase.from('compras').delete().eq('id', compraId)
    if (error) { toast.error('Erro ao excluir compra.'); return }

    toast.success('Compra removida.')
    setCompras((prev) => prev.filter((c) => c.id !== compraId))
  }

  async function handleAjustarQtd(compraId: string, novaQtd: number) {
    if (novaQtd < 1) return
    const supabase = createClient()
    // A trigger sync_mov_venda propaga a nova quantidade para a baixa.
    const { error } = await supabase.from('compras').update({ quantidade: novaQtd }).eq('id', compraId)
    if (error) { toast.error('Erro ao ajustar quantidade.'); return }
    toast.success('Quantidade atualizada.')
    setCompras((prev) => prev.map((c) => c.id === compraId ? { ...c, quantidade: novaQtd } : c))
  }

  async function handleEnviarSlack() {
    if (!usuarioId) return
    setEnviandoSlack(true)
    // Semana do historico do usuario: sabado a sexta.
    const agora = new Date()
    const inicio = startOfWeek(agora, { weekStartsOn: 6 })
    const fim = endOfWeek(agora, { weekStartsOn: 6 })
    const periodoLabel = `${format(inicio, 'dd/MM/yyyy')} a ${format(fim, 'dd/MM/yyyy')}`

    try {
      const res = await fetch('/api/slack/ficha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: usuarioId, inicio: inicio.toISOString(), fim: fim.toISOString(), periodo_label: periodoLabel }),
      })
      if (res.status === 422) { toast.error('Usuário sem ID do Slack cadastrado.'); return }
      if (!res.ok) throw new Error('Erro ao enviar ficha')
      toast.success('Ficha da semana enviada no Slack!')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao enviar ficha no Slack.')
    } finally {
      setEnviandoSlack(false)
    }
  }

  const usuario = usuarios.find((u) => u.id === usuarioId)

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Relatórios</h1>

        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
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
              <Label>Hora início</Label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
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
            <div>
              <Label>Hora fim</Label>
              <input
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
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
                onClick={handleEnviarSlack}
                disabled={enviandoSlack}
                className="flex items-center gap-2 bg-green-500 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
              >
                <Send size={15} />
                {enviandoSlack ? 'Enviando...' : 'Enviar semana no Slack'}
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