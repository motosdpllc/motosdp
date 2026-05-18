import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Conexión con Supabase usando las variables de entorno de Vercel
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 🛠️ CONFIGURACIÓN DE TU EVOLUTION API (RAILWAY)
// Reemplazá los textos de las líneas 13 y 14 con tus datos reales de Railway
const EVOLUTION_URL = "https://evolution-api-production-bd10.up.railway.app";
const INSTANCE_NAME = "motosdp"; 
const API_TOKEN = "77A83FC238FE-4CC1-A077-E997C709DBC0";         

export async function GET() {
  try {
    // Buscamos las cotizaciones con estado 'Pendiente'
    const { data: cotizaciones, error: dbError } = await supabase
      .from('cotizaciones') 
      .select('*')
      .eq('estado_envio', 'Pendiente');

    if (dbError) throw dbError;
    
    // Si la lista está vacía, frenamos acá
    if (!cotizaciones || cotizaciones.length === 0) {
      return NextResponse.json({ message: 'No hay mensajes programados para enviar ahora.' });
    }

    // Recorremos las cotizaciones encontradas
    for (const cotizacion of cotizaciones) {
      if (!cotizacion.telefono_cliente) continue;

      // Limpiamos el número de teléfono (dejamos solo números)
      const numeroLimpio = cotizacion.telefono_cliente.toString().replace(/\D/g, ''); 
      
      // Armamos el mensaje usando tus columnas reales: cliente_nombre y nro (ej: COT-006)
      const textoMensaje = `Hola ${cotizacion.cliente_nombre}, te adjunto la cotización ${cotizacion.nro}.`;

      // Despachamos el mensaje a Railway
      const response = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_TOKEN
        },
        body: JSON.stringify({
          number: numeroLimpio,
          options: { delay: 1200, presence: 'composing' },
          textMessage: { text: textoMensaje }
        })
      });

      // Si Railway respondió bien, actualizamos el estado en Supabase a 'Enviado'
      if (response.ok) {
        await supabase
          .from('cotizaciones')
          .update({ estado_envio: 'Enviado' })
          .eq('id', cotizacion.id);
      }
    }

    return NextResponse.json({ success: true, enviados: cotizaciones.length });

  } catch (error: any) {
    // Este bloque nos va a confesar el motivo exacto si la conexión se planta
    return NextResponse.json({ 
      error: error.message, 
      cause: error.cause?.message || "Error de red directo (posible falta de variables de entorno en Vercel)",
      stack: error.stack 
    }, { status: 500 });
  }
}