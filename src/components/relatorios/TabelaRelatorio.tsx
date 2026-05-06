import { Compra } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props {
  compras: Compra[]
}

export default function TabelaRelatorio({ compras }: Props) {
  const total = compras.reduce((acc, c) => acc + c.preco_unit * c.quantidade, 0)

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Data</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Produto</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Qtd</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Preço unit.</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {compras.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-4 text-gray-600">{formatDate(c.comprado_em)}</td>
                <td className="py-2 px-4 font-medium text-gray-800">{c.produto?.nome}</td>
                <td className="py-2 px-4 text-center text-gray-600">{c.quantidade}</td>
                <td className="py-2 px-4 text-right text-gray-600">{formatCurrency(c.preco_unit)}</td>
                <td className="py-2 px-4 text-right font-semibold text-gray-800">{formatCurrency(c.preco_unit * c.quantidade)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#009ada]/10 border-t-2 border-[#009ada]/30">
              <td colSpan={4} className="py-3 px-4 font-bold text-gray-700">Total</td>
              <td className="py-3 px-4 text-right font-bold text-[#009ada] text-base">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
