import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url || !url.includes('ebay.com')) {
      return NextResponse.json({ error: 'URL no válida de eBay' }, { status: 400 })
    }

    // 1. Conseguimos el HTML bruto de la publicación de eBay
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
      }
    })
    const htmlText = await res.text()

    // Recortamos el HTML para pasarle a la IA solo el título y la caja de especificaciones del repuesto
    const specsMatch = htmlText.match(/<div class="ux-layout-section-evo__item">([\s\S]*?)<\/div>/g) || []
    const titleMatch = htmlText.match(/<h1 class="x-item-title__main">([\s\S]*?)<\/h1>/) || []
    const rawDataText = (titleMatch[0] || '') + ' ' + specsMatch.join(' ')
    const textClean = rawDataText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 3500)

    // 2. Conexión con Gemini usando la GOOGLE_API_KEY de tu Vercel
    const googleApiKey = process.env.GOOGLE_API_KEY
    if (!googleApiKey) {
      return NextResponse.json({ error: 'Falta configurar la GOOGLE_API_KEY en las variables de entorno' }, { status: 500 })
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`

    const prompt = `
      Analizá este texto de una publicación de repuestos de moto en eBay.
      Devolvé estrictamente un objeto JSON plano (sin markdown, sin bloques de código \`\`\`, sin texto extra) con este formato exacto:
      {
        "producto": "Traducí el título del repuesto al español de forma clara para un mecánico de motos",
        "marca": "Detectar marca (usar solo la letra inicial en mayúscula: H para Honda, Y para Yamaha, S para Suzuki, K para Kawasaki, HD para Harley-Davidson, o sino 'OTHER')",
        "ano": número de año de la moto de 4 dígitos o null,
        "modelo": "modelo de la moto en mayúsculas sin espacios",
        "oem": "número de pieza original o MPN si figura, sino null",
        "peso": peso estimado del repuesto en kg (número float, ej: 0.45 para un pistón, 3.2 para un cilindro. Si no sabés estimá según el tipo de repuesto)"
      }

      Texto de eBay:
      ${textClean}
    `

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    })

    const geminiData = await geminiResponse.json()
    const rawJson = geminiData.candidates[0].content.parts[0].text.trim()
    const infoAutocompletada = JSON.parse(rawJson)

    return NextResponse.json({
      success: true,
      data: infoAutocompletada
    })

  } catch (error: any) {
    console.error('Error en API parse-ebay:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}