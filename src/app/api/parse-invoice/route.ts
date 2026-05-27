import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error("GOOGLE_API_KEY no está configurada en el servidor.");
  throw new Error('GOOGLE_API_KEY no está configurada.');
}

const genAI = new GoogleGenerativeAI(API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { file, media_type, file_name } = await req.json();

    if (!file || !media_type) {
      return NextResponse.json({ error: 'Falta el archivo o el tipo de medio.' }, { status: 400 });
    }

    // --- CAMBIO AQUÍ: Nombre del modelo más específico ---
    const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro-vision-latest" }); 
    // Si este falla, también podríamos intentar "gemini-1.0-pro-vision"

    const prompt = [
      {
        text: `Analiza esta factura o documento de compra de repuestos. Extrae la siguiente información y devuelve SOLO un JSON válido.
        
        Si no encuentras un campo, omítelo o déjalo vacío, pero NO uses null. Las cantidades deben ser números, los precios números.
        
        FORMATO DEL JSON REQUERIDO:
        {
          "nro_orden": "string",
          "proveedor": "string",
          "items": [
            {
              "producto": "string",
              "oem": "string",
              "cantidad": number,
              "importe_unitario": number,
              "costo_envio_unitario": number,
              "taxes_unitario": number,
              "reembolsos_unitario": number
            }
          ]
        }
        
        EJEMPLO DE RESPUESTA ESPERADA:
        {
          "nro_orden": "PO-12345",
          "proveedor": "Acme Parts",
          "items": [
            {
              "producto": "Filtro de Aceite",
              "oem": "OX123",
              "cantidad": 2,
              "importe_unitario": 12.50,
              "costo_envio_unitario": 1.00,
              "taxes_unitario": 0.50,
              "reembolsos_unitario": 0.00
            },
            {
              "producto": "Bujías Iridium",
              "oem": "IRID-99",
              "cantidad": 4,
              "importe_unitario": 8.00,
              "costo_envio_unitario": 0.50,
              "taxes_unitario": 0.30,
              "reembolsos_unitario": 0.00
            }
          ]
        }
        
        Asegúrate de que TODOS los ítems encontrados estén dentro del array "items". Si no hay ítems, el array debe estar vacío.`,
      },
      {
        inlineData: {
          data: file,
          mimeType: media_type,
        },
      },
    ];

    const result = await model.generateContent({
      contents: [{ role: "user", parts: prompt }],
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    });

    let textResponse = result.response.text();
    
    const jsonMatch = textResponse.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      textResponse = jsonMatch[1];
    }

    const parsedData = JSON.parse(textResponse);
    return NextResponse.json({ success: true, data: parsedData });

  } catch (error: any) {
    console.error('Error procesando factura con IA:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
