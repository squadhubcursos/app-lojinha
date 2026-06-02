'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Produto } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { CheckCircle, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Check, X, Trash2, Pencil, Save, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

type Aba = 'estoque' | 'lojinha'

interface SaldoInfo {
  produto: Produto
  saldoSistema: number
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
  contexto: string | null
  quantidade_sistema: number
  quantidade_contada: number
  divergencia: number
  ajuste_confirmado: boolean
  contado_em: string
  produto?: { nome: string }
}

type LojinhaStatus = 'idle' | 'ok' | 'divergencia'

export default function ConferenciaEstoquePage() {
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('estoque')
  const [saldosEstoque, setSaldosEstoque] = useState<SaldoInfo[]>([])
  const [saldosLojinha, setSaldosLojinha] = useState<SaldoInfo[]>([])

  // Estoque tab
  const [contados, setContados] = useState<Record<string, string>>({})
  const [divergencias, setDivergencias] = useState<Divergencia[]>([])
  const [etapa, setEtapa] = useState<'preenchimento' | 'revisao'>('preenchimento')
  const [historicoEstoqueSalvo, setHistoricoEstoqueSalvo] = useState(false)
  const [salvandoHistoricoEstoque, setSalvandoHistoricoEstoque] = useState(false)

  // Lojinha tab - estado persiste ao trocar de aba
  const [lojinhaStatus, setLojinhaStatus] = useState<Record<string, LojinhaStatus>>({})
  const [lojinhaDivInput, setLojinhaDivInput] = useState<Record<string, string>>({})
  const [salvandoHistoricoLojinha, setSalvandoHistoricoLojinha] = useState(false)

  const [historico, setHistorico] = useState<Contagem[]>([])
  const [historicoEstoqueAberto, setHistoricoEstoqueAberto] = useState(false)
  const [historicoLojinhaAberto, setHistoricoLojinhaAberto] = useState(false)
  const [loading, setLoading] = useState(true)
  const [excluindoHistorico, setExcluindoHistorico] = useState<string | null>(null)

  // Edição inline do histórico
  const [editandoContagem, setEditandoContagem] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ quantidade_sistema: string; quantidade_contada: string }>({ quantidade_sistema: '', quantidade_contada: '' })
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('isAdmin')) { router.replace('/admin'); return }
    fetchSaldos()
    fetchHistorico()
  }, [router])

  // Não resetar estado ao trocar de aba — preserva o progresso da conferência
  function handleAba(nova: Aba) {
    setAba(nova)
  }

  async function fetchSaldos() {
    const supabase = createClient()
    const [{ data: produtos }, { data: movs }] = await Promise.all([
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
      supabase.from('estoque_movimentacoes').select('produto_id, tipo, quantidade, observacao'),
    ])

    const estoqueMap: Record<string, number> = {}
    const lojinhaMap: Record<string, number> = {}

    ;(movs ?? []).forEach((m) => {
      if (m.tipo === 'entrada_estoque') {
        estoqueMap[m.produto_id] = (estoqueMap[m.produto_id] ?? 0) + m.quantidade
      } else if (m.tipo === 'saida_estoque') {
        estoqueMap[m.produto_id] = (estoqueMap[m.produto_id] ?? 0) - m.quantidade
      } else if (m.tipo === 'entrada_lojinha') {
        lojinhaMap[m.produto_id] = (lojinhaMap[m.produto_id] ?? 0) + m.quantidade
      } else if (m.tipo === 'saida_lojinha') {
        lojinhaMap[m.produto_id] = (lojinhaMap[m.produto_id] ?? 0) - m.quantidade
      } else if (m.tipo === 'ajuste_inventario') {
        if (m.observacao?.includes('[lojinha]')) {
          lojinhaMap[m.produto_id] = (lojinhaMap[m.produto_id] ?? 0) + m.quantidade
        } else {
          estoqueMap[m.produto_id] = (estoqueMap[m.produto_id] ?? 0) + m.quantidade
        }
      }
    })

    const prods = produtos ?? []
    setSaldosEstoque(prods.map((p) => ({ produto: p, saldoSistema: estoqueMap[p.id] ?? 0 })))
    setSaldosLojinha(prods.map((p) => ({ produto: p, saldoSistema: lojinhaMap[p.id] ?? 0 })))
    setLoading(false)
  }

  async function fetchHistorico() {
    const supabase = createClient()
    const { data } = await supabase
      .from('inventario_contagens')
      .select('*, produto:produtos(nome)')
      .order('contado_em', { ascending: false })
      .limit(200)
    setHistorico((data ?? []) as Contagem[])
  }

  // Valores derivados
  const allLojinhaMarked = saldosLojinha.length > 0 && saldosLojinha.every(({ produto }) => {
    const status = lojinhaStatus[produto.id] ?? 'idle'
    return status === 'ok' || (status === 'divergencia' && (lojinhaDivInput[produto.id] ?? '').trim() !== '')
  })

  const allEstoqueConferida = divergencias.length > 0 && divergencias.every((d) => d.divergencia === 0 || d.confirmado)

  const semDivergencia = divergencias.filter((d) => d.divergencia === 0)
  const comSobra = divergencias.filter((d) => d.divergencia > 0)
  const comFalta = divergencias.filter((d) => d.divergencia < 0)

  const historicoEstoqueItems = historico.filter((c) => c.contexto === 'estoque')
  const historicoLojinhaItems = historico.filter((c) => c.contexto === 'lojinha')

  // --- Estoque ---
  function handleGerarConferencia() {
    const divs: Divergencia[] = saldosEstoque.map(({ produto, saldoSistema }) => {
      const contadoVal = parseInt(contados[produto.id] ?? '0') || 0
      return { produto, saldoSistema, contado: contadoVal, divergencia: contadoVal - saldoSistema, confirmado: false, confirmando: false }
    })
    setDivergencias(divs)
    setEtapa('revisao')
    setHistoricoEstoqueSalvo(false)
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
      .insert({ produto_id: item.produto.id, contexto: 'estoque', quantidade_sistema: item.saldoSistema, quantidade_contada: item.contado, divergencia: item.divergencia, ajuste_confirmado: true, admin_id: adminId })
      .select().single()

    if (contErr) { toast.error('Erro ao salvar contagem.'); setDivergencias((prev) => prev.map((d, i) => i === idx ? { ...d, confirmando: false } : d)); return }

    const { error: movErr } = await supabase.from('estoque_movimentacoes').insert({
      produto_id: item.produto.id, tipo: 'ajuste_inventario', quantidade: item.divergencia, custo_unit: null,
      observacao: `[estoque] Ajuste inventário — contagem ${contagem.id}`,
    })

    if (movErr) { toast.error('Erro ao registrar ajuste.'); setDivergencias((prev) => prev.map((d, i) => i === idx ? { ...d, confirmando: false } : d)); return }

    toast.success(`Ajuste confirmado: ${item.produto.nome}`)
    setDivergencias((prev) => prev.map((d, i) => i === idx ? { ...d, confirmado: true, confirmando: false } : d))
    fetchHistorico()
    fetchSaldos()
  }

  async function handleSalvarHistoricoEstoque() {
    setSalvandoHistoricoEstoque(true)
    const supabase = createClient()
    const adminId = localStorage.getItem('admin_id') ?? null

    // Itens sem divergência ainda não foram salvos no histórico
    const semDiv = divergencias.filter((d) => d.divergencia === 0)
    if (semDiv.length > 0) {
      const { error } = await supabase.from('inventario_contagens').insert(
        semDiv.map((d) => ({
          produto_id: d.produto.id,
          contexto: 'estoque',
          quantidade_sistema: d.saldoSistema,
          quantidade_contada: d.contado,
          divergencia: 0,
          ajuste_confirmado: true,
          admin_id: adminId,
        }))
      )
      if (error) { toast.error('Erro ao salvar histórico.'); setSalvandoHistoricoEstoque(false); return }
    }

    toast.success('Histórico do estoque salvo!')
    setHistoricoEstoqueSalvo(true)
    setSalvandoHistoricoEstoque(false)
    fetchHistorico()
  }

  // --- Lojinha ---
  async function handleSalvarHistoricoLojinha() {
    setSalvandoHistoricoLojinha(true)
    const supabase = createClient()
    const adminId = localStorage.getItem('admin_id') ?? null

    const insertsContagem: {
      produto_id: string; contexto: string; quantidade_sistema: number
      quantidade_contada: number; divergencia: number; ajuste_confirmado: boolean; admin_id: string | null
    }[] = []
    const insertsMov: {
      produto_id: string; tipo: string; quantidade: number; custo_unit: null; observacao: string
    }[] = []

    for (const { produto, saldoSistema } of saldosLojinha) {
      const status = lojinhaStatus[produto.id] ?? 'idle'
      if (status === 'idle') continue

      let divVal = 0
      let contadoVal = saldoSistema

      if (status === 'divergencia') {
        divVal = parseInt(lojinhaDivInput[produto.id] ?? '0') || 0
        contadoVal = saldoSistema + divVal
      }

      insertsContagem.push({
        produto_id: produto.id,
        contexto: 'lojinha',
        quantidade_sistema: saldoSistema,
        quantidade_contada: contadoVal,
        divergencia: divVal,
        ajuste_confirmado: divVal !== 0,
        admin_id: adminId,
      })

      if (divVal !== 0) {
        insertsMov.push({
          produto_id: produto.id,
          tipo: 'ajuste_inventario',
          quantidade: divVal,
          custo_unit: null,
          observacao: `[lojinha] Ajuste inventário`,
        })
      }
    }

    if (insertsContagem.length === 0) {
      toast.error('Nenhum produto marcado.')
      setSalvandoHistoricoLojinha(false)
      return
    }

    const { error } = await supabase.from('inventario_contagens').insert(insertsContagem)
    if (error) { toast.error('Erro ao salvar histórico.'); setSalvandoHistoricoLojinha(false); return }

    if (insertsMov.length > 0) {
      const { error: movErr } = await supabase.from('estoque_movimentacoes').insert(insertsMov)
      if (movErr) { toast.error('Erro ao registrar ajustes.'); setSalvandoHistoricoLojinha(false); return }
    }

    toast.success('Histórico da lojinha salvo!')
    setLojinhaStatus({})
    setLojinhaDivInput({})
    setSalvandoHistoricoLojinha(false)
    fetchHistorico()
    fetchSaldos()
  }

  // --- Histórico ---
  async function handleDeleteHistorico(contagem: Contagem) {
    setExcluindoHistorico(contagem.id)
    const supabase = createClient()
    await supabase.from('estoque_movimentacoes').delete().like('observacao', `%contagem ${contagem.id}%`)
    const { error } = await supabase.from('inventario_contagens').delete().eq('id', contagem.id)
    if (error) { toast.error('Erro ao excluir.') }
    else { toast.success('Registro excluído.'); setHistorico((prev) => prev.filter((c) => c.id !== contagem.id)) }
    setExcluindoHistorico(null)
    fetchSaldos()
  }

  function handleIniciarEdicao(c: Contagem) {
    setEditandoContagem(c.id)
    setEditValues({ quantidade_sistema: String(c.quantidade_sistema), quantidade_contada: String(c.quantidade_contada) })
  }

  async function handleSalvarEdicao(id: string) {
    setSalvandoEdicao(true)
    const qs = parseInt(editValues.quantidade_sistema) || 0
    const qc = parseInt(editValues.quantidade_contada) || 0
    const div = qc - qs
    const supabase = createClient()
    const { error } = await supabase
      .from('inventario_contagens')
      .update({ quantidade_sistema: qs, quantidade_contada: qc, divergencia: div })
      .eq('id', id)
    if (error) { toast.error('Erro ao atualizar.') }
    else { toast.success('Registro atualizado!'); setEditandoContagem(null); fetchHistorico() }
    setSalvandoEdicao(false)
  }

  function renderHistoricoTabela(items: Contagem[]) {
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
              <th className="text-right px-5 py-3 text-gray-500 font-medium">Divergência</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const isEditing = editandoContagem === c.id
              const editedDiv = isEditing
                ? (parseInt(editValues.quantidade_contada) || 0) - (parseInt(editValues.quantidade_sistema) || 0)
                : null
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
                    {isEditing ? (
                      <span className={`font-semibold ${editedDiv! > 0 ? 'text-blue-600' : editedDiv! < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {editedDiv! > 0 ? '+' : ''}{editedDiv}
                      </span>
                    ) : (
                      <span className={`font-semibold ${c.divergencia > 0 ? 'text-blue-600' : c.divergencia < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {c.divergencia > 0 ? '+' : ''}{c.divergencia}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => handleSalvarEdicao(c.id)} disabled={salvandoEdicao}
                          className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors" title="Salvar">
                          <Save size={14} />
                        </button>
                        <button onClick={() => setEditandoContagem(null)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Cancelar">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => handleIniciarEdicao(c)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors" title="Editar">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDeleteHistorico(c)} disabled={excluindoHistorico === c.id}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40" title="Excluir">
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Conferência de Estoque</h1>
          <div className="flex items-center gap-3">
            {aba === 'estoque' && etapa === 'revisao' && (
              <button onClick={() => { setEtapa('preenchimento'); setContados({}) }} className="text-sm text-[#009ada] hover:underline">
                ← Voltar ao preenchimento
              </button>
            )}
            {aba === 'lojinha' && Object.keys(lojinhaStatus).length > 0 && (
              <button onClick={() => { setLojinhaStatus({}); setLojinhaDivInput({}) }}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors">
                <RotateCcw size={13} /> Reiniciar conferência
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(['estoque', 'lojinha'] as Aba[]).map((a) => (
            <button key={a} onClick={() => handleAba(a)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${aba === a ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {a === 'estoque' ? 'Conferência do Estoque' : 'Conferência da Lojinha'}
            </button>
          ))}
        </div>

        {/* ESTOQUE TAB */}
        {aba === 'estoque' && (
          <>
            <p className="text-sm text-gray-500 -mt-2">Conta os produtos no almoxarifado. Compara entradas menos saídas para a lojinha.</p>

            {etapa === 'preenchimento' && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b">
                  <p className="text-sm text-gray-500">Preencha a quantidade física contada para cada produto. Campos em branco serão considerados como 0.</p>
                </div>
                {loading ? <div className="p-8 text-center text-gray-400">Carregando...</div> : (
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
                          {saldosEstoque.map(({ produto, saldoSistema }) => (
                            <tr key={produto.id} className="border-t hover:bg-gray-50">
                              <td className="px-5 py-3 font-medium text-gray-800">{produto.nome}</td>
                              <td className="px-5 py-3 text-right text-gray-600">{saldoSistema} unid.</td>
                              <td className="px-5 py-3 text-right">
                                <input type="number" min="0" value={contados[produto.id] ?? ''} onChange={(e) => setContados((prev) => ({ ...prev, [produto.id]: e.target.value }))} placeholder="0"
                                  className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-[#009ada]/30 focus:border-[#009ada]" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-5 border-t">
                      <button onClick={handleGerarConferencia} className="bg-[#009ada] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#007bb5] transition-colors">
                        Gerar conferência
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {etapa === 'revisao' && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center gap-3">
                    <CheckCircle className="text-green-500" size={28} />
                    <div><p className="text-2xl font-bold text-green-700">{semDivergencia.length}</p><p className="text-xs text-green-600 font-medium">Sem divergência</p></div>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3">
                    <TrendingUp className="text-blue-500" size={28} />
                    <div><p className="text-2xl font-bold text-blue-700">{comSobra.length}</p><p className="text-xs text-blue-600 font-medium">Com sobra</p></div>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
                    <TrendingDown className="text-red-500" size={28} />
                    <div><p className="text-2xl font-bold text-red-700">{comFalta.length}</p><p className="text-xs text-red-600 font-medium">Com falta</p></div>
                  </div>
                </div>

                {(comFalta.length > 0 || comSobra.length > 0) && (
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b">
                      <h2 className="font-semibold text-gray-700">Produtos com divergência — Estoque</h2>
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
                          {divergencias.map((d, idx) => ({ ...d, idx })).filter((d) => d.divergencia !== 0).map((d) => (
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
                                  <span className="text-xs text-green-600 font-medium flex items-center gap-1 justify-end"><CheckCircle size={14} /> Ajustado</span>
                                ) : (
                                  <button onClick={() => handleConfirmarAjuste(d.idx)} disabled={d.confirmando}
                                    className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
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

                {semDivergencia.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b flex items-center gap-2">
                      <CheckCircle className="text-green-500" size={18} />
                      <h2 className="font-semibold text-gray-700">Produtos sem divergência ({semDivergencia.length})</h2>
                    </div>
                    <div className="px-5 py-3 flex flex-wrap gap-2">
                      {semDivergencia.map((d) => (
                        <span key={d.produto.id} className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-100">{d.produto.nome}</span>
                      ))}
                    </div>
                  </div>
                )}

                {allEstoqueConferida && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSalvarHistoricoEstoque}
                      disabled={salvandoHistoricoEstoque || historicoEstoqueSalvo}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-colors ${
                        historicoEstoqueSalvo
                          ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                          : 'bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50'
                      }`}
                    >
                      {historicoEstoqueSalvo ? (
                        <><CheckCircle size={16} /> Histórico salvo</>
                      ) : salvandoHistoricoEstoque ? 'Salvando...' : 'Salvar Histórico do Estoque'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* LOJINHA TAB */}
        {aba === 'lojinha' && (
          <>
            <p className="text-sm text-gray-500 -mt-2">Confira os produtos na prateleira. Marque ✓ se o saldo bate, ou ✗ para registrar uma divergência. Depois clique em <strong>Salvar Histórico</strong>.</p>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {loading ? <div className="p-8 text-center text-gray-400">Carregando...</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-5 py-3 text-gray-500 font-medium">Produto</th>
                        <th className="text-right px-5 py-3 text-gray-500 font-medium">Saldo sistema</th>
                        <th className="px-5 py-3 text-gray-500 font-medium text-center w-72">Conferência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saldosLojinha.map(({ produto, saldoSistema }) => {
                        const status = lojinhaStatus[produto.id] ?? 'idle'
                        return (
                          <tr key={produto.id} className={`border-t ${status !== 'idle' ? 'bg-gray-50/60' : 'hover:bg-gray-50'}`}>
                            <td className="px-5 py-3 font-medium text-gray-800">{produto.nome}</td>
                            <td className="px-5 py-3 text-right text-gray-600">{saldoSistema} unid.</td>
                            <td className="px-5 py-3">
                              {status === 'idle' && (
                                <div className="flex items-center justify-center gap-2">
                                  <button onClick={() => setLojinhaStatus((prev) => ({ ...prev, [produto.id]: 'ok' }))}
                                    className="flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                                    <Check size={13} /> OK
                                  </button>
                                  <button onClick={() => setLojinhaStatus((prev) => ({ ...prev, [produto.id]: 'divergencia' }))}
                                    className="flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                                    <X size={13} /> Divergência
                                  </button>
                                </div>
                              )}
                              {status === 'ok' && (
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircle size={14} /> Conferido</span>
                                  <button onClick={() => setLojinhaStatus((prev) => ({ ...prev, [produto.id]: 'idle' }))} className="text-xs text-gray-400 hover:text-gray-600 underline">desfazer</button>
                                </div>
                              )}
                              {status === 'divergencia' && (
                                <div className="flex items-center justify-center gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-500 whitespace-nowrap">Divergência:</span>
                                    <input type="number" value={lojinhaDivInput[produto.id] ?? ''} onChange={(e) => setLojinhaDivInput((prev) => ({ ...prev, [produto.id]: e.target.value }))}
                                      placeholder="ex: -3"
                                      className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#009ada]/30 focus:border-[#009ada]" />
                                  </div>
                                  <button onClick={() => setLojinhaStatus((prev) => ({ ...prev, [produto.id]: 'idle' }))} className="text-xs text-gray-400 hover:text-gray-600 underline">cancelar</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {allLojinhaMarked && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSalvarHistoricoLojinha}
                  disabled={salvandoHistoricoLojinha}
                  className="flex items-center gap-2 bg-gray-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {salvandoHistoricoLojinha ? 'Salvando...' : 'Salvar Histórico da Lojinha'}
                </button>
              </div>
            )}
          </>
        )}

        {/* HISTÓRICO DO ESTOQUE */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button onClick={() => setHistoricoEstoqueAberto((v) => !v)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium border border-orange-100">Estoque</span>
              <h2 className="font-semibold text-gray-700">Histórico de contagens — Estoque ({historicoEstoqueItems.length})</h2>
            </div>
            {historicoEstoqueAberto ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>
          {historicoEstoqueAberto && (
            <div className="border-t">
              {renderHistoricoTabela(historicoEstoqueItems)}
            </div>
          )}
        </div>

        {/* HISTÓRICO DA LOJINHA */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button onClick={() => setHistoricoLojinhaAberto((v) => !v)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium border border-purple-100">Lojinha</span>
              <h2 className="font-semibold text-gray-700">Histórico de contagens — Lojinha ({historicoLojinhaItems.length})</h2>
            </div>
            {historicoLojinhaAberto ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>
          {historicoLojinhaAberto && (
            <div className="border-t">
              {renderHistoricoTabela(historicoLojinhaItems)}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
