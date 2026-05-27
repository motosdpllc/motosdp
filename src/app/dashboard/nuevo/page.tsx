'use client'
import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { supabase, fmt, getNextCounter, type Cliente } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import BotonIA from './BotonIA'
import SelectorCotizacion from './SelectorCotizacion'

const MARCAS = [{ v: 'K', l: 'Kawasaki (K)' }, { v: 'Y', l: 'Yamaha (Y)' }, { v: 'S', l: 'Suzuki (S)' }, { v: 'H', l: 'Honda (H)' }, { v: 'HD', l: 'Harley-Davidson (HD)' }, { v: 'OTHER', l: 'Otra...' }]
const SUBCODIGOS = [{ v: 'M', l: 'M – Motor' }, { v: 'C', l: 'C – Carbureción' }, { v: 'E', l: 'E – Electricidad' }, { v: 'T', l: 'T – Transmisión' }, { v: 'F', l: 'F – Frenos' }, { v: 'S', l: 'S – Suspensión/Chasis' }, { v: 'X', l: 'X – Carrocería' }, { v: 'I', l: 'I – Iluminación' }]

// --- NUEVAS UBICACIONES Y DESTINOS CON LA LÓGICA CLARIFICADA ---
const UBICACIONES_FISICAS = ['Proveedor','En tránsito','En tránsito a Daniel','Daniel','Pablo','Blue Mail','Tato','Tránsito a Bs As','Stock EEUU', 'Stock España', 'Stock Argentina', 'En Mano', 'Entregado']
const DESTINOS_FINALES = ['Stock EEUU', 'Stock España', 'Stock Argentina', 'Venta Argentina', 'Venta Internacional', 'Uso Propio', 'Stock Internacional']

const PLATAFORMAS = ['eBay', 'MercadoLibre', 'Amazon', 'Wallapop', 'Facebook Marketplace', 'Web Directa']

interface ItemForm {
  id?: string
  pagina?: string
  fecha_compra?: string
  producto: string
  marca?: string
  marca_custom?: string
  anio?: string
  modelo?: string
  subcodigo?: string
  oem?: string
  nro_orden?: string
  tracking_compra?: string
  link_tracking_compra?: string
  eta?: string
  link_producto?: string
  importe: number
  peso: number
  largo: number
  ancho: number
  alto: number
  tipo_envio: string
  costo_envio: number
  taxes: number
  reembolsos: number
  precio_venta?: number
  cliente_id?: string
  cliente_nombre?: string
  ubicacion: string
  destino: string
  estado_pago?: string
  plataforma?: string
  link_publicacion?: string
  codigo: string
  pendiente_compra?: boolean
}

const EMPTY_ITEM: ItemForm = {
  codigo: '',
  producto: '',
  importe: 0,
  peso: 0,
  largo: 0,
  ancho: 0,
  alto: 0,
  tipo_envio: 'aereo',
  costo_envio: 0,
  taxes: 0,
  reembolsos: 0,
  ubicacion: 'Proveedor', // Valor inicial sugerido
  destino: 'Stock EEUU', // Valor inicial sugerido
  fecha_compra: new Date().toISOString().split('T')[0],
}

function NuevoForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const cliDropRef = useRef<HTMLDivElement>(null)
  const cotDropRef = useRef<HTMLDivElement>(null)

  const [clientes, setClientes] = useState<any[]>([])
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [cliSearch, setCliSearch] = useState('')
  const [showCliDrop, setShowCliDrop] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [codigoDisplay, setCodigoDisplay] = useState('—')

  const [tipoCarga, setTipoCarga] = useState<'Stock' | 'Venta'>('Stock')
  const [plataformasSeleccionadas, setPlataformasSeleccionadas] = useState<string[]>([])

  const [f, setF] = useState<ItemForm>(EMPTY_ITEM)
  const [calc, setCalc] = useState({ costo_total: 0, ganancia: 0, taxes11: 0 })

  useEffect(() => {
    supabase.from('clientes').select('id, nombre, telefono, provincia').order('nombre').then(({ data }) => setClientes(data || []))
    supabase.from('cotizaciones').select('*, cotizacion_items(*)').order('created_at', { ascending: false }).limit(20).then(({ data }) => setCotizaciones(data || []))
  }, [])

  useEffect(() => {
    const itemId = searchParams.get('edit')
    if (itemId) {
      const loadItem = async () => {
        setLoading(true)
        const { data, error } = await supabase.from('items').select('*').eq('id', itemId).single()
        if (data) {
          setF({
            ...data,
            importe: data.importe || 0,
            peso: data.peso || 0,
            largo: data.largo || 0,
            ancho: data.ancho || 0,
            alto: data.alto || 0,
            costo_envio: data.costo_envio || 0,
            taxes: data.taxes || 0,
            reembolsos: data.reembolsos || 0,
            producto: data.producto || '',
            codigo: data.codigo || '',
            ubicacion: data.ubicacion || 'Proveedor',
            destino: data.destino === 'Vendido' ? 'Venta Argentina' : (data.destino || 'Stock EEUU'), // Ajuste para el switch
            marca_custom: '',
            link_producto: data.link_producto || '',
            nro_orden: data.nro_orden || '',
            tracking_compra: data.tracking_compra || '',
            link_tracking_compra: data.link_tracking_compra || '',
            eta: data.eta || '',
            plataforma: data.plataforma || '',
            link_publicacion: data.link_publicacion || '',
            precio_venta: data.precio_venta || 0,
            cliente_id: data.cliente_id || '',
            cliente_nombre: data.cliente_nombre || '',
            fecha_compra: data.fecha_compra || new Date().toISOString().split('T')[0],
            oem: data.oem || '',
            marca: data.marca || '',
            anio: data.anio || '',
            modelo: data.modelo || '',
            subcodigo: data.subcodigo || '',
            tipo_envio: data.tipo_envio || 'aereo',
            estado_pago: data.estado_pago || '',
            pendiente_compra: data.pendiente_compra || false
          })
          setEditId(itemId)
          setCliSearch(data.cliente_nombre || '')
          setTipoCarga(data.destino === 'Vendido' || data.cliente_id ? 'Venta' : 'Stock')
          if (data.plataforma) setPlataformasSeleccionadas(data.plataforma.split(', '))
        } else if (error) {
          toast.error('Error al cargar ítem: ' + error.message)
          console.error(error)
        }
        setLoading(false)
      }
      loadItem()
    } else {
      setF(EMPTY_ITEM)
      setEditId(null)
      setTipoCarga('Stock')
      setPlataformasSeleccionadas([])
    }
  }, [searchParams])

  // Lógica de generación de código (prioriza OEM)
  const generarCodigoSugerido = useCallback(() => {
    const { marca, anio, modelo, subcodigo } = f
    const finalMarca = (marca === 'OTHER' && f.marca_custom) ? f.marca_custom.substring(0, 3).toUpperCase() : (marca ? marca.substring(0, 3).toUpperCase() : '')
    const finalAnio = anio ? anio.substring(2, 4) : ''
    const finalModelo = modelo ? modelo.substring(0, 3).toUpperCase() : ''
    const finalSubcodigo = subcodigo ? subcodigo.substring(0, 3).toUpperCase() : 'XXX'
    
    if (finalMarca && finalAnio && finalModelo) {
      return `${finalMarca}-${finalAnio}-${finalModelo}-${finalSubcodigo}`
    }
    return ''
  }, [f.marca, f.marca_custom, f.anio, f.modelo, f.subcodigo])

  useEffect(() => {
    // Si hay OEM, el código es el OEM. Si no, usa el sugerido.
    if (f.oem) {
      setF(p => ({ ...p, codigo: f.oem }));
      setCodigoDisplay(f.oem);
    } else {
      const sugerido = generarCodigoSugerido();
      setF(p => ({ ...p, codigo: sugerido }));
      setCodigoDisplay(sugerido || '—');
    }
  }, [f.oem, f.marca, f.marca_custom, f.anio, f.modelo, f.subcodigo, generarCodigoSugerido]);


  useEffect(() => {
    const imp = f.importe || 0, env = f.costo_envio || 0, tax = f.taxes || 0, ree = f.reembolsos || 0, ven = f.precio_venta || 0
    const taxes11 = imp * 0.11
    const costo = imp + taxes11 + env + tax - ree
    setCalc({ costo_total: costo, ganancia: ven - costo, taxes11 })
  }, [f.importe, f.costo_envio, f.taxes, f.reembolsos, f.precio_venta])

  useEffect(() => {
    if (f.tipo_envio === 'aereo') {
      const p = f.peso || 0
      if (p > 0) setF(prev => ({ ...prev, costo_envio: parseFloat((p * 50).toFixed(2)) }))
      else setF(prev => ({ ...prev, costo_envio: 0 }))
    } else if (f.tipo_envio === 'barco') {
      const l = f.largo || 0, a = f.ancho || 0, h = f.alto || 0
      if (l > 0 && a > 0 && h > 0) setF(prev => ({ ...prev, costo_envio: parseFloat((((l * a * h) / 1000000) * 3000).toFixed(2)) }))
      else setF(prev => ({ ...prev, costo_envio: 0 }))
    }
  }, [f.peso, f.largo, f.ancho, f.alto, f.tipo_envio])

  // Lógica de automatización de ubicación según destino y tracking (CORREGIDA)
  useEffect(() => {
    if (!editId) { // Solo auto-asignar en ítems nuevos
      if (f.destino === 'Venta Argentina') {
        setF(prev => ({ ...prev, ubicacion: (f.tracking_compra && f.tracking_compra.trim() !== '') ? 'En tránsito' : 'Proveedor' }));
      } else if (f.destino === 'Venta Internacional') {
        setF(prev => ({ ...prev, ubicacion: 'En Mano' })); // Por defecto En Mano para venta internacional
      } else if (f.tracking_compra && f.tracking_compra.trim() !== '') {
        setF(prev => ({ ...prev, ubicacion: 'En tránsito' }));
      } else {
        setF(prev => ({ ...prev, ubicacion: 'Proveedor' }));
      }
    }
  }, [f.destino, f.tracking_compra, editId]);


  const handleCheckboxPlataforma = (plat: string) => {
    setPlataformasSeleccionadas(prev =>
      prev.includes(plat) ? prev.filter(p => p !== plat) : [...prev, plat]
    )
  }

  const filtCli = clientes.filter((c: Cliente) => cliSearch && c.nombre.toLowerCase().includes(cliSearch.toLowerCase())).slice(0, 8)

  const generarParcelsAppLink = (tracking: string | undefined | null) => {
    return tracking ? `https://parcelsapp.com/es/tracking/${tracking}` : '#';
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.producto.trim()) { toast.error('El producto es obligatorio'); return }
    if (!f.codigo.trim()) { toast.error('El código es obligatorio'); return }
    if (tipoCarga === 'Venta' && !f.cliente_id) { toast.error('Falta seleccionar el cliente para consolidar la Venta'); return }

    setSaving(true)
    try {
      const platFinal = plataformasSeleccionadas.length > 0 ? plataformasSeleccionadas.join(', ') : null

      // Lógica para determinar pendiente_compra (CORREGIDA por tu aclaración)
      // Es pendiente_compra si es una VENTA Y NO TIENE FECHA DE COMPRA (aún no se compró/adquirió)
      const isPendienteCompra = tipoCarga === 'Venta' && (!f.fecha_compra || f.fecha_compra.trim() === '');


      const payload: any = {
        pagina: f.pagina || null,
        fecha_compra: f.fecha_compra || null,
        producto: f.producto,
        marca: f.marca || null,
        anio: f.anio || null,
        modelo: f.modelo || null,
        subcodigo: f.subcodigo || null,
        oem: f.oem || null,
        nro_orden: f.nro_orden || null,
        tracking_compra: f.tracking_compra || null,
        link_tracking_compra: generarParcelsAppLink(f.tracking_compra), // Genera el link aquí
        eta: f.eta || null,
        link_producto: f.link_producto || null,
        importe: f.importe,
        peso: f.peso,
        largo: f.largo || null,
        ancho: f.ancho || null,
        alto: f.alto || null,
        tipo_envio: f.tipo_envio,
        costo_envio: f.costo_envio,
        taxes: f.taxes,
        reembolsos: f.reembolsos,
        costo_total: calc.costo_total, // GUARDADO: Costo total calculado
        precio_venta: f.precio_venta || null,
        ganancia: f.precio_venta ? calc.ganancia : null,
        cliente_id: tipoCarga === 'Venta' ? f.cliente_id : null,
        cliente_nombre: tipoCarga === 'Venta' ? f.cliente_nombre : null,
        ubicacion: f.ubicacion,
        destino: tipoCarga === 'Venta' ? (f.destino === 'Venta Argentina' ? 'Venta Argentina' : 'Venta Internacional') : f.destino, // 'Venta Argentina' o 'Venta Internacional' si es venta, sino el destino de stock
        estado_pago: f.estado_pago || null,
        plataforma: platFinal,
        link_publicacion: f.link_publicacion || null,
        updated_at: new Date().toISOString(),
        pendiente_compra: isPendienteCompra // Guardar el estado de "Pendiente de Compra"
      }

      if (editId) {
        await supabase.from('items').update(payload).eq('id', editId)
        toast.success('Ítem actualizado ✓')
      } else {
        await supabase.from('items').insert({ ...payload, codigo: f.codigo })
        toast.success('Ítem guardado ✓')
      }
      router.push('/dashboard/inventario')
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message)
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cliDropRef.current && !cliDropRef.current.contains(event.target as Node)) {
        setShowCliDrop(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-xl p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{editId ? 'Editar Ítem' : 'Nuevo Ítem'}</h1>
          <button type="button" onClick={() => router.push('/dashboard/inventario')} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold">
            ← Volver al Inventario
          </button>
        </div>

        {/* INTERRUPTOR INTELIGENTE DE FLUJO */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg flex justify-center gap-4 mb-8">
          <button onClick={() => { setTipoCarga('Stock'); setF(p => ({ ...p, destino: 'Stock EEUU', ubicacion: 'Proveedor', cliente_id: undefined, cliente_nombre: undefined, precio_venta: undefined, estado_pago: undefined, pendiente_compra: false })) }} className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${tipoCarga === 'Stock' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            📦 Carga para Stock Directo
          </button>
          <button onClick={() => { setTipoCarga('Venta'); setF(p => ({ ...p, destino: 'Venta Argentina', ubicacion: 'Proveedor', estado_pago: 'Debe', pendiente_compra: true })) }} className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${tipoCarga === 'Venta' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            💰 Carga Vinculada a Venta
          </button>
        </div>

        {loading ? (
          <p className="text-center text-lg text-gray-600 py-10">Cargando ítem...</p>
        ) : (
          <form onSubmit={guardar}>
            {/* Botones de IA y Cotización (solo si no estamos editando) */}
            {!editId && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <BotonIA setF={setF} />
                <SelectorCotizacion cotizaciones={cotizaciones} setF={setF} setCliSearch={setCliSearch} cotDropRef={cotDropRef} />
                <a href="/dashboard/nuevo/importar" className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold text-center flex items-center justify-center">
                  📄 Importar de Factura (IA)
                </a>
              </div>
            )}


            {/* Sección de Información Básica */}
            <div className="bg-gray-50 p-6 rounded-lg mb-8 border border-gray-200">
              <h2 className="text-xl font-bold mb-4 text-gray-800">Básicos del Ítem</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Producto *</label>
                  <input type="text" value={f.producto} onChange={e => setF(p => ({ ...p, producto: e.target.value }))} className="w-full border rounded px-3 py-2" placeholder="Nombre del producto" required />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">OEM (prioritario)</label>
                  <input type="text" value={f.oem || ''} onChange={e => setF(p => ({ ...p, oem: e.target.value }))} className="w-full border rounded px-3 py-2" placeholder="Número OEM" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Código (Auto-generado / OEM / Manual) *</label>
                  <input type="text" value={f.codigo} onChange={e => setF(p => ({ ...p, codigo: e.target.value }))} className="w-full border rounded px-3 py-2 bg-gray-100" placeholder="Código único" readOnly={!!f.oem} required />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Link del Producto (URL)</label>
                  <input type="text" value={f.link_producto || ''} onChange={e => setF(p => ({ ...p, link_producto: e.target.value }))} className="w-full border rounded px-3 py-2" placeholder="URL al producto" />
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-md font-bold mb-3">🛠️ Datos para Código Automático</h3>
                <p className="text-sm text-gray-600 mb-3">Se usan si no hay OEM. Código Sugerido: <span className="font-mono font-bold text-blue-600">{generarCodigoSugerido() || '—'}</span></p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Marca</label>
                    <select value={f.marca || ''} onChange={e => setF(p => ({ ...p, marca: e.target.value, marca_custom: e.target.value === 'OTHER' ? p.marca_custom : '' }))} className="w-full border rounded px-3 py-2">
                      <option value="">— Seleccionar —</option>
                      {MARCAS.map(m => (<option key={m.v} value={m.v}>{m.l}</option>))}
                    </select>
                  </div>
                  {f.marca === 'OTHER' && (
                    <div>
                      <label className="block text-sm font-bold mb-1">Marca Custom (3 letras)</label>
                      <input type="text" value={f.marca_custom || ''} onChange={e => setF(p => ({ ...p, marca_custom: e.target.value.toUpperCase().substring(0,3) }))} className="w-full border rounded px-3 py-2" maxLength={3} />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-bold mb-1">Año</label>
                    <input type="text" value={f.anio || ''} onChange={e => setF(p => ({ ...p, anio: e.target.value }))} className="w-full border rounded px-3 py-2" placeholder="Ej: 2023" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Modelo</label>
                    <input type="text" value={f.modelo || ''} onChange={e => setF(p => ({ ...p, modelo: e.target.value }))} className="w-full border rounded px-3 py-2" placeholder="Ej: CBR1000" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Subcódigo</label>
                    <select value={f.subcodigo || ''} onChange={e => setF(p => ({ ...p, subcodigo: e.target.value }))} className="w-full border rounded px-3 py-2">
                      <option value="">— Seleccionar —</option>
                      {SUBCODIGOS.map(s => (<option key={s.v} value={s.v}>{s.l}</option>))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Sección de Costos */}
            <div className="bg-blue-50 p-6 rounded-lg mb-8 border border-blue-200">
              <h2 className="text-xl font-bold mb-4 text-blue-800">💰 Detalles de Costos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Fecha de Compra</label>
                  <input type="date" value={f.fecha_compra || ''} onChange={e => setF(p => ({ ...p, fecha_compra: e.target.value }))} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Página/Tienda de Compra</label>
                  <input type="text" value={f.pagina || ''} onChange={e => setF(p => ({ ...p, pagina: e.target.value }))} className="w-full border rounded px-3 py-2" placeholder="Ej: eBay, Amazon" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Importe Producto (USD)</label>
                  <input type="number" step="0.01" value={f.importe} onChange={e =>
