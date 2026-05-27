'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase, type Cliente, fmt } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FileText, Loader, CheckCircle, X, ClipboardList } from 'lucide-react'

interface ItemImportado {
  producto: string;
  oem?: string;
  cantidad: number;
  importe_unitario: number; // Costo por unidad del producto
  costo_envio_unitario: number; // Costo de envío por unidad
  taxes_unitario: number; // Taxes por unidad
  reembolsos_unitario: number; // Reembolsos por unidad
  costo_total_unitario: number; // Calculado
  cliente_id?: string;
  cliente_nombre?: string;
  seleccionado: boolean;
  // Estos no se guardan directamente por item, pero pueden ser útiles en UI
  _nroOrden?: string;
  _proveedor?: string;
}

export default function ImportarPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [paso, setPaso] = useState<'upload' | 'revisar' | 'listo'>('upload')
  const [items, setItems] = useState<ItemImportado[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [nroOrden, setNroOrden] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [cliGlobal, setCliGlobal] = useState('')
  const [cliGlobalId, setCliGlobalId] = useState('')
  const [showCliDrop, setShowCliDrop] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [modoEntrada, setModoEntrada] = useState<'ia' | 'paste'>('ia') // Nuevo estado para el modo de entrada
  const [rawPastedText, setRawPastedText] = useState('') // Para el pegado masivo

  // Cargar clientes al inicio
  useEffect(() => {
    cargarClientes()
  }, [])

  const cargarClientes = async () => {
    const { data } = await supabase.from('clientes').select('id, nombre').order('nombre')
    setClientes(data || [])
  }

  const procesarArchivo = async (file: File) => {
    setLoading(true)
    const tid = toast.loading('Analizando documento con IA...')
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const isPDF = file.type === 'application/pdf'
      const isImage = file.type.startsWith('image/')
      if (!isPDF && !isImage) { toast.error('Solo PDF e imágenes'); setLoading(false); toast.dismiss(tid); return }

      const res = await fetch('/api/parse-invoice', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64,
          media_type: file.type,
          file_name: file.name
        })
      })

      const apiResponse = await res.json()
      if (!res.ok) {
        throw new Error(apiResponse.error || 'Error en la API de análisis.')
      }

      const parsed = apiResponse.data
      if (!parsed || !parsed.items || parsed.items.length === 0) {
        throw new Error('La IA no pudo extraer los ítems o la estructura es inválida.')
      }
      
      setNroOrden(parsed.nro_orden || '')
      setProveedor(parsed.proveedor || '')
      
      const itemsProcesados: ItemImportado[] = (parsed.items || []).map((x: any) => ({
        producto: x.producto || '',
        oem: x.oem || '',
        cantidad: x.cantidad || 1,
        importe_unitario: x.importe_unitario || 0,
        costo_envio_unitario: x.costo_envio_unitario || 0,
        taxes_unitario: x.taxes_unitario || 0,
        reembolsos_unitario: x.reembolsos_unitario || 0,
        costo_total_unitario: (x.importe_unitario || 0) + (x.costo_envio_unitario || 0) + (x.taxes_unitario || 0) - (x.reembolsos_unitario || 0),
        seleccionado: true,
        cliente_id: '',
        cliente_nombre: ''
      }))
      setItems(itemsProcesados)
      setPaso('revisar')
      toast.success('Documento analizado ✓', { id: tid })

    } catch (e: any) {
      toast.error('Error: ' + (e.message || 'Intentá de nuevo'), { id: tid })
      console.error("Error al procesar archivo:", e)
    } finally {
      setLoading(false)
    }
  }

  const procesarPegadoMasivo = () => {
    if (!rawPastedText.trim()) {
      toast.error('Pegá datos primero');
      return;
    }
    setLoading(true);
    const tid = toast.loading('Procesando datos pegados...');
    try {
      const lines = rawPastedText.trim().split('\n');
      const itemsProcesados: ItemImportado[] = [];
  
      lines.forEach(line => {
        const cols = line.split('\t').map(col => col.trim());
        // Columnas esperadas: Producto | OEM | Cantidad | Importe Unitario | Costo Envío Unitario | Taxes Unitario | Reembolsos Unitario
        // Asegúrate de que los índices de las columnas coincidan con tu Excel
        if (cols.length < 7) { // Necesitamos al menos 7 columnas
          console.warn('Línea ignorada por formato incorrecto:', line);
          return; 
        }
  
        const importe_unitario = parseFloat(cols[3]) || 0;
        const costo_envio_unitario = parseFloat(cols[4]) || 0;
        const taxes_unitario = parseFloat(cols[5]) || 0;
        const reembolsos_unitario = parseFloat(cols[6]) || 0;

        itemsProcesados.push({
          producto: cols[0] || '',
          oem: cols[1] || '',
          cantidad: parseInt(cols[2]) || 1,
          importe_unitario: importe_unitario,
          costo_envio_unitario: costo_envio_unitario,
          taxes_unitario: taxes_unitario,
          reembolsos_unitario: reembolsos_unitario,
          costo_total_unitario: importe_unitario + costo_envio_unitario + taxes_unitario - reembolsos_unitario,
          seleccionado: true,
          cliente_id: '',
          cliente_nombre: ''
        });
      });
  
      if (itemsProcesados.length === 0) {
        throw new Error('No se pudieron procesar los ítems desde los datos pegados. Verifica el formato.');
      }
      
      setItems(itemsProcesados);
      setPaso('revisar');
      toast.success(`Se procesaron ${itemsProcesados.length} ítems.`, { id: tid });
    } catch (e: any) {
      toast.error('Error al procesar los datos: ' + (e.message || 'Verifica el formato del Excel.'), { id: tid });
      console.error("Error al procesar pegado masivo:", e);
    } finally {
      setLoading(false);
      setRawPastedText('');
    }
  };
  

  const asignarCliGlobal = () => {
    if (!cliGlobal || !cliGlobalId) { toast.error('Seleccioná un cliente'); return }
    setItems(prevItems =>
      prevItems.map(item =>
        item.seleccionado ? { ...item, cliente_id: cliGlobalId, cliente_nombre: cliGlobal } : item
      )
    )
    toast.success('Cliente asignado a ítems seleccionados ✓')
  }

  const filtCli = clientes.filter(c => cliGlobal && c.nombre.toLowerCase().includes(cliGlobal.toLowerCase())).slice(0,6)

  const guardarTodo = async () => {
    const seleccionados = items.filter(x => x.seleccionado)
    if (!seleccionados.length) { toast.error('Seleccioná al menos un ítem para importar'); return }
    setGuardando(true)
    const tid = toast.loading(`Importando ${seleccionados.length} ítems...`)

    try {
      for (const item of seleccionados) {
        await supabase.from('items').insert({
          producto: item.producto,
          oem: item.oem || null,
          importe: item.importe_unitario,
          costo_envio: item.costo_envio_unitario,
          taxes: item.taxes_unitario,
          reembolsos: item.reembolsos_unitario,
          costo_total: item.costo_total_unitario,
          cantidad: item.cantidad,
          nro_orden: nroOrden || null,
          pagina: proveedor || null,
          cliente_id: item.cliente_id || null,
          cliente_nombre: item.cliente_nombre || null,
          ubicacion: 'Proveedor', // Por defecto cuando se importa una factura
          destino: 'Stock EEUU', // Por defecto cuando se importa una factura
          fecha_compra: new Date().toISOString().split('T')[0],
        })
      }
      toast.success(`✓ ${seleccionados.length} ítem${seleccionados.length > 1 ? 's' : ''} importados`, { id: tid })
      setGuardando(false); setPaso('listo')
    } catch (e: any) {
      toast.error('Error al importar: ' + (e.message || 'Intentá de nuevo'), { id: tid })
      console.error("Error al guardar todo:", e)
    } finally {
      setGuardando(false)
    }
  }

  // --- JSX de los pasos ---

  if (paso === 'listo') return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 text-center max-w-md">
        <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-4">¡Importación completa!</h1>
        <p className="text-gray-600 mb-6">{items.filter(x=>x.seleccionado).length} ítems agregados a tu inventario.</p>
        <div className="flex gap-4">
          <button onClick={() => router.push('/dashboard/inventario')} className="flex-1 btn bg-blue-600 text-white hover:bg-blue-700">Ver inventario</button>
          <button onClick={() => { setPaso('upload'); setItems([]); setModoEntrada('ia'); setNroOrden(''); setProveedor(''); setRawPastedText(''); }} className="flex-1 btn bg-gray-200 text-gray-800 hover:bg-gray-300">Importar otro</button>
        </div>
      </div>
    </div>
  )

  if (paso === 'revisar') return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-xl p-8">
        <button type="button" onClick={() => { setPaso('upload'); setModoEntrada('ia'); setNroOrden(''); setProveedor(''); setRawPastedText(''); }} className="mb-6 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold">
          ← Volver a subir
        </button>
        <h1 className="text-3xl font-bold mb-6">Revisar {items.length} ítems detectados</h1>

        {/* Datos de la orden */}
        <div className="bg-blue-50 p-6 rounded-lg mb-8 border border-blue-200">
          <h2 className="text-xl font-bold mb-4 text-blue-800">Datos de la Orden</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1">Nro. de orden</label>
              <input type="text" value={nroOrden} onChange={e => setNroOrden(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Proveedor</label>
              <input type="text" value={proveedor} onChange={e => setProveedor(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
          </div>
        </div>

        {/* Asignar cliente global */}
        <div className="bg-green-50 p-6 rounded-lg mb-8 border border-green-200">
          <h2 className="text-xl font-bold mb-4 text-green-800">Asignar cliente a todos (opcional)</h2>
          <div className="flex gap-4 relative">
            <input
              type="text"
              value={cliGlobal}
              onChange={e => { setCliGlobal(e.target.value); setShowCliDrop(true) }}
              onFocus={() => setShowCliDrop(true)}
              placeholder="Buscar cliente..."
              className="flex-1 border rounded px-3 py-2"
            />
            {showCliDrop && filtCli.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border rounded mt-1 shadow-lg z-10 max-h-48 overflow-y-auto">
                {filtCli.map(c => (
                  <button key={c.id} type="button" onClick={e => { e.preventDefault(); setCliGlobal(c.nombre); setCliGlobalId(c.id); setShowCliDrop(false) }} className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b last:border-b-0">
                    {c.nombre}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={asignarCliGlobal} disabled={!cliGlobalId} className="btn bg-green-600 text-white hover:bg-green-700 flex-shrink-0">Asignar a seleccionados</button>
          </div>
        </div>

        {/* Ítems */}
        <div className="bg-gray-50 p-6 rounded-lg mb-8 border border-gray-200">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Ítems ({items.filter(x => x.seleccionado).length} seleccionados)</h2>
          <div className="flex justify-between items-center mb-4">
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={items.every(x => x.seleccionado)}
                onChange={() => setItems(p => p.map(x => ({ ...x, seleccionado: !items.every(y => y.seleccionado) })))}
                className="w-4 h-4"
              />
              {items.every(x => x.seleccionado) ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </label>
          </div>

          <div className="space-y-4">
            {items.map((it, i) => (
              <div key={i} className="bg-white rounded-lg p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
                <input
                  type="checkbox"
                  checked={it.seleccionado}
                  onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, seleccionado: e.target.checked } : x))}
                  className="w-5 h-5 flex-shrink-0 mt-1 md:mt-0"
                />
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                  <input type="text" value={it.producto} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, producto: e.target.value } : x))} placeholder="Producto" className="border rounded px-2 py-1 text-sm" />
                  <input type="text" value={it.oem || ''} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, oem: e.target.value } : x))} placeholder="OEM" className="border rounded px-2 py-1 text-sm" />
                  <input type="number" step="1" value={it.cantidad} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, cantidad: parseInt(e.target.value) || 0 } : x))} placeholder="Cantidad" className="border rounded px-2 py-1 text-sm" />
                  <input type="number" step="0.01" value={it.importe_unitario} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, importe_unitario: parseFloat(e.target.value) || 0 } : x))} placeholder="Importe Unit." className="border rounded px-2 py-1 text-sm" />
                  <input type="number" step="0.01" value={it.costo_envio_unitario} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, costo_envio_unitario: parseFloat(e.target.value) || 0 } : x))} placeholder="Envío Unit." className="border rounded px-2 py-1 text-sm" />
                  <input type="number" step="0.01" value={it.taxes_unitario} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, taxes_unitario: parseFloat(e.target.value) || 0 } : x))} placeholder="Taxes Unit." className="border rounded px-2 py-1 text-sm" />
                  <input type="number" step="0.01" value={it.reembolsos_unitario} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, reembolsos_unitario: parseFloat(e.target.value) || 0 } : x))} placeholder="Reembolsos Unit." className="border rounded px-2 py-1 text-sm" />
                  <p className="font-bold text-blue-600 text-sm flex items-center justify-center">Total: {fmt(it.costo_total_unitario)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-4 justify-end">
          <button type="button" onClick={() => setPaso('upload')} className="btn bg-gray-500 text-white hover:bg-gray-600">Cancelar</button>
          <button type="button" onClick={guardarTodo} disabled={guardando || !items.filter(x => x.seleccionado).length} className="btn bg-blue-600 text-white hover:bg-blue-700">
            {guardando ? 'Importando...' : `Importar ${items.filter(x => x.seleccionado).length} ítem${items.filter(x => x.seleccionado).length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )

  // Paso 1: Subir (Selector de modo)
  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 text-center max-w-md">
        <h1 className="text-3xl font-bold mb-4">Importar Items</h1>
        <p className="text-gray-600 mb-6">Elegí cómo querés importar los ítems de tu factura de compra.</p>

        {/* Selector de modo */}
        <div className="flex gap-4 mb-8">
          <button onClick={() => setModoEntrada('ia')} className={`flex-1 btn justify-center gap-2 ${modoEntrada === 'ia' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
            <FileText size={20} /> Con IA (PDF/Imagen)
          </button>
          <button onClick={() => setModoEntrada('paste')} className={`flex-1 btn justify-center gap-2 ${modoEntrada === 'paste' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
            <ClipboardList size={20} /> Pegar desde Excel
          </button>
        </div>

        {modoEntrada === 'ia' ? (
          // Contenido para IA
          <div className="mb-6">
            <p className="text-gray-600 mb-4">Subí la factura del proveedor — la IA extrae los ítems automáticamente.</p>
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) procesarArchivo(f) }}
              onDragOver={e => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-16 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all mb-6"
            >
              {loading
                ? <Loader size={48} className="animate-spin text-blue-500 mx-auto mb-4" />
                : <FileText size={48} className="text-gray-400 mx-auto mb-4" />
              }
              <p className="font-bold text-gray-700 mb-2">{loading ? 'Analizando con IA...' : 'Arrastrá o hacé click para subir'}</p>
              <p className="text-sm text-gray-500">PDF, JPG, PNG — factura o foto de la orden</p>
              <input type="file" ref={fileRef} onChange={e => { const f = e.target.files?.[0]; if (f) procesarArchivo(f) }} className="hidden" accept="application/pdf,image/jpeg,image/png" />
            </div>

            <div className="text-left bg-gray-50 p-4 rounded-lg text-sm text-gray-700">
              <p className="font-bold mb-2">La IA detecta automáticamente:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>✓ Nro. de orden y Proveedor</li>
                <li>✓ Nombre, OEM y **Cantidad** de cada producto</li>
                <li>✓ **Costo unitario, Envío, Taxes y Reembolsos** por ítem</li>
              </ul>
            </div>
          </div>
        ) : (
          // Contenido para Pegado Masivo
          <div className="mb-6">
            <p className="text-gray-600 mb-4">Pegá aquí los datos de Excel (separados por tabulaciones).</p>
            <textarea
              className="w-full border rounded p-4 text-sm h-40 mb-4"
              placeholder={`Producto\tOEM\tCantidad\tImporte Unitario\tCosto Envío Unitario\tTaxes Unitario\tReembolsos Unitario\nFiltro de Aire\tABC-123\t2\t15.00\t2.50\t1.00\t0.00\nBujía\tXYZ-456\t1\t8.00\t1.00\t0.50\t0.00`}
              value={rawPastedText}
              onChange={e => setRawPastedText(e.target.value)}
              disabled={loading}
            ></textarea>
            <button
              onClick={procesarPegadoMasivo}
              disabled={loading || !rawPastedText.trim()}
              className="w-full btn bg-blue-600 text-white hover:bg-blue-700"
            >
              {loading ? 'Procesando...' : 'Procesar datos pegados'}
            </button>
            <div className="text-left bg-gray-50 p-4 rounded-lg text-sm text-gray-700 mt-4">
              <p className="font-bold mb-2">Formato esperado (columnas separadas por tabulador):</p>
              <ul className="list-disc list-inside space-y-1">
                <li>`Producto`</li>
                <li>`OEM`</li>
                <li>`Cantidad`</li>
                <li>`Importe Unitario`</li>
                <li>`Costo Envío Unitario`</li>
                <li>`Taxes Unitario`</li>
                <li>`Reembolsos Unitario`</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
