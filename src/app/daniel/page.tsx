'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function DanielPage() {
  const [tracking, setTracking] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<{ok: boolean, msg: string, producto?: string} | null>(null)
  const [recientes, setRecientes] = useState<Array<{tracking: string, ok: boolean, producto?: string}>>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const auth = localStorage.getItem('moto_auth')
    if (!auth) router.push('/')
    inputRef.current?.focus()
  }, [router])

  const registrar = useCallback(async () => {
    const code = tracking.trim()
    if (!code || loading) return
    setLoading(true)
    setResultado(null)

    try {
      const { data } = await supabase
        .from('items')
        .select('id, producto, cliente_nombre, nro_orden')
        .ilike('tracking_compra', code)
        .limit(1)

      if (data && data.length > 0) {
        const item = data[0]
        await supabase.from('items').update({ ubicacion: 'Daniel', updated_at: new Date().toISOString() }).eq('id', item.id)
        const msg = `✓ ${item.producto}${item.cliente_nombre ? ' — ' + item.cliente_nombre : ''}`
        setResultado({ ok: true, msg, producto: item.producto })
        setRecientes(p => [{ tracking: code, ok: true, producto: item.producto }, ...p.slice(0, 9)])
        toast.success('Recibido!')
      } else {
        // Save huerfano + alert admin
        await supabase.from('trackings_huerfanos').insert({ tracking: code, ingresado_por: 'daniel' })
        await supabase.from('alertas').insert({
          tipo: 'tracking_huerfano',
          mensaje: `🚨 Daniel ingresó tracking sin match: ${code}`,
          tracking_huerfano: code,
          activa: true
        })
        // WhatsApp alert - get config
        const { data: cfg } = await supabase.from('config').select('value').eq('key', 'wa_admin').single()
        const waNum = cfg?.value || '5491135903620'
        const msg = encodeURIComponent(`🚨 Tracking no encontrado: ${code}\n\nDaniel lo ingresó pero no está en el sistema.`)
        window.open(`https://wa.me/${waNum}?text=${msg}`, '_blank')

        setResultado({ ok: false, msg: 'No encontrado — se avisó al encargado' })
        setRecientes(p => [{ tracking: code, ok: false }, ...p.slice(0, 9)])
      }
    } catch (e) {
      toast.error('Error de conexión')
    }

    setLoading(false)
    setTracking('')
    setTimeout(() => {
      setResultado(null)
      inputRef.current?.focus()
    }, 3000)
  }, [tracking, loading])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start pt-16 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">📦</div>
          <h1 className="text-2xl font-bold text-gray-900">Hola Daniel</h1>
          <p className="text-gray-500 mt-1">Ingresá el tracking del paquete que recibiste</p>
        </div>

        {/* Input */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-4">
          <input
            ref={inputRef}
            type="text"
            className="w-full text-xl font-mono border-2 border-gray-300 rounded-xl px-4 py-4 focus:outline-none focus:border-gray-900 transition-all text-center tracking-wider"
            placeholder="1Z999AA10123456784"
            value={tracking}
            onChange={e => setTracking(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') registrar() }}
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button
            onClick={registrar}
            disabled={loading || !tracking.trim()}
            className="mt-4 w-full bg-gray-900 text-white font-semibold py-4 rounded-xl text-lg disabled:opacity-40 transition-all active:scale-95"
          >
            {loading ? 'Buscando...' : '✓ Confirmar recepción'}
          </button>
        </div>

        {/* Resultado */}
        {resultado && (
          <div className={`rounded-xl p-4 mb-4 text-center transition-all ${resultado.ok ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
            <div className="text-3xl mb-2">{resultado.ok ? '✅' : '⚠️'}</div>
            <div className={`font-semibold ${resultado.ok ? 'text-green-800' : 'text-orange-800'}`}>{resultado.msg}</div>
          </div>
        )}

        {/* Recientes */}
        {recientes.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Esta sesión</div>
            {recientes.map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className={`text-lg flex-shrink-0`}>{r.ok ? '✅' : '⚠️'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-gray-500 truncate">{r.tracking}</div>
                  {r.producto && <div className="text-sm font-medium truncate">{r.producto}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => { localStorage.removeItem('moto_auth'); router.push('/') }}
          className="w-full mt-6 text-gray-400 text-sm text-center hover:text-gray-600"
        >
          Salir
        </button>
      </div>
    </div>
  )
}
