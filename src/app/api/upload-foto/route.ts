import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() ?? 'png'
  const filename = `${Date.now()}.${ext}`
  const dest = path.join(process.cwd(), 'public', 'funcionarios', filename)

  await writeFile(dest, buffer)

  return NextResponse.json({ url: `/funcionarios/${filename}` })
}
