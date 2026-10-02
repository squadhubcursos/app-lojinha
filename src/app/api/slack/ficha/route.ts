import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { gerarRelatorioPdf } from '@/lib/pdf-relatorio'

const WEBHOOK_URL = process.env.N8N_FICHA_WEBHOOK_URL
const WEBHOOK_SECRET = process.env.N8N_FICHA_WEBHOOK_SECRET

// O workflow do n8n abre a DM e anexa o PDF usando a credencial do SquadBuddy.
async function enviarPdfPorDM(slackUserId: string, buffer: Buffer, filename: string, comentario: string) {
  const res = await fetch(WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ficha-secret': WEBHOOK_SECRET! },
    body: JSON.stringify({
      slack_user_id: slackUserId,
      filename,
      comment: comentario,
      pdf_base64: buffer.toString('base64'),
    }),
  })
  if (!res.ok) throw new Error(`webhook n8n respondeu ${res.status}: ${await res.text()}`)
}

export async function POST(request: NextRequest) {
  if (!WEBHOOK_URL || !WEBHOOK_SECRET) {
    console.error('[Slack] N8N_FICHA_WEBHOOK_URL ou N8N_FICHA_WEBHOOK_SECRET não configurados.')
    return NextResponse.json({ error: 'Envio não configurado' }, { status: 500 })
  }

  const { usuario_id, inicio, fim, periodo_label } = await request.json()
  if (!usuario_id || !inicio || !fim) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('nome, slack_user_id')
    .eq('id', usuario_id)
    .single()

  if (!usuario?.slack_user_id) {
    return NextResponse.json({ error: 'sem_slack_id' }, { status: 422 })
  }

  try {
    const { buffer, nomeUsuario } = await gerarRelatorioPdf({ usuario_id, inicio, fim, periodo_label })
    const slug = (nomeUsuario ?? 'usuario').replace(/\s+/g, '-').toLowerCase()
    await enviarPdfPorDM(
      usuario.slack_user_id,
      buffer,
      `ficha-${slug}.pdf`,
      `📋 Sua ficha da lojinha — ${periodo_label ?? ''}`.trim()
    )
  } catch (err) {
    console.error('[Slack] envio da ficha falhou:', err)
    return NextResponse.json({ error: 'envio_falhou' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
