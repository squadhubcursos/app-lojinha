import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { gerarRelatorioPdf } from '@/lib/pdf-relatorio'

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN

async function slackJson(method: string, body: object) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

// Envia o PDF por DM usando o fluxo de upload externo do Slack (files.upload foi descontinuado).
async function enviarPdfPorDM(slackUserId: string, buffer: Buffer, filename: string, comentario: string) {
  const dm = await slackJson('conversations.open', { users: slackUserId })
  if (!dm.ok) throw new Error(`conversations.open: ${dm.error}`)

  const params = new URLSearchParams({ filename, length: String(buffer.length) })
  const urlRes = await fetch(`https://slack.com/api/files.getUploadURLExternal?${params}`, {
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
  })
  const urlData = await urlRes.json()
  if (!urlData.ok) throw new Error(`files.getUploadURLExternal: ${urlData.error}`)

  const upload = await fetch(urlData.upload_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: new Uint8Array(buffer),
  })
  if (!upload.ok) throw new Error(`upload do arquivo falhou: ${upload.status}`)

  const done = await slackJson('files.completeUploadExternal', {
    files: [{ id: urlData.file_id, title: filename }],
    channel_id: dm.channel.id,
    initial_comment: comentario,
  })
  if (!done.ok) throw new Error(`files.completeUploadExternal: ${done.error}`)
}

export async function POST(request: NextRequest) {
  if (!SLACK_BOT_TOKEN) {
    console.error('[Slack] SLACK_BOT_TOKEN não configurado.')
    return NextResponse.json({ error: 'Slack não configurado' }, { status: 500 })
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
