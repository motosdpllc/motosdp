import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { textoPublicacion } = await request.json()

    if (!textoPublicacion) {
      return NextResponse.json({ error: 'No se recibió texto para analizar' }, { status: 400 })
    }

    const googleApiKey = process.env.GOOGLE_API_KEY
    if (!googleApiKey) {
      return NextResponse.json({ error: 'Falta configurar la GOOGLE_API_KEY en Vercel' }, { status: 500 })
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`

    const prompt = `
      Analizá el siguiente texto extraído de una publicación de repuestos de motos en eBay.
      Extraé la información técnica y devolvé un objeto JSON plano, estricto, sin bloques de código (\`\`\`), con el siguiente formato exacto:
      {
        "producto": "Traducí el nombre del repuesto al español técnico de forma clara (ej: 'Pistón y Aros', 'Kit de transmisión')",
        "marca": "Inicial de la marca: H para Honda, Y para Yamaha, S para Suzuki, K para Kawasaki, HD para Harley-Davidson. Si es otra, poné 'OTHER'",
        "ano": número de año de la moto de 4 dígitos si figura, sino null,
        "modelo": "Modelo de la moto en mayúsculas y sin espacios (ej: 'TRX400EX', 'DR350')",
        "oem": "Buscá el código de pieza original, MPN, 'Manufacturer Part Number' o 'OE/OEM Part Number'. Si no tiene, null",
        "peso": peso estimado en kg (número float. Si no figura en el texto, calculá un estimado según el repuesto: ej. juntas 0.1, biela 0.8, bendix 0.6, cilindro 3.5)"
      }

      Texto de la publicación:
      ${textoPublicacion.slice(0, 6000)}
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
      return NextResponse.json({ success: false, error: 'La IA no pudo procesar el texto' }, { status: 500 })
    }

    const rawJson = geminiData.candidates[0].content.parts[0].text.trim()
    const infoAutocompletada = JSON.parse(rawJson)

    return NextResponse.json({
      success: true,
      data: infoAutocompletada
    })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}