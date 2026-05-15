'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, type Item } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { ScanLine, CheckCircle, AlertTriangle, Camera, Keyboard } from 'lucide-react'

export default function ScannerPage() {
  const [mode, setMode] = useState<'keyboard' | 'camera'>('keyboard')
  const [input, setInput] = useState('')
  const [resultado, setResultado] = useState<Item | null>(null)
  const [estado, setEstado] = useState<'idle' | 'found' | 'not_found'>('idle')
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [recientes, setRecientes] = useState<Array<{ item: Item; ts: string }>>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const readerRef = useRef<any>(null)

  useEffect(() => {
    if (mode === 'keyboard') inputRef.current?.focus()
  }, [mode])

  const stopCamera = useCallback(() => {
    if (readerRef.current) { try { readerRef.current.reset() } catch { } readerRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setScanning(false)
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setScanning(true)
    } catch {
      toast.error('No se pudo acceder a la cámara. Usá el modo teclado.')
      setMode('keyboard')
    }
  }, [])

  useEffect(() => {
    if (mode === 'camera') startCamera()
    else stopCamera()
    return () => stopCamera()
  }, [mode, startCamera, stopCamera])

  const handleScan = useCallback(async (code: string) => {
    if (!code.trim() || loading) return
    setLoading(true); setEstado('idle'); setResultado(null)
    try {
      const { data } = await supabase.from('items').select('*')
        .or(`oem.ilike.${code},codigo.ilike.${code},tracking_compra.ilike.${code}`)
        .not('ubicacion', 'eq', 'Vendido').not('ubicacion', 'eq', 'Cancelado')
        .limit(1)
      if (data && data.length > 0) {
        setResultado(data[0]); setEstado('found'); toast.success('✓ Producto encontrado')
      } else {
        setEstado('not_found')
        await supabase.from('trackings_huerfanos').insert({ tracking: code })
        await supabase.from('alertas').insert({ tipo: 'tracking_huerfano', mensaje: `Código escaneado sin match: ${code}`, tracking_huerfano: code, activa: true })
        toast.error('Código no encontrado')
      }
    } catch { toast.error('Error al buscar') }
    setLoading(false); setInput('')
  }, [loading])

  // Escaneo manual desde cámara
  const escanearManual = async () => {
    if (!videoRef.current || !scanning) return
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/library')
      const codeReader = new BrowserMultiFormatReader()
      readerRef.current = codeReader
      toast('Buscando código...', { duration: 2000 })
      const result = await codeReader.decodeOnceFromVideoElement(videoRef.current)
      if (result) {
        const code = result.getText()
        toast.success('Código leído: ' + code)
        await handleScan(code)
      }
    } catch {
      toast.error('No se encontró ningún código. Intentá de nuevo.')
    }
  }

  const marcarRecibido = async () => {
    if (!resultado) return
    await supabase.from('items').update({ ubicacion: 'En Mano', recibido: true, fecha_recibido: new Date().toISOString() }).eq('id', resultado.id)
    toast.success('✓ Marcado como recibido')
    setRecientes(prev => [{ item: resultado, ts: new Date().toLocaleTimeString('es-AR') }, ...prev.slice(0, 9)])
    setResultado(null); setEstado('idle'); inputRef.current?.focus()
  }

  const canceladoProveedor = async () => {
    if (!resultado) return
    await supabase.from('items').update({ ubicacion: 'Cancelado', cancelado_proveedor: true }).eq('id', resultado.id)
    await supabase.from('alertas').insert({ tipo: 'comprar', mensaje: `🛒 COMPRAR: ${resultado.producto} ${resultado.oem ? '(OEM: ' + resultado.oem + ')' : ''} para ${resultado.cliente_nombre || 'cliente sin asignar'}`, item_id: resultado.id, activa: true })
    toast.success('Cancelado — alerta creada para recomprar')
    setResultado(null); setEstado('idle')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Escanear recepción</h1>
      <p className="text-gray-500 mb-6">Escaneá el código OEM o de barras del producto que llegó</p>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setMode('keyboard')} className={`btn flex-1 justify-center gap-2 ${mode === 'keyboard' ? 'btn-primary' : ''}`}><Keyboard size={16} /> Teclado / Lector USB</button>
        <button onClick={() => setMode('camera')} className={`btn flex-1 justify-center gap-2 ${mode === 'camera' ? 'btn-primary' : ''}`}><Camera size={16} /> Cámara</button>
      </div>

      {mode === 'camera' && (
        <div className="card mb-4">
          <div className="relative bg-black rounded-lg overflow-hidden mb-3" style={{ aspectRatio: '4/3' }}>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-white rounded-lg relative">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br"></div>
              </div>
            </div>
          </div>
          <button onClick={escanearManual} disabled={!scanning || loading} className="btn btn-primary w-full justify-center py-3 text-base">
            {loading ? 'Buscando...' : '📷 Leer código ahora'}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">Apuntá la cámara al código y presioná el botón</p>
          {/* También permitir ingreso manual en modo cámara */}
          <div className="flex gap-2 mt-3">
            <input className="input flex-1 font-mono" placeholder="O escribí el código manualmente..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleScan(input) }} />
            <button onClick={() => handleScan(input)} disabled={loading || !input.trim()} className="btn btn-primary">Buscar</button>
          </div>
        </div>
      )}

      {mode === 'keyboard' && (
        <div className="card mb-4">
          <label className="label">Código OEM / Tracking / Código de barras</label>
          <div className="flex gap-2">
            <input ref={inputRef} type="text" className="input flex-1 text-lg font-mono" placeholder="Escaneá o escribí el código..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleScan(input) }} autoFocus />
            <button onClick={() => handleScan(input)} disabled={loading || !input.trim()} className="btn btn-primary px-6">{loading ? '...' : 'Buscar'}</button>
          </div>
          <p className="text-xs text-gray-400 mt-2">💡 Con lector USB el código se ingresa solo — solo presioná Enter</p>
        </div>
      )}

      {estado === 'found' && resultado && (
        <div className="card border-green-200 bg-green-50 mb-4">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={22} />
            <div className="flex-1">
              <div className="font-bold text-lg">{resultado.producto}</div>
              <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                {resultado.oem && <div>OEM: <span className="font-mono font-semibold">{resultado.oem}</span></div>}
                {resultado.codigo && <div>Código: <span className="font-mono font-semibold">{resultado.codigo}</span></div>}
                {resultado.nro_orden && <div>Orden: <strong>{resultado.nro_orden}</strong></div>}
                {resultado.cliente_nombre && <div>Cliente: <strong>{resultado.cliente_nombre}</strong></div>}
                <div>Ubicación actual: <strong>{resultado.ubicacion}</strong></div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={marcarRecibido} className="btn btn-success flex-1 justify-center">✓ Recibido — marcar En Mano</button>
            <button onClick={canceladoProveedor} className="btn btn-danger flex-1 justify-center">✕ Cancelado por proveedor</button>
            <button onClick={() => { setEstado('idle'); setResultado(null); setInput(''); inputRef.current?.focus() }} className="btn w-full justify-center">Cancelar</button>
          </div>
        </div>
      )}

      {estado === 'not_found' && (
        <div className="card border-orange-200 bg-orange-50 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-orange-500 flex-shrink-0 mt-0.5" size={22} />
            <div>
              <div className="font-semibold text-orange-800">Código no encontrado</div>
              <div className="text-sm text-orange-600 mt-1">Se generó una alerta. Podés asignarlo desde Config → Tracking huérfanos.</div>
            </div>
          </div>
        </div>
      )}

      {recientes.length > 0 && (
        <div className="card">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Escaneados esta sesión</div>
          {recientes.map((r, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
              <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
              <div className="flex-1 text-sm font-medium truncate">{r.item.producto}</div>
              {r.item.cliente_nombre && <div className="text-xs text-gray-400 flex-shrink-0">{r.item.cliente_nombre}</div>}
              <div className="text-xs text-gray-400 flex-shrink-0">{r.ts}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
