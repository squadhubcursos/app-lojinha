import { NextRequest, NextResponse } from 'next/server'
import { gerarRelatorioPdf } from '@/lib/pdf-relatorio'

export async function POST(req: NextRequest) {
  const { usuario_id, inicio, fim, periodo_label } = await req.json()
  const { buffer } = await gerarRelatorioPdf({ usuario_id, inicio, fim, periodo_label })
  const uint8Array = new Uint8Array(buffer)

  return new NextResponse(uint8Array, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="relatorio.pdf"',
    },
  })
}
