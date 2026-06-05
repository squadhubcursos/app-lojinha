import { NextRequest, NextResponse } from 'next/server'

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN
const SLACK_USER_ID = process.env.SLACK_CHANNEL_ID

async function abrirDM(userId: string): Promise<string | null> {
  const res = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ users: userId }),
  })
  const data = await res.json()
  if (!data.ok) {
    console.error('[Slack] conversations.open falhou:', data.error)
    return null
  }
  return data.channel.id as string
}

export async function POST(request: NextRequest) {
  if (!SLACK_BOT_TOKEN || !SLACK_USER_ID) {
    console.error('[Slack] SLACK_BOT_TOKEN ou SLACK_CHANNEL_ID não configurados.')
    return NextResponse.json({ error: 'Slack não configurado' }, { status: 500 })
  }

  const body = await request.json()
  const { type, productName, productImage, quantity } = body as {
    type: 'produto_esgotado' | 'estoque_baixo'
    productName: string
    productImage?: string | null
    quantity?: number
  }

  // Abre (ou recupera) o canal DM com o usuário da ADM
  const dmChannelId = await abrirDM(SLACK_USER_ID)
  if (!dmChannelId) {
    return NextResponse.json({ error: 'Não foi possível abrir DM com a ADM' }, { status: 500 })
  }

  const blocks: object[] = []

  if (type === 'produto_esgotado') {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🚨 *Produto esgotado na lojinha!*\n*${productName}* acabou. Hora de reabastecer! 📦`,
      },
    })
  } else if (type === 'estoque_baixo') {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ *Estoque baixo!*\n*${productName}* está com apenas *${quantity} unidade(s)* no estoque. Considere repor em breve.`,
      },
    })
  }

  if (productImage) {
    blocks.push({
      type: 'image',
      image_url: productImage,
      alt_text: productName,
    })
  }

  const text = type === 'produto_esgotado'
    ? `🚨 Produto esgotado na lojinha: ${productName}`
    : `⚠️ Estoque baixo: ${productName} (${quantity} unid.)`

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel: dmChannelId, text, blocks }),
  })

  const data = await res.json()

  if (!data.ok) {
    console.error('[Slack] chat.postMessage falhou:', data.error, data)
    return NextResponse.json({ error: data.error, detail: data }, { status: 500 })
  }

  console.log('[Slack] Mensagem enviada com sucesso para', SLACK_USER_ID)
  return NextResponse.json({ success: true })
}

// GET de teste — acesse /api/slack/notify no browser para verificar conectividade
export async function GET() {
  if (!SLACK_BOT_TOKEN || !SLACK_USER_ID) {
    return NextResponse.json({ ok: false, reason: 'Variáveis SLACK_BOT_TOKEN / SLACK_CHANNEL_ID ausentes' })
  }

  const dmChannelId = await abrirDM(SLACK_USER_ID)
  if (!dmChannelId) {
    return NextResponse.json({ ok: false, reason: 'conversations.open falhou — verifique scopes do bot (im:write)' })
  }

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: dmChannelId,
      text: '✅ Teste de conexão da Lojinha — notificações funcionando!',
    }),
  })
  const data = await res.json()
  return NextResponse.json({ ok: data.ok, error: data.error ?? null, channel: dmChannelId })
}
