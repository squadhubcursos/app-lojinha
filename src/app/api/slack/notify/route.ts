import { NextRequest, NextResponse } from 'next/server'

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN
const SLACK_CHANNEL = process.env.SLACK_CHANNEL_ID

export async function POST(request: NextRequest) {
  if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
    console.error('Slack não configurado: SLACK_BOT_TOKEN ou SLACK_CHANNEL_ID ausentes.')
    return NextResponse.json({ error: 'Slack não configurado' }, { status: 500 })
  }

  const body = await request.json()
  const { type, productName, productImage, quantity } = body as {
    type: 'produto_esgotado' | 'estoque_baixo'
    productName: string
    productImage?: string | null
    quantity?: number
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
    body: JSON.stringify({ channel: SLACK_CHANNEL, text, blocks }),
  })

  const data = await res.json()

  if (!data.ok) {
    console.error('Slack API error:', data.error)
    return NextResponse.json({ error: data.error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
