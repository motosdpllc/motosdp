import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url || !url.includes('ebay.com')) {
      return NextResponse.json({ error: 'URL no válida de eBay' }, { status: 400 })
    }

    // 1. Traer el HTML de la publicación
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })
    const htmlText = await res.text()

    // Limpieza agresiva: Nos quedamos con el body y barremos scripts/estilos pesados para no saturar los tokens de la IA
    const bodyMatch = htmlText.match(/<body([\s\S]*?)<\/body>/i)
    let cleanText = bodyMatch ? bodyMatch[1] : htmlText
    cleanText = cleanText
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 7000) // Ampliamos el margen para agarrar bien la ficha técnica

    // 2. Conexión con Gemini usando tu llave de Vercel
    const googleApiKey = process.env.GOOGLE_API_KEY
    if (!googleApiKey) {
      return NextResponse.json({ error: 'Falta configurar la GOOGLE_API_KEY en Vercel' }, { status: 500 })
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`

    const prompt = `
      Analizá el siguiente texto de una publicación de repuestos de motos en eBay.
      Extraé la información y devolvé un objeto JSON plano, estricto, sin bloques de código (\`\`\`), con el siguiente formato exacto:
      {
        "producto": "Traducí el nombre del repuesto al español técnico de forma clara (ej: 'Pistón y Aros', 'Kit de transmisión')",
        "marca": "Inicial de la marca: H para Honda, Y para Yamaha, S para Suzuki, K para Kawasaki, HD para Harley-Davidson. Si es otra, poné 'OTHER'",
        "ano": número de año de la moto de 4 dígitos si figura, sino null,
        "modelo": "Modelo de la moto en mayúsculas y sin espacios (ej: 'TRX400EX', 'DR350')",
        "oem": "Buscá el código de pieza original, MPN, 'Manufacturer Part Number' o 'OE/OEM Part Number'. Si no tiene, null",
        "peso": peso estimado en kg (número float. Si no figura en el texto, calculá un estimado según el repuesto: ej. juntas 0.1, biela 0.8, cilindro 3.5)"
      }

      Texto de la publicación:
      ${cleanText}
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
    
    if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      return NextResponse.json({ success: false, error: 'La IA devolvió una respuesta vacía' }, { status: 500 })
    }

    const rawJson = geminiData.candidates[0].content.parts[0].text.trim()
    const infoAutocompletada = JSON.parse(rawJson)

    return NextResponse.json({
      success: true,
      data: infoAutocompletada
    })

  } catch (error: any) {
    console.error('Error en API:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}