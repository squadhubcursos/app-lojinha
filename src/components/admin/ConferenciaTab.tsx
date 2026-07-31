'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Produto } from '@/lib/types'
import { ContextoSaldo } from '@/lib/saldos'
import { CheckCircle, TrendingUp, TrendingDown } from 'lucide-react'
import toast from 'react-hot-toast'

export interface SaldoInfo {
  produto: Produto
  saldoSistema: number
}

interface Linha {
  produto: Produto
  saldoSistema: number
  contado: number
  divergencia: number
}

interface Props {
  contexto: ContextoSaldo
  saldos: SaldoInfo[]
  loading: boolean
  onAtualizar: () => void
}

const TEXTOS: Record<ContextoSaldo, { descricao: string; titulo: string; botao: string }> = {
  estoque: {
    descricao:
      'Conte os produtos no almoxarifado. O saldo do sistema vem das entradas menos as saidas para a lojinha.',
    titulo: 'Produtos com divergencia — Estoque',
    botao: 'Confirmar conferencia do estoque',
  },
  lojinha: {
    descricao:
      'Conte os produtos na prateleira. O saldo do sistema vem das entradas na lojinha menos as vendas registradas. Faltas sao contabilizadas como inadimplencia.',
    titulo: 'Produtos com divergencia — Lojinha',
    botao: 'Confirmar conferencia da lojinha',
  },
}

export default function ConferenciaTab({ contexto, saldos, loading, onAtualizar }: Props) {
  const [contados, setContados] = useState<Record<string, string>>({})
  const [etapa, setEtapa] = useState<'preenchimento' | 'revisao'>('preenchimento')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [salvando, setSalvando] = useState(false)

  const t = TEXTOS[contexto]

  const semDivergencia = linhas.filter((l) => l.divergencia === 0)
  const comSobra = linhas.filter((l) => l.divergencia > 0)
  const comFalta = linhas.filter((l) => l.divergencia < 0)

  function handleGerarConferencia() {
    const preenchidos = saldos.filter(({ produto }) => (contados[produto.id] ?? '').trim() !== '')
    if (preenchidos.length === 0) {
      toast.error('Preencha a contagem de pelo menos um produto.')
      return
    }

    setLinhas(
      preenchidos.map(({ produto, saldoSistema }) => {
        const contado = parseInt(contados[produto.id]) || 0
        return { produto, saldoSistema, contado, divergencia: contado - saldoSistema }
      })
    )
    setEtapa('revisao')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function voltarParaPreenchimento() {
    setEtapa('preenchimento')
    setLinhas([])
  }

  /**
   * Grava a conferencia inteira de uma vez: cada produto contado vira uma linha
   * de historico, e os divergentes ganham um ajuste vinculado que faz o saldo do
   * sistema virar exatamente o valor contado.
   */
  async function handleConfirmar() {
    setSalvando(true)
    const supabase = createClient()
    const adminId = localStorage.getItem('admin_id') ?? null

    const { data: contagens, error: contErr } = await supabase
      .from('inventario_contagens')
      .insert(
        linhas.map((l) => ({
          produto_id: l.produto.id,
          contexto,
          quantidade_sistema: l.saldoSistema,
          quantidade_contada: l.contado,
          divergencia: l.divergencia,
          ajuste_confirmado: l.divergencia !== 0,
          admin_id: adminId,
        }))
      )
      .select('id, produto_id, divergencia')

    if (contErr || !contagens) {
      toast.error('Erro ao salvar a conferencia.')
      setSalvando(false)
      return
    }

    const ajustes = contagens
      .filter((c) => c.divergencia !== 0)
      .map((c) => ({
        produto_id: c.produto_id,
        tipo: 'ajuste_inventario' as const,
        quantidade: c.divergencia,
        custo_unit: null,
        contexto,
        contagem_id: c.id,
        observacao: `[${contexto}] Ajuste inventario`,
      }))

    if (ajustes.length > 0) {
      const { error: movErr } = await supabase.from('estoque_movimentacoes').insert(ajustes)
      if (movErr) {
        // As contagens ja gravadas ficariam sem ajuste; desfaz para nao deixar
        // historico mentindo sobre um saldo que nao foi corrigido.
        await supabase.from('inventario_contagens').delete().in('id', contagens.map((c) => c.id))
        toast.error('Erro ao registrar os ajustes. Nada foi salvo.')
        setSalvando(false)
        return
      }
    }

    toast.success(
      ajustes.length > 0
        ? `Conferencia salva. ${ajustes.length} ajuste(s) aplicado(s).`
        : 'Conferencia salva. Nenhuma divergencia.'
    )
    setContados({})
    setLinhas([])
    setEtapa('preenchimento')
    setSalvando(false)
    onAtualizar()
  }

  if (loading) {
    return <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-500">{t.descricao}</p>
        {etapa === 'revisao' && (
          <button onClick={voltarParaPreenchimento} className="text-sm text-[#009ada] hover:underline whitespace-nowrap">
            ← Voltar ao preenchimento
          </button>
        )}
      </div>

      {etapa === 'preenchimento' && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b">
            <p className="text-sm text-gray-500">
              Digite quantas unidades existem fisicamente. Produtos deixados em branco ficam de fora da conferencia.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Produto</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Saldo sistema</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium w-40">Contagem fisica</th>
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
                        placeholder="—"
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
              Gerar conferencia
            </button>
          </div>
        </div>
      )}

      {etapa === 'revisao' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle className="text-green-500" size={28} />
              <div>
                <p className="text-2xl font-bold text-green-700">{semDivergencia.length}</p>
                <p className="text-xs text-green-600 font-medium">Sem divergencia</p>
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

          {comFalta.length + comSobra.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b">
                <h2 className="font-semibold text-gray-700">{t.titulo}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Ao confirmar, o saldo do sistema passa a ser exatamente o valor contado.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-5 py-3 text-gray-500 font-medium">Produto</th>
                      <th className="text-right px-5 py-3 text-gray-500 font-medium">Saldo sistema</th>
                      <th className="text-right px-5 py-3 text-gray-500 font-medium">Contagem fisica</th>
                      <th className="text-right px-5 py-3 text-gray-500 font-medium">Divergencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas
                      .filter((l) => l.divergencia !== 0)
                      .map((l) => (
                        <tr key={l.produto.id} className="border-t hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-800">{l.produto.nome}</td>
                          <td className="px-5 py-3 text-right text-gray-600">{l.saldoSistema}</td>
                          <td className="px-5 py-3 text-right text-gray-600">{l.contado}</td>
                          <td className="px-5 py-3 text-right">
                            <span className={`font-bold ${l.divergencia > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                              {l.divergencia > 0 ? '+' : ''}
                              {l.divergencia}
                            </span>
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
                <h2 className="font-semibold text-gray-700">Produtos sem divergencia ({semDivergencia.length})</h2>
              </div>
              <div className="px-5 py-3 flex flex-wrap gap-2">
                {semDivergencia.map((l) => (
                  <span
                    key={l.produto.id}
                    className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-100"
                  >
                    {l.produto.nome}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleConfirmar}
              disabled={salvando}
              className="flex items-center gap-2 bg-gray-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : t.botao}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
