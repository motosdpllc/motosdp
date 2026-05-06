import { NextRequest, NextResponse } from 'next/server'

// ── PROVEEDOR DE IA ────────────────────────────────────────
// Cambiá AI_PROVIDER en Vercel para cambiar de proveedor:
//   AI_PROVIDER=gemini  → usa Google Gemini (gratis)
//   AI_PROVIDER=anthropic → usa Anthropic Claude (de pago)
// Si no configurás nada, usa Gemini por defecto.

async function llamarGemini(prompt: string, imageBase64?: string, imageType?: string) {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('GOOGLE_API_KEY no configurada en Vercel')

  const parts: any[] = []

  if (imageBase64 && imageType) {
    parts.push({ inline_data: { mime_type: imageType, data: imageBase64 } })
  }
  parts.push({ text: prompt })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error('Gemini error: ' + err)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Devolvemos en formato compatible con Anthropic para que el frontend no cambie
  return { content: [{ type: 'text', text }] }
}

async function llamarAnthropic(body: any) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada en Vercel')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error('Anthropic error: ' + err)
  }

  return res.json()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const provider = process.env.AI_PROVIDER || 'gemini'

    let result

    if (provider === 'anthropic') {
      result = await llamarAnthropic(body)
    } else {
      // Gemini — extraemos el prompt y la imagen del formato Anthropic
      // que manda el frontend, y lo convertimos al formato de Gemini
      const messages = body.messages || []
      const lastMessage = messages[messages.length - 1]
      const content = lastMessage?.content || []

      let prompt = ''
      let imageBase64 = ''
      let imageType = ''

      if (typeof content === 'string') {
        prompt = content
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            prompt = block.text
          } else if (block.type === 'image' && block.source?.type === 'base64') {
            imageBase64 = block.source.data
            imageType = block.source.media_type
          } else if (block.type === 'document' && block.source?.type === 'base64') {
            // PDF — Gemini lo maneja igual que imagen
            imageBase64 = block.source.data
            imageType = block.source.media_type
          }
        }
      }

      result = await llamarGemini(prompt, imageBase64 || undefined, imageType || undefined)
    }

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('AI API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
