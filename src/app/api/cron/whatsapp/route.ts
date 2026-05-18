import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Poné aca los datos reales de tu Evolution API de Railway
const EVOLUTION_URL = "https://evolution-api-production-bd10.up.railway.app";
const INSTANCE_NAME = "TU_INSTANCIA_ACA"; // <-- Reemplazá por el nombre de tu instancia
const API_TOKEN = "TU_TOKEN_ACA";         // <-- Reemplazá por tu token de Railway

export async function GET() {
  try {
    // Buscamos solo por estado 'Pendiente' (sin importar la hora por ahora para probar)
    const { data: cotizaciones, error: dbError } = await supabase
      .from('cotizaciones') 
      .select('*')
      .eq('estado_envio', 'Pendiente');

    if (dbError) throw dbError;
    if (!cotizaciones || cotizaciones.length === 0) {
      return NextResponse.json({ message: 'No hay mensajes programados para enviar ahora.' });
    }

    for (const cotizacion of cotizaciones) {
      if (!cotizacion.telefono_cliente) continue;

      // Limpiamos el número de teléfono
      const numeroLimpio = cotizacion.telefono_cliente.toString().replace(/\D/g, ''); 
      
      // Armamos el mensaje con tus columnas reales (cliente_nombre y nro)
      const textoMensaje = `Hola ${cotizacion.cliente_nombre}, te adjunto la cotización ${cotizacion.nro}.`;

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

      if (response.ok) {
        // Si se envió, le sacamos las comillas y lo marcamos como Enviado
        await supabase
          .from('cotizaciones')
          .update({ estado_envio: 'Enviado' })
          .eq('id', cotizacion.id);
      }
    }

    return NextResponse.json({ success: true, enviados: cotizaciones.length });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}