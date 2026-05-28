'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase, type Cliente, fmt } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FileText, Loader, CheckCircle, X, ClipboardList, Truck } from 'lucide-react'

// --- UBICACIONES Y DESTINOS DESDE EL FORMULARIO NUEVO ---
const UBICACIONES_FISICAS_IMPORTAR = ['Proveedor','En tránsito','En tránsito a Daniel','Daniel','Pablo','Blue Mail','Tato','Tránsito a Bs As','Stock EEUU', 'Stock España', 'Stock Argentina', 'En Mano']
const DESTINOS_FINALES_IMPORTAR = ['Stock EEUU', 'Stock España', 'Stock Argentina', 'Venta Argentina', 'Venta Internacional', 'Uso Propio', 'Stock Internacional']


interface ItemImportado {
  producto: string;
  oem?: string;
  cantidad: number;
  importe_unitario: number; // Costo por unidad del producto
  costo_envio_unitario: number; // Costo de envío por unidad
  taxes_unitario: number; // Taxes por unidad
  reembolsos_unitario: number; // Reembolsos por unidad
  costo_total_unitario: number; // Calculado
  fecha_compra?: string; // Nuevo: de Excel
  nro_orden?: string; // Nuevo: de Excel
  pagina?: string; // Nuevo: de Excel
  link_producto?: string; // Nuevo: de Excel
  peso?: number; // Nuevo: de Excel
  eta?: string; // Nuevo: de Excel
  tracking_compra?: string; // Nuevo: de Excel
  ubicacion?: string; // Nuevo: de Excel
  destino?: string; // Nuevo: de Excel
  cliente_id?: string;
  cliente_nombre?: string;
  seleccionado: boolean;
  _proveedor?: string; // Para el proveedor general si la IA lo detecta
}

export default function ImportarPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [paso, setPaso] = useState<'upload' | 'revisar' | 'listo'>('upload')
  const [items, setItems] = useState<ItemImportado[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  
  // Conceptos globales para toda la importación
  const [nroOrdenGlobal, setNroOrdenGlobal] = useState('')
  const [proveedorGlobal, setProveedorGlobal] = useState('')
  const [fechaCompraGlobal, setFechaCompraGlobal] = useState(new Date().toISOString().split('T')[0])
  const [trackingCompraGlobal, setTrackingCompraGlobal] = useState('')
  const [etaGlobal, setEtaGlobal] = useState('')
  const [ubicacionGlobal, setUbicacionGlobal] = useState('Proveedor')
  const [destinoGlobal, setDestinoGlobal] = useState('Stock EEUU')
  const [estadoPagoGlobal, setEstadoPagoGlobal] = useState('')


  const [cliGlobal, setCliGlobal] = useState('')
  const [cliGlobalId, setCliGlobalId] = useState('')
  const [showCliDrop, setShowCliDrop] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [modoEntrada, setModoEntrada] = useState<'ia' | 'paste'>('ia')
  const [rawPastedText, setRawPastedText] = useState('')

  // Clientes para el dropdown global
  const [clientesForm, setClientesForm] = useState<Cliente[]>([])
  const [cliSearchGlobal, setCliSearchGlobal] = useState('')
  const [showCliDropGlobal, setShowCliDropGlobal] = useState(false)


  useEffect(() => {
    cargarClientes()
  }, [])

  const cargarClientes = async () => {
    const { data } = await supabase.from('clientes').select('id, nombre').order('nombre')
    setClientesForm(data || [])
  }

  const generarParcelsAppLink = (tracking: string | undefined | null) => {
    return tracking ? `https://parcelsapp.com/es/tracking/${tracking}` : '#';
  };

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
      
      setNroOrdenGlobal(parsed.nro_orden || '')
      setProveedorGlobal(parsed.proveedor || '')
      
      const itemsProcesados: ItemImportado[] = (parsed.items || []).map((x: any) => ({
        producto: x.producto || '',
        oem: x.oem || '',
        cantidad: x.cantidad || 1,
        importe_unitario: x.importe_unitario || 0,
        costo_envio_unitario: x.costo_envio_unitario || 0,
        taxes_unitario: x.taxes_unitario || 0,
        reembolsos_unitario: x.reembolsos_unitario || 0,
        costo_total_unitario: (x.importe_unitario || 0) + (x.costo_envio_unitario || 0) + (x.taxes_unitario || 0) - (x.reembolsos_unitario || 0),
        fecha_compra: x.fecha_compra || new Date().toISOString().split('T')[0], // Si la IA lo extrae
        nro_orden: x.nro_orden || '', // Si la IA lo extrae
        pagina: x.pagina || '', // Si la IA lo extrae
        link_producto: x.link_producto || '', // Si la IA lo extrae
        peso: x.peso || 0, // Si la IA lo extrae
        eta: x.eta || '', // Si la IA lo extrae
        tracking_compra: x.tracking_compra || '', // Si la IA lo extrae
        ubicacion: x.ubicacion || 'Proveedor', // Si la IA lo extrae
        destino: x.destino || 'Stock EEUU', // Si la IA lo extrae
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
      // Columnas esperadas del Excel:
      // 0: fecha_compra, 1: Producto, 2: OEM, 3: Cantidad, 4: Importe Unitario, 5: nro_orden, 6: pagina_de_compra, 7: link_producto, 8: peso, 9: Costo Envío Unitario, 10: costo_total, 11: eta, 12: tracking_compra, 13: ubicacion, 14: destino, 15: Taxes Unitario, 16: Reembolsos Unitario
      const headersMap = {
        fecha_compra: 0, Producto: 1, OEM: 2, Cantidad: 3, Importe_Unitario: 4, 
        nro_orden: 5, pagina_de_compra: 6, link_producto: 7, peso: 8, 
        Costo_Envio_Unitario: 9, costo_total: 10, eta: 11, tracking_compra: 12, 
        ubicacion: 13, destino: 14, Taxes_Unitario: 15, Reembolsos_Unitario: 16
      };
      const expectedColsCount = Object.keys(headersMap).length;
  
      lines.forEach(line => {
        const cols = line.split('\t').map(col => col.trim());
        
        if (cols.length < expectedColsCount) { 
          console.warn('Línea ignorada por formato incompleto (faltan columnas):', line);
          return; 
        }
        
        const importe_unitario = parseFloat(cols[headersMap.Importe_Unitario]) || 0;
        const costo_envio_unitario = parseFloat(cols[headersMap.Costo_Envio_Unitario]) || 0;
        const taxes_unitario = parseFloat(cols[headersMap.Taxes_Unitario]) || 0;
        const reembolsos_unitario = parseFloat(cols[headersMap.Reembolsos_Unitario]) || 0;
        // Si el costo_total viene del excel, lo usamos, sino lo calculamos
        const costo_total_item = parseFloat(cols[headersMap.costo_total]) || (importe_unitario + costo_envio_unitario + taxes_unitario - reembolsos_unitario);

        itemsProcesados.push({
          fecha_compra: cols[headersMap.fecha_compra] || new Date().toISOString().split('T')[0],
          producto: cols[headersMap.Producto] || '',
          oem: cols[headersMap.OEM] || '',
          cantidad: parseInt(cols[headersMap.Cantidad]) || 1,
          importe_unitario: importe_unitario,
          nro_orden: cols[headersMap.nro_orden] || '',
          pagina: cols[headersMap.pagina_de_compra] || '',
          link_producto: cols[headersMap.link_producto] || '',
          peso: parseFloat(cols[headersMap.peso]) || 0,
          costo_envio_unitario: costo_envio_unitario,
          costo_total_unitario: costo_total_item,
          eta: cols[headersMap.eta] || '',
          tracking_compra: cols[headersMap.tracking_compra] || '',
          ubicacion: cols[headersMap.ubicacion] || 'Proveedor',
          destino: cols[headersMap.destino] || 'Stock EEUU',
          taxes_unitario: taxes_unitario,
          reembolsos_unitario: reembolsos_unitario,
          seleccionado: true,
          cliente_id: '',
          cliente_nombre: ''
        });
      });
  
      if (itemsProcesados.length === 0) {
        throw new Error('No se pudieron procesar los ítems desde los datos pegados. Verifica el formato o si las columnas están completas.');
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

  // Filtro de clientes para el dropdown (GLOBAL)
  const filtCliGlobal = clientesForm.filter(c => cliSearchGlobal && c.nombre.toLowerCase().includes(cliSearchGlobal.toLowerCase())).slice(0,6)

  const guardarTodo = async () => {
    const seleccionados = items.filter(x => x.seleccionado)
    if (!seleccionados.length) { toast.error('Seleccioná al menos un ítem para importar'); return }
    setGuardando(true)
    const tid = toast.loading(`Importando ${seleccionados.length} ítems...`)

    try {
      for (const item of seleccionados) {
        // Lógica de pendiente_compra (desde NuevoItem)
        const isPendienteCompra = (item.destino && item.destino.startsWith('Venta')) && (!item.fecha_compra || item.fecha_compra.trim() === '');

        await supabase.from('items').insert({
          producto: item.producto,
          oem: item.oem || null,
          importe: item.importe_unitario,
          costo_envio: item.costo_envio_unitario,
          taxes: item.taxes_unitario,
          reembolsos: item.reembolsos_unitario,
          costo_total: item.costo_total_unitario,
          cantidad: item.cantidad,
          nro_orden: item.nro_orden || null,
          pagina: item.pagina || null,
          cliente_id: item.cliente_id || null, // Puede venir por item o asignado globalmente
          cliente_nombre: item.cliente_nombre || null, // Puede venir por item o asignado globalmente
          ubicacion: item.ubicacion || 'Proveedor', // Desde Excel
          destino: item.destino || 'Stock EEUU', // Desde Excel
          fecha_compra: item.fecha_compra || new Date().toISOString().split('T')[0], // Desde Excel
          tracking_compra: item.tracking_compra || null, // Desde Excel
          link_tracking_compra: generarParcelsAppLink(item.tracking_compra), // Generar link de tracking
          eta: item.eta || null, // Desde Excel
          pendiente_compra: isPendienteCompra // Lógica de pendiente de compra para importación
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
          <button onClick={() => { setPaso('upload'); setItems([]); setModoEntrada('ia'); setNroOrdenGlobal(''); setProveedorGlobal(''); setRawPastedText(''); setFechaCompraGlobal(new Date().toISOString().split('T')[0]); setTrackingCompraGlobal(''); setEtaGlobal(''); setUbicacionGlobal('Proveedor'); setDestinoGlobal('Stock EEUU'); setEstadoPagoGlobal(''); }} className="flex-1 btn bg-gray-200 text-gray-800 hover:bg-gray-300">Importar otro</button>
        </div>
      </div>
    </div>
  )

  if (paso === 'revisar') return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-xl p-8">
        <button type="button" onClick={() => { setPaso('upload'); setModoEntrada('ia'); setNroOrdenGlobal(''); setProveedorGlobal(''); setRawPastedText(''); setFechaCompraGlobal(new Date().toISOString().split('T')[0]); setTrackingCompraGlobal(''); setEtaGlobal(''); setUbicacionGlobal('Proveedor'); setDestinoGlobal('Stock EEUU'); setEstadoPagoGlobal(''); }} className="mb-6 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold">
          ← Volver a subir
        </button>
        <h1 className="text-3xl font-bold mb-6">Revisar {items.length} ítems detectados</h1>

        {/* Datos globales de la orden (para aplicar a todos los que no vengan en el excel) */}
        <div className="bg-blue-50 p-6 rounded-lg mb-8 border border-blue-200">
          <h2 className="text-xl font-bold mb-4 text-blue-800">Datos globales de la Orden (Aplicar si no viene en el Excel)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1">Nro. de orden</label>
              <input type="text" value={nroOrdenGlobal} onChange={e => setNroOrdenGlobal(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Proveedor</label>
              <input type="text" value={proveedorGlobal} onChange={e => setProveedorGlobal(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Fecha de compra</label>
              <input type="date" value={fechaCompraGlobal} onChange={e => setFechaCompraGlobal(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Tracking de compra</label>
              <input type="text" value={trackingCompraGlobal} onChange={e => setTrackingCompraGlobal(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Link Tracking</label>
              <a href={generarParcelsAppLink(trackingCompraGlobal)} target="_blank" rel="noopener noreferrer" className="w-full border rounded px-3 py-2 bg-gray-100 text-blue-600 hover:underline block truncate">
                {generarParcelsAppLink(trackingCompraGlobal).length > 20 ? generarParcelsAppLink(trackingCompraGlobal).substring(0, 20) + '...' : generarParcelsAppLink(trackingCompraGlobal)} 🔗
              </a>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">ETA</label>
              <input type="date" value={etaGlobal} onChange={e => setEtaGlobal(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Ubicación</label>
              <select value={ubicacionGlobal} onChange={e => setUbicacionGlobal(e.target.value)} className="w-full border rounded px-3 py-2">
                {UBICACIONES_FISICAS_IMPORTAR.map(u => (<option key={u} value={u}>{u}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Destino</label>
              <select value={destinoGlobal} onChange={e => setDestinoGlobal(e.target.value)} className="w-full border rounded px-3 py-2">
                {DESTINOS_FINALES_IMPORTAR.map(d => (<option key={d} value={d}>{d}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Estado de Pago</label>
              <select value={estadoPagoGlobal} onChange={e => setEstadoPagoGlobal(e.target.value)} className="w-full border rounded px-3 py-2">
                <option value="">— Sin definir —</option>
                <option value="Saldado">Saldado</option>
                <option value="Debe">Debe</option>
                <option value="Debemos">Debemos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Asignar cliente global */}
        <div className="bg-green-50 p-6 rounded-lg mb-8 border border-green-200">
          <h2 className="text-xl font-bold mb-4 text-green-800">Asignar cliente a todos los ítems (opcional)</h2>
          <div className="flex gap-4 relative">
            <input
              type="text"
              value={cliSearchGlobal}
              onChange={e => { setCliSearchGlobal(e.target.value); setShowCliDropGlobal(true) }}
              onFocus={() => setShowCliDropGlobal(true)}
              placeholder="Buscar cliente..."
              className="flex-1 border rounded px-3 py-2"
            />
            {showCliDropGlobal && filtCliGlobal.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border rounded mt-1 shadow-lg z-10 max-h-48 overflow-y-auto">
                {filtCliGlobal.map(c => (
                  <button key={c.id} type="button" onClick={e => { e.preventDefault(); setCliGlobal(c.nombre); setCliGlobalId(c.id); setShowCliDropGlobal(false) }} className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b last:border-b-0">
                    {c.nombre}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={asignarCliGlobal} disabled={!cliGlobalId} className="btn bg-green-600 text-white hover:bg-green-700 flex-shrink-0">Asignar a seleccionados</button>
          </div>
        </div>

        {/* Ítems individuales */}
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
                  {/* Campos editables para cada ítem */}
                  <input type="date" value={it.fecha_compra || ''} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, fecha_compra: e.target.value } : x))} placeholder="Fecha Compra" className="border rounded px-2 py-1 text-sm" />
                  <input type="text" value={it.producto} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, producto: e.target.value } : x))} placeholder="Producto" className="border rounded px-2 py-1 text-sm" />
                  <input type="text" value={it.oem || ''} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, oem: e.target.value } : x))} placeholder="OEM" className="border rounded px-2 py-1 text-sm" />
                  <input type="number" step="1" value={it.cantidad} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, cantidad: parseInt(e.target.value) || 0 } : x))} placeholder="Cantidad" className="border rounded px-2 py-1 text-sm" />
                  <input type="number" step="0.01" value={it.importe_unitario} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, importe_unitario: parseFloat(e.target.value) || 0 } : x))} placeholder="Importe Unit." className="border rounded px-2 py-1 text-sm" />
                  <input type="text" value={it.nro_orden || ''} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, nro_orden: e.target.value } : x))} placeholder="Nro Orden" className="border rounded px-2 py-1 text-sm" />
                  <input type="text" value={it.pagina || ''} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, pagina: e.target.value } : x))} placeholder="Página Compra" className="border rounded px-2 py-1 text-sm" />
                  <input type="text" value={it.link_producto || ''} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, link_producto: e.target.value } : x))} placeholder="Link Producto" className="border rounded px-2 py-1 text-sm" />
                  <input type="number" step="0.01" value={it.peso || ''} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, peso: parseFloat(e.target.value) || 0 } : x))} placeholder="Peso" className="border rounded px-2 py-1 text-sm" />
                  <input type="number" step="0.01" value={it.costo_envio_unitario} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, costo_envio_unitario: parseFloat(e.target.value) || 0 } : x))} placeholder="Envío Unit." className="border rounded px-2 py-1 text-sm" />
                  <input type="number" step="0.01" value={it.taxes_unitario} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, taxes_unitario: parseFloat(e.target.value) || 0 } : x))} placeholder="Taxes Unit." className="border rounded px-2 py-1 text-sm" />
                  <input type="number" step="0.01" value={it.reembolsos_unitario} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, reembolsos_unitario: parseFloat(e.target.value) || 0 } : x))} placeholder="Reembolsos Unit." className="border rounded px-2 py-1 text-sm" />
                  <p className="font-bold text-blue-600 text-sm flex items-center justify-center">Total: {fmt(it.costo_total_unitario)}</p>
                  <input type="date" value={it.eta || ''} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, eta: e.target.value } : x))} placeholder="ETA" className="border rounded px-2 py-1 text-sm" />
                  <input type="text" value={it.tracking_compra || ''} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, tracking_compra: e.target.value } : x))} placeholder="Tracking" className="border rounded px-2 py-1 text-sm" />
                  <select value={it.ubicacion || 'Proveedor'} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, ubicacion: e.target.value } : x))} className="border rounded px-2 py-1 text-sm">
                    {UBICACIONES_FISICAS_IMPORTAR.map(u => (<option key={u} value={u}>{u}</option>))}
                  </select>
                  <select value={it.destino || 'Stock EEUU'} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, destino: e.target.value } : x))} className="border rounded px-2 py-1 text-sm">
                    {DESTINOS_FINALES_IMPORTAR.map(d => (<option key={d} value={d}>{d}</option>))}
                  </select>
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
                <li>✓ Fecha de compra, Tracking y ETA</li>
                <li>✓ Ubicación y Destino</li>
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
              placeholder={`FECHA\tProducto\tOEM\tCantidad\tImporte Unitario\tnro_orden\tpagina_de_compra\tlink_producto\tpeso\tCosto Envío Unitario\tcosto_total\teta\ttracking_compra\tubicacion\tdestino\tTaxes Unitario\tReembolsos Unitario\n2023-10-26\tFiltro Aire\tXYZ-123\t1\t15.00\tORD-001\tAmazon\thttps://amazon.com/filter\t0.2\t5.00\t20.00\t2023-11-10\tTRK123\tProveedor\tStock EEUU\t1.00\t0.00`}
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
                <li>`FECHA` (YYYY-MM-DD)</li>
                <li>`Producto`</li>
                <li>`OEM`</li>
                <li>`Cantidad`</li>
                <li>`Importe Unitario`</li>
                <li>`nro_orden`</li>
                <li>`pagina_de_compra`</li>
                <li>`link_producto`</li>
                <li>`peso`</li>
                <li>`Costo Envío Unitario`</li>
                <li>`costo_total`</li>
                <li>`eta` (YYYY-MM-DD)</li>
                <li>`tracking_compra`</li>
                <li>`ubicacion`</li>
                <li>`destino`</li>
                <li>`Taxes Unitario`</li>
                <li>`Reembolsos Unitario`</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2">Los campos numéricos deben usar punto como separador decimal.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
