'use client'

import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, format,
} from 'date-fns'

export type PresetPeriodo = 'semana' | 'mes_atual' | 'mes_anterior' | 'personalizado'

export interface Periodo {
  inicio: Date
  fim: Date
}

/** A semana da lojinha vai de sabado a sexta. */
const WEEK_START = 6

const PRESETS: { valor: PresetPeriodo; label: string }[] = [
  { valor: 'semana', label: 'Esta semana' },
  { valor: 'mes_atual', label: 'Este mes' },
  { valor: 'mes_anterior', label: 'Mes anterior' },
  { valor: 'personalizado', label: 'Personalizado' },
]

export function periodoDoPreset(preset: PresetPeriodo, hoje = new Date()): Periodo {
  switch (preset) {
    case 'mes_atual':
      return { inicio: startOfMonth(hoje), fim: endOfMonth(hoje) }
    case 'mes_anterior': {
      const anterior = subMonths(hoje, 1)
      return { inicio: startOfMonth(anterior), fim: endOfMonth(anterior) }
    }
    default:
      return {
        inicio: startOfWeek(hoje, { weekStartsOn: WEEK_START }),
        fim: endOfWeek(hoje, { weekStartsOn: WEEK_START }),
      }
  }
}

export function rotuloPeriodo({ inicio, fim }: Periodo): string {
  return `${format(inicio, 'dd/MM/yyyy')} a ${format(fim, 'dd/MM/yyyy')}`
}

interface Props {
  preset: PresetPeriodo
  onPreset: (p: PresetPeriodo) => void
  dataInicio: string
  dataFim: string
  onDataInicio: (v: string) => void
  onDataFim: (v: string) => void
}

export default function FiltroPeriodo({
  preset, onPreset, dataInicio, dataFim, onDataInicio, onDataFim,
}: Props) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-wrap items-end gap-4">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {PRESETS.map((p) => (
          <button
            key={p.valor}
            onClick={() => onPreset(p.valor)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              preset === p.valor ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'personalizado' && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">De</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => onDataInicio(e.target.value)}
              className="border border-input rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Ate</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => onDataFim(e.target.value)}
              className="border border-input rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      )}
    </div>
  )
}
