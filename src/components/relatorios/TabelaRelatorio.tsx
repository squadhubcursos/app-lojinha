'use client'

import { useState } from 'react'
import { Compra } from '@/lib/types'
import { formatCurrency, formatDate, formatTime } from '@/lib/utils'
import { Trash2, Minus, Plus } from 'lucide-react'

interface Props {
  compras: Compra[]
  onDelete?: (compraId: string) => void
  onAjustarQtd?: (compraId: string, novaQtd: number) => void
}

export default function TabelaRelatorio({ compras, onDelete, onAjustarQtd }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const interativo = !!(onDelete || onAjustarQtd)

  const total = compras.reduce((acc, c) => acc + c.preco_unit * c.quantidade, 0)

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Data</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Horario</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Produto</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Qtd</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Preco unit.</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Subtotal</th>
              {interativo && <th className="py-3 px-4"></th>}
            </tr>
          </thead>
          <tbody>
            {compras.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-4 text-gray-600 whitespace-nowrap">{formatDate(c.comprado_em)}</td>
                <td className="py-2 px-4 text-gray-500 whitespace-nowrap">{formatTime(c.comprado_em)}</td>
                <td className="py-2 px-4 font-medium text-gray-800">{c.produto?.nome}</td>
                <td className="py-2 px-4 text-center text-gray-600">
                  {onAjustarQtd ? (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onAjustarQtd(c.id, c.quantidade - 1)}
                        disabled={c.quantidade <= 1}
                        className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-30 transition-colors"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="w-6 text-center font-semibold">{c.quantidade}</span>
                      <button
                        onClick={() => onAjustarQtd(c.id, c.quantidade + 1)}
                        className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  ) : c.quantidade}
                </td>
                <td className="py-2 px-4 text-right text-gray-600">{formatCurrency(c.preco_unit)}</td>
                <td className="py-2 px-4 text-right font-semibold text-gray-800">{formatCurrency(c.preco_unit * c.quantidade)}</td>
                {interativo && (
                  <td className="py-2 px-4 text-right">
                    {onDelete && (
                      confirmDelete === c.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border rounded">
                            Cancelar
                          </button>
                          <button onClick={() => { onDelete(c.id); setConfirmDelete(null) }} className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded">
                            Confirmar
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(c.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#009ada]/10 border-t-2 border-[#009ada]/30">
              <td colSpan={interativo ? 5 : 4} className="py-3 px-4 font-bold text-gray-700">Total</td>
              <td className="py-3 px-4 text-right font-bold text-[#009ada] text-base">{formatCurrency(total)}</td>
              {interativo && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
