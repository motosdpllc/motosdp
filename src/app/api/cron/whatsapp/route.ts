import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Conectamos con tu Supabase usando las variables que ya tenés en Vercel
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // 1. Buscamos las credenciales del Manager que guardamos en la tabla 'config'
    const { data: configData } = await supabase
      .from('config')
      .select('key, value')
      .in('key', ['whatsapp_instance', 'whatsapp_token']);

    const instance = configData?.find(c => c.key === 'whatsapp_instance')?.value;
    const token = configData?.find(c => c.key === 'whatsapp_token')?.value;

    if (!instance || !token) {
      return NextResponse.json({ error: 'Faltan las llaves de WhatsApp en la tabla config' }, { status: 400 });
    }

    // 2. Traemos la hora actual en formato ISO
    const ahora = new Date().toISOString();

    // 3. Buscamos cotizaciones pendientes que ya tengan que haberse mandado (hora_programada <= ahora)
    // Cambiá 'cotizaciones' por el nombre real de tu tabla si se llama distinto
    const { data: cotizaciones, error: dbError } = await supabase
      .from('cotizaciones') 
      .select('*')
      .eq('estado_envio', 'Pendiente')
      .lte('hora_programada', ahora);

    if (dbError) throw dbError;
    if (!cotizaciones || cotizaciones.length === 0) {
      return NextResponse.json({ message: 'No hay mensajes programados para enviar ahora.' });
    }

    // 4. Recorremos las cotizaciones y se las mandamos al Manager de a una
    for (const cotizacion of cotizaciones) {
      // Limpiamos el número de teléfono del cliente (sacando espacios o guiones)
      const numeroLimpio = cotizacion.telefono_cliente.replace(/\D/g, ''); 
      
      const textoMensaje = `Hola ${cotizacion.nombre_cliente}, te adjunto la cotización ${cotizacion.numero_cotizacion}.`;

      const response = await fetch(`https://evolution-api-production-bd10.up.railway.app/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': token
        },
        body: JSON.stringify({
          number: numeroLimpio,
          options: { delay: 1200, presence: 'composing' },
          textMessage: { text: textoMensaje }
        })
      });

      if (response.ok) {
        // Si el Manager lo envió, marcamos la cotización como "Enviado" en Supabase
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