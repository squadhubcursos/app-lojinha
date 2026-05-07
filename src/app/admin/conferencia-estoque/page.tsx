'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Produto } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { CheckCircle, AlertTriangle, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

interface SaldoInfo {
  produto: Produto
  saldoSistema: number
}

interface ContadoItem {
  produto: Produto
  saldoSistema: number
  contado: string
}

interface Divergencia {
  produto: Produto
  saldoSistema: number
  contado: number
  divergencia: number
  confirmado: boolean
  confirmando: boolean
}

interface Contagem {
  id: string
  produto_id: string
  quantidade_sistema: number
  quantidade_contada: number
  divergencia: number
  ajuste_confirmado: boolean
  contado_em: string
  produto?: { nome: string }
}

export default function ConferenciaEstoquePage() {
  const router = useRouter()
  const [saldos, setSaldos] = useState<SaldoInfo[]>([])
  const [contados, setContados] = useState<Record<string, string>>({})
  const [divergencias, setDivergencias] = useState<Divergencia[]>([])
  const [etapa, setEtapa] = useState<'preenchimento' | 'revisao'>('preenchimento')
  const [historico, setHistorico] = useState<Contagem[]>([])
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('isAdmin')) { router.replace('/admin'); return }
    fetchSaldos()
    fetchHistorico()
  }, [router])

  async function fetchSaldos() {
    const supabase = createClient()
    const [{ data: produtos }, { data: movs }] = await Promise.all([
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
      supabase.from('estoque_movimentacoes').select('produto_id, tipo, quantidade'),
    ])

    const saldoMap: Record<string, number> = {}
    ;(movs ?? []).forEach((m) => {
      if (m.tipo === 'entrada_estoque') saldoMap[m.produto_id] = (saldoMap[m.produto_id] ?? 0) + m.quantidade
      else if (m.tipo === 'saida_estoque') saldoMap[m.produto_id] = (saldoMap[m.produto_id] ?? 0) - m.quantidade
      else if (m.tipo === 'ajuste_inventario') saldoMap[m.produto_id] = (saldoMap[m.produto_id] ?? 0) + m.quantidade
    })

    setSaldos((produtos ?? []).map((p) => ({ produto: p, saldoSistema: saldoMap[p.id] ?? 0 })))
    setLoading(false)
  }

  async function fetchHistorico() {
    const supabase = createClient()
    const { data } = await supabase
      .from('inventario_contagens')
      .select('*, produto:produtos(nome)')
      .order('contado_em', { ascending: false })
      .limit(50)
    setHistorico((data ?? []) as Contagem[])
  }

  function handleGerarConferencia() {
    const divs: Divergencia[] = saldos.map(({ produto, saldoSistema }) => {
      const contadoVal = parseInt(contados[produto.id] ?? '0') || 0
      return {
        produto,
        saldoSistema,
        contado: contadoVal,
        divergencia: contadoVal - saldoSistema,
        confirmado: false,
        confirmando: false,
      }
    })
    setDivergencias(divs)
    setEtapa('revisao')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleConfirmarAjuste(idx: number) {
    const item = divergencias[idx]
    if (item.divergencia === 0) return

    setDivergencias((prev) => prev.map((d, i) => i === idx ? { ...d, confirmando: true } : d))

    const supabase = createClient()
    const adminId = localStorage.getItem('admin_id') ?? null

    const { data: contagem, error: contErr } = await supabase
      .from('inventario_contagens')
      .insert({
        produto_id: item.produto.id,
        quantidade_sistema: item.saldoSistema,
        quantidade_contada: item.contado,
        divergencia: item.divergencia,
        ajuste_confirmado: true,
        admin_id: adminId,
      })
      .select()
      .single()

    if (contErr) {
      toast.error('Erro ao salvar contagem.')
      setDivergencias((prev) => prev.map((d, i) => i === idx ? { ...d, confirmando: false } : d))
      return
    }

    const { error: movErr } = await supabase.from('estoque_movimentacoes').insert({
      produto_id: item.produto.id,
      tipo: 'ajuste_inventario',
      quantidade: item.divergencia,
      custo_unit: null,
      observacao: `Ajuste inventário — contagem ${contagem.id}`,
    })

    if (movErr) {
      toast.error('Erro ao registrar ajuste.')
      setDivergencias((prev) => prev.map((d, i) => i === idx ? { ...d, confirmando: false } : d))
      return
    }

    toast.success(`Ajuste confirmado: ${item.produto.nome}`)
    setDivergencias((prev) => prev.map((d, i) => i === idx ? { ...d, confirmado: true, confirmando: false } : d))
    fetchHistorico()
    fetchSaldos()
  }

  const semDivergencia = divergencias.filter((d) => d.divergencia === 0)
  const comSobra = divergencias.filter((d) => d.divergencia > 0)
  const comFalta = divergencias.filter((d) => d.divergencia < 0)

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Conferência de Estoque</h1>
          {etapa === 'revisao' && (
            <button
              onClick={() => setEtapa('preenchimento')}
              className="text-sm text-[#009ada] hover:underline"
            >
              ← Voltar ao preenchimento
            </button>
          )}
        </div>

        {/* ETAPA 1: Preenchimento */}
        {etapa === 'preenchimento' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b">
              <p className="text-sm text-gray-500">Preencha a quantidade física contada para cada produto. Campos em branco serão considerados como 0.</p>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-400">Carregando...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-5 py-3 text-gray-500 font-medium">Produto</th>
                        <th className="text-right px-5 py-3 text-gray-500 font-medium">Saldo sistema</th>
                        <th className="text-right px-5 py-3 text-gray-500 font-medium w-40">Contagem física</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saldos.map(({ produto, saldoSistema }) => (
                        <tr key={produto.id} className="border-t hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-800">{produto.nome}</td>
                          <td className="px-5 py-3 text-right text-gray-600">{saldoSistema} unid.</td>
                          <td className="px-5 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              value={contados[produto.id] ?? ''}
                              onChange={(e) => setContados((prev) => ({ ...prev, [produto.id]: e.target.value }))}
                              placeholder="0"
                              className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-[#009ada]/30 focus:border-[#009ada]"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-5 border-t">
                  <button
                    onClick={handleGerarConferencia}
                    className="bg-[#009ada] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#007bb5] transition-colors"
                  >
                    Gerar conferência
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ETAPA 2: Revisão */}
        {etapa === 'revisao' && (
          <>
            {/* Cards de resumo */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center gap-3">
                <CheckCircle className="text-green-500" size={28} />
                <div>
                  <p className="text-2xl font-bold text-green-700">{semDivergencia.length}</p>
                  <p className="text-xs text-green-600 font-medium">Sem divergência</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3">
                <TrendingUp className="text-blue-500" size={28} />
                <div>
                  <p className="text-2xl font-bold text-blue-700">{comSobra.length}</p>
                  <p className="text-xs text-blue-600 font-medium">Com sobra</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
                <TrendingDown className="text-red-500" size={28} />
                <div>
                  <p className="text-2xl font-bold text-red-700">{comFalta.length}</p>
                  <p className="text-xs text-red-600 font-medium">Com falta</p>
                </div>
              </div>
            </div>

            {/* Tabela de divergências */}
            {(comFalta.length > 0 || comSobra.length > 0) && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b">
                  <h2 className="font-semibold text-gray-700">Produtos com divergência</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Confirme os ajustes individualmente para atualizar o saldo do sistema.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-5 py-3 text-gray-500 font-medium">Produto</th>
                        <th className="text-right px-5 py-3 text-gray-500 font-medium">Saldo sistema</th>
                        <th className="text-right px-5 py-3 text-gray-500 font-medium">Contagem hoje</th>
                        <th className="text-right px-5 py-3 text-gray-500 font-medium">Divergência</th>
                        <th className="px-5 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {divergencias
                        .map((d, idx) => ({ ...d, idx }))
                        .filter((d) => d.divergencia !== 0)
                        .map((d) => (
                          <tr key={d.produto.id} className="border-t hover:bg-gray-50">
                            <td className="px-5 py-3 font-medium text-gray-800">{d.produto.nome}</td>
                            <td className="px-5 py-3 text-right text-gray-600">{d.saldoSistema}</td>
                            <td className="px-5 py-3 text-right text-gray-600">{d.contado}</td>
                            <td className="px-5 py-3 text-right">
                              <span className={`font-bold ${d.divergencia > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                {d.divergencia > 0 ? '+' : ''}{d.divergencia}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              {d.confirmado ? (
                                <span className="text-xs text-green-600 font-medium flex items-center gap-1 justify-end">
                                  <CheckCircle size={14} /> Ajustado
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleConfirmarAjuste(d.idx)}
                                  disabled={d.confirmando}
                                  className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                                >
                                  {d.confirmando ? 'Salvando...' : 'Confirmar ajuste'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Produtos sem divergência */}
            {semDivergencia.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b flex items-center gap-2">
                  <CheckCircle className="text-green-500" size={18} />
                  <h2 className="font-semibold text-gray-700">Produtos sem divergência ({semDivergencia.length})</h2>
                </div>
                <div className="px-5 py-3 flex flex-wrap gap-2">
                  {semDivergencia.map((d) => (
                    <span key={d.produto.id} className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-100">
                      {d.produto.nome}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Histórico de contagens */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setHistoricoAberto((v) => !v)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
          >
            <h2 className="font-semibold text-gray-700">Histórico de contagens anteriores</h2>
            {historicoAberto ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>
          {historicoAberto && (
            <div className="border-t overflow-x-auto">
              {historico.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nenhuma contagem registrada ainda.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-5 py-3 text-gray-500 font-medium">Data</th>
                      <th className="text-left px-5 py-3 text-gray-500 font-medium">Produto</th>
                      <th className="text-right px-5 py-3 text-gray-500 font-medium">Sistema</th>
                      <th className="text-right px-5 py-3 text-gray-500 font-medium">Contado</th>
                      <th className="text-right px-5 py-3 text-gray-500 font-medium">Divergência</th>
                      <th className="text-center px-5 py-3 text-gray-500 font-medium">Ajustado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((c) => (
                      <tr key={c.id} className="border-t hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-600">{formatDate(c.contado_em)}</td>
                        <td className="px-5 py-3 font-medium text-gray-800">{c.produto?.nome ?? '-'}</td>
                        <td className="px-5 py-3 text-right text-gray-600">{c.quantidade_sistema}</td>
                        <td className="px-5 py-3 text-right text-gray-600">{c.quantidade_contada}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`font-semibold ${c.divergencia > 0 ? 'text-blue-600' : c.divergencia < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {c.divergencia > 0 ? '+' : ''}{c.divergencia}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {c.ajuste_confirmado
                            ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Sim</span>
                            : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Não</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
