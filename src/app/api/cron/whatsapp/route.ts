import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🛠️ PEGA TUS DATOS DIRECTO ACÁ
const SUPABASE_URL = "https://zwxpotfiujscswcnbxmu.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_bwgUFkARnaYYNr7BCWCUrA_pDISUvyN";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const EVOLUTION_URL = "https://evolution-api-production-bd10.up.railway.app";
const INSTANCE_NAME = "motosdp"; 
const API_TOKEN = "77A83FC238FE-4CC1-A077-E997C709DBC0";         

export async function GET() {
  try {
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
      const numeroLimpio = cotizacion.telefono_cliente.toString().replace(/\D/g, ''); 
      const textoMensaje = `Hola ${cotizacion.cliente_nombre}, te adjunto la cotización ${cotizacion.nro}.`;

      const response = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': API_TOKEN },
        body: JSON.stringify({
          number: numeroLimpio,
          options: { delay: 1200, presence: 'composing' },
          textMessage: { text: textoMensaje }
        })
      });

      if (response.ok) {
        await supabase
          .from('cotizaciones')
          .update({ estado_envio: 'Enviado' })
          .eq('id', cotizacion.id);
      }
    }
    return NextResponse.json({ success: true, enviados: cotizaciones.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, detail: error.stack }, { status: 500 });
  }
}
