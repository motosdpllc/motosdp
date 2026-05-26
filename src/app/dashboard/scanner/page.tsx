'use client'
import { useState, useEffect, useRef, useCallback, Fragment } from 'react' // Importa Fragment
import { supabase, type Item } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { ScanLine, CheckCircle, AlertTriangle, Camera, Keyboard, Package, X } from 'lucide-react' // Importa X

export default function ScannerPage() {
  const [mode, setMode] = useState<'keyboard' | 'camera'>('keyboard')
  const [input, setInput] = useState('')
  const [resultado, setResultado] = useState<any | null>(null) // Resultado del ítem encontrado
  const [estado, setEstado] = useState<'idle' | 'found' | 'not_found'>('idle')
  const [loading, setLoading] = useState(false) // Para la búsqueda del ítem
  const [scanning, setScanning] = useState(false) // Para indicar si la cámara está activa
  const [recientes, setRecientes] = useState<Array<{ item: any; ts: string }>>([])
  const [inputPeso, setInputPeso] = useState<number | ''>(0) // Nuevo estado para el peso
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const codeReaderRef = useRef<any>(null) // Para el lector de ZXing

  // Control de la cámara
  const stopCamera = useCallback(() => {
    if (codeReaderRef.current) { 
      try { codeReaderRef.current.reset() } catch (e) { console.error("Error resetting code reader", e) }
      codeReaderRef.current = null 
    }
    if (streamRef.current) { 
      streamRef.current.getTracks().forEach(t => t.stop()); 
      streamRef.current = null 
    }
    setScanning(false)
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setScanning(true)
    } catch (e) {
      toast.error('No se pudo acceder a la cámara. Usá el modo teclado.')
      console.error("Error accessing camera:", e)
      setMode('keyboard')
    }
  }, [])

  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);


  // Búsqueda del código (ya sea por teclado o por cámara)
  const handleScan = useCallback(async (code: string) => {
    if (!code.trim() || loading) return
    setLoading(true); setEstado('idle'); setResultado(null); setInputPeso(0)
    try {
      const { data } = await supabase.from('items').select('*')
        .or(`oem.ilike.%${code}%,codigo.ilike.%${code}%,tracking_compra.ilike.%${code}%`)
        .not('ubicacion', 'eq', 'Vendido').not('ubicacion', 'eq', 'Cancelado')
        .limit(1)
      if (data && data.length > 0) {
        setResultado(data[0]); 
        setEstado('found'); 
        setInputPeso(data[0].peso || ''); // Precarga el peso si ya tiene
        toast.success('✓ Producto encontrado')
      } else {
        setEstado('not_found')
        await supabase.from('trackings_huerfanos').insert({ tracking: code })
        await supabase.from('alertas').insert({ tipo: 'tracking_huerfano', mensaje: `Código escaneado sin match: ${code}`, tracking_huerfano: code, activa: true })
        toast.error('Código no encontrado')
      }
    } catch (e) { 
      toast.error('Error al buscar: ' + (e instanceof Error ? e.message : 'Error desconocido'))
      console.error("Error in handleScan:", e)
    }
    setLoading(false); setInput('')
  }, [loading]);

  // Escaneo manual desde cámara (botón)
  const escanearManual = async () => {
    if (!videoRef.current || !scanning) {
      toast.error('Cámara no activa o video no disponible.')
      return;
    }
    setLoading(true); // Bloquear mientras se busca
    toast('Buscando código...', { duration: 2000 });
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader; // Guarda la instancia

      const result = await codeReader.decodeFromVideoElement(videoRef.current);
      if (result) {
        const code = result.getText();
        toast.success('Código leído: ' + code);
        await handleScan(code);
      }
    } catch (e) {
      toast.error('No se encontró ningún código. Intentá de nuevo.');
      console.error("Error in escanearManual:", e);
    } finally {
      setLoading(false); // Desbloquear
      if (codeReaderRef.current) {
        codeReaderRef.current.reset(); // Reiniciar lector para próximas lecturas
      }
    }
  };


  const marcarRecibido = async () => {
    if (!resultado) return
    setLoading(true);
    try {
      await supabase.from('items').update({ 
        ubicacion: 'En Mano', 
        recibido: true, 
        fecha_recibido: new Date().toISOString(),
        peso: inputPeso || resultado.peso // Actualiza el peso, o mantiene el original
      }).eq('id', resultado.id)
      toast.success('✓ Marcado como recibido')
      setRecientes(prev => [{ item: resultado, ts: new Date().toLocaleTimeString('es-AR') }, ...prev.slice(0, 9)])
      setResultado(null); setEstado('idle'); setInputPeso(0);
      inputRef.current?.focus()
    } catch (e) {
      toast.error('Error al marcar como recibido: ' + (e instanceof Error ? e.message : 'Error desconocido'))
      console.error("Error marking received:", e)
    } finally {
      setLoading(false);
    }
  }

  const canceladoProveedor = async () => {
    if (!resultado) return
    setLoading(true);
    try {
      await supabase.from('items').update({ 
        ubicacion: 'Cancelado', 
        cancelado_proveedor: true 
      }).eq('id', resultado.id)
      await supabase.from('alertas').insert({ tipo: 'comprar', mensaje: `🛒 COMPRAR: ${resultado.producto} ${resultado.oem ? '(OEM: ' + resultado.oem + ')' : ''} para ${resultado.cliente_nombre || 'cliente sin asignar'}`, item_id: resultado.id, activa: true })
      toast.success('Cancelado — alerta creada para recomprar')
      setResultado(null); setEstado('idle'); setInputPeso(0);
    } catch (e) {
      toast.error('Error al cancelar: ' + (e instanceof Error ? e.message : 'Error desconocido'))
      console.error("Error canceling item:", e)
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold mb-8">Escanear recepción</h1>
        <p className="text-gray-600 mb-6">Escaneá el código OEM o de barras del producto que llegó.</p>

        {/* Selector de modo */}
        <div className="flex gap-4 mb-8">
          <button onClick={() => setMode('keyboard')} className={`flex-1 btn justify-center gap-2 ${mode === 'keyboard' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
            <Keyboard size={20} /> Teclado / Lector USB
          </button>
          <button onClick={() => setMode('camera')} className={`flex-1 btn justify-center gap-2 ${mode === 'camera' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
            <Camera size={20} /> Cámara
          </button>
        </div>

        {/* UI para Cámara */}
        {mode === 'camera' && (
          <div className="mb-8">
            <div className="relative w-full h-80 bg-gray-200 rounded-lg overflow-hidden mb-4">
              {scanning && <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>}
              {!scanning && <div className="w-full h-full flex items-center justify-center text-gray-500">Cámara inactiva</div>}
            </div>
            <button
              onClick={escanearManual}
              disabled={loading || !scanning}
              className="w-full btn bg-green-600 text-white hover:bg-green-700 font-bold mb-4"
            >
              {loading ? 'Buscando código...' : <Fragment><ScanLine size={20} /> Leer código ahora</Fragment>}
            </button>
            <p className="text-gray-500 text-sm text-center mb-4">Apuntá la cámara al código y presioná el botón.</p>

            {/* Opcional: Ingreso manual en modo cámara */}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleScan(input) }}
                placeholder="Ingresar código manualmente (Enter para buscar)"
                className="flex-1 border rounded px-3 py-2"
                disabled={loading}
              />
              <button onClick={() => handleScan(input)} disabled={loading || !input.trim()} className="btn bg-blue-600 text-white hover:bg-blue-700">Buscar</button>
            </div>
          </div>
        )}

        {/* UI para Teclado / Lector USB */}
        {mode === 'keyboard' && (
          <div className="mb-8">
            <label className="block text-gray-700 text-sm font-bold mb-2">Código OEM / Tracking / Código de barras</label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleScan(input) }}
                placeholder="Ingresá o escaneá el código aquí"
                className="flex-1 border rounded px-3 py-2"
                autoFocus
                disabled={loading}
              />
              <button onClick={() => handleScan(input)} disabled={loading || !input.trim()} className="btn bg-blue-600 text-white hover:bg-blue-700">Buscar</button>
            </div>
            <p className="text-gray-500 text-sm mt-2 text-center">💡 Con lector USB el código se ingresa solo — solo presioná Enter.</p>
          </div>
        )}

        {/* Resultado del escaneo */}
        {estado === 'found' && resultado && (
          <div className="bg-green-100 border border-green-300 rounded-lg p-6 mb-8 text-green-800">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle size={24} />
              <h2 className="text-xl font-bold">Producto encontrado:</h2>
            </div>
            <p className="font-bold text-lg">{resultado.producto}</p>
            <p className="text-sm">
              {resultado.oem && `OEM: ${resultado.oem} `}
              {resultado.codigo && `Código: ${resultado.codigo} `}
              {resultado.nro_orden && `Orden: ${resultado.nro_orden} `}
              {resultado.cliente_nombre && `Cliente: ${resultado.cliente_nombre} `}
            </p>
            <p className="text-sm mt-2">Ubicación actual: <span className="font-semibold">{resultado.ubicacion}</span></p>

            <div className="mt-4">
              <label className="block text-green-800 text-sm font-bold mb-1">Peso (kg)</label>
              <input
                type="number"
                step="0.01"
                value={inputPeso}
                onChange={e => setInputPeso(parseFloat(e.target.value) || '')}
                placeholder="Ingresar peso del ítem"
                className="w-full border rounded px-3 py-2 text-green-800"
              />
            </div>

            <div className="flex gap-4 mt-6">
              <button 
                onClick={marcarRecibido} 
                disabled={loading} 
                className="flex-1 btn bg-green-600 text-white hover:bg-green-700"
              >
                {loading ? 'Marcando...' : '✓ Marcar como En Mano'}
              </button>
              <button 
                onClick={canceladoProveedor} 
                disabled={loading} 
                className="flex-1 btn bg-red-600 text-white hover:bg-red-700"
              >
                ✕ Cancelado por proveedor
              </button>
            </div>
            <button 
              onClick={() => { setEstado('idle'); setResultado(null); setInput(''); setInputPeso(0); inputRef.current?.focus() }} 
              className="w-full btn bg-gray-200 text-gray-800 hover:bg-gray-300 mt-2"
            >
              Volver a escanear
            </button>
          </div>
        )}

        {/* Código no encontrado */}
        {estado === 'not_found' && (
          <div className="bg-red-100 border border-red-300 rounded-lg p-6 mb-8 text-red-800">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={24} />
              <h2 className="text-xl font-bold">Código no encontrado</h2>
            </div>
            <p className="text-sm">Se generó una alerta. Podés asignarlo desde Config → Tracking huérfanos.</p>
            <button 
              onClick={() => { setEstado('idle'); setResultado(null); setInput(''); setInputPeso(0); inputRef.current?.focus() }} 
              className="w-full btn bg-gray-200 text-gray-800 hover:bg-gray-300 mt-4"
            >
              Volver a escanear
            </button>
          </div>
        )}

        {/* Escaneados recientes */}
        {recientes.length > 0 && (
          <div className="bg-gray-100 rounded-lg p-6">
            <h2 className="text-lg font-bold mb-4">Escaneados recientemente</h2>
            <div className="space-y-3">
              {recientes.map((r, i) => (
                <div key={i} className="flex items-center justify-between bg-white p-3 rounded shadow-sm text-gray-800">
                  <div>
                    <p className="font-semibold">{r.item.producto}</p>
                    {r.item.cliente_nombre && <p className="text-sm text-gray-600">Cliente: {r.item.cliente_nombre}</p>}
                  </div>
                  <p className="text-sm text-gray-500">{r.ts}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
