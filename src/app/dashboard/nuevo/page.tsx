'use client'
import { useState, useEffect, Suspense, useRef } from 'react'
import { supabase, type Cliente } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

const MARCAS = [{ v: 'K', l: 'Kawasaki (K)' }, { v: 'Y', l: 'Yamaha (Y)' }, { v: 'S', l: 'Suzuki (S)' }, { v: 'H', l: 'Honda (H)' }, { v: 'HD', l: 'Harley-Davidson (HD)' }, { v: 'OTHER', l: 'Otra...' }]
const SUBCODIGOS = [{ v: 'M', l: 'M – Motor' }, { v: 'C', l: 'C – Carbureción' }, { v: 'E', l: 'E – Electricidad' }, { v: 'T', l: 'T – Transmisión' }, { v: 'F', l: 'F – Frenos' }, { v: 'S', l: 'S – Suspensión/Chasis' }, { v: 'X', l: 'X – Carrocería' }, { v: 'I', l: 'I – Iluminación' }]
const UBICACIONES = ['Proveedor', 'En tránsito', 'En tránsito a Daniel', 'Daniel', 'Pablo', 'Blue Mail', 'Tato', 'Tránsito a Bs As', 'En Mano', 'Vendido', 'Cancelado']
const DESTINOS = ['Argentina', 'Stock EEUU', 'Uso propio', 'Stock Argentina', 'Stock Internacional']
const PLATAFORMAS = ['MercadoLibre', 'eBay', 'Facebook Marketplace', 'OLX', 'Instagram', 'WhatsApp', 'Otra']

function NuevoForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const cliDropRef = useRef<HTMLDivElement>(null)
  const cotDropRef = useRef<HTMLDivElement>(null)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [cliSearch, setCliSearch] = useState('')
  const [showCliDrop, setShowCliDrop] = useState(false)
  const [cotSearch, setCotSearch] = useState('')
  const [showCotDrop, setShowCotDrop] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingIA, setLoadingIA] = useState(false)
  const [codigoDisplay, setCodigoDisplay] = useState('—')

  const [f, setF] = useState({
    pagina: '', fecha_compra: new Date().toISOString().split('T')[0], producto: '',
    marca: '', marca_custom: '', anio: '', modelo: '', subcodigo: '', oem: '',
    nro_orden: '', tracking_compra: '', link_tracking_compra: '', eta: '', link_producto: '',
    importe: '', peso: '', tipo_envio: 'aereo', largo: '', ancho: '', alto: '',
    costo_envio: '', taxes: '', reembolsos: '', precio_venta: '',
    cliente_id: '', cliente_nombre: '',
    ubicacion: 'Proveedor', destino: '', estado_pago: '',
    plataforma: '', plataforma_custom: '', link_publicacion: '',
  })
  const [calc, setCalc] = useState({ costo_total: 0, ganancia: 0, taxes11: 0 })

  useEffect(() => {
    supabase.from('clientes').select('id, nombre, telefono, provincia').order('nombre').then(({ data }) => setClientes(data || []))
    supabase.from('cotizaciones').select('*, cotizacion_items(*)').order('created_at', { ascending: false }).limit(20).then(({ data }) => setCotizaciones(data || []))
    if (editId) loadEdit(editId)

    const h = (e: MouseEvent) => {
      if (cliDropRef.current && !cliDropRef.current.contains(e.target as Node)) setShowCliDrop(false)
      if (cotDropRef.current && !cotDropRef.current.contains(e.target as Node)) setShowCotDrop(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [editId])

  const loadEdit = async (id: string) => {
    const { data } = await supabase.from('items').select('*').eq('id', id).single()
    if (!data) return
    setF({
      pagina: data.pagina || '', fecha_compra: data.fecha_compra || '', producto: data.producto || '',
      marca: data.marca || '', marca_custom: '', anio: data.anio || '', modelo: data.modelo || '',
      subcodigo: data.subcodigo || '', oem: data.oem || '', nro_orden: data.nro_orden || '',
      tracking_compra: data.tracking_compra || '', link_tracking_compra: data.link_tracking_compra || '',
      eta: data.eta || '', link_producto: data.link_producto || '',
      importe: data.importe?.toString() || '', peso: data.peso?.toString() || '',
      tipo_envio: data.tipo_envio || 'aereo', largo: data.largo?.toString() || '',
      ancho: data.ancho?.toString() || '', alto: data.alto?.toString() || '',
      costo_envio: data.costo_envio?.toString() || '', taxes: data.taxes?.toString() || '',
      reembolsos: data.reembolsos?.toString() || '', precio_venta: data.precio_venta?.toString() || '',
      cliente_id: data.cliente_id || '', cliente_nombre: data.cliente_nombre || '',
      ubicacion: data.ubicacion || 'Proveedor', destino: data.destino || '',
      estado_pago: data.estado_pago || '', plataforma: data.plataforma || '',
      plataforma_custom: '', link_publicacion: data.link_publicacion || '',
    })
    setCodigoDisplay(data.codigo || '—')
    setCliSearch(data.cliente_nombre || '')
  }

  // Lógica de consulta a la IA para autocompletar desde el Link
  const analizarLinkConIA = async (url: string) => {
    if (!url || !url.includes('ebay.com') || editId) return
    setLoadingIA(true)
    const toastId = toast.loading('IA analizando publicación de eBay...')

    try {
      const res = await fetch('/api/parse-ebay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      const result = await res.json()

      if (result.success && result.data) {
        const d = result.data
        setF(prev => ({
          ...prev,
          pagina: 'eBay',
          producto: d.producto || prev.producto,
          marca: d.marca || prev.marca,
          anio: d.ano || prev.anio,
          modelo: d.modelo || prev.modelo,
          oem: d.oem || prev.oem,
          peso: d.peso ? d.peso.toString() : prev.peso,
        }))
        toast.success('¡Campos autocompletados con IA! Completá el importe de compra.', { id: toastId })
      } else {
        toast.error('La IA no pudo procesar este link, completalo manualmente.', { id: toastId })
      }
    } catch (err) {
      toast.error('Error al conectar con la IA.', { id: toastId })
    } finally {
      setLoadingIA(false)
    }
  }

  // Auto calcular totales
  useEffect(() => {
    const imp = parseFloat(f.importe) || 0
    const env = parseFloat(f.costo_envio) || 0
    const tax = parseFloat(f.taxes) || 0
    const ree = parseFloat(f.reembolsos) || 0
    const ven = parseFloat(f.precio_venta) || 0
    const taxes11 = imp * 0.11
    const costo = imp + taxes11 + env + tax - ree
    setCalc({ costo_total: costo, ganancia: ven - costo, taxes11 })
  }, [f.importe, f.costo_envio, f.taxes, f.reembolsos, f.precio_venta])

  // Auto envío
  useEffect(() => {
    if (f.tipo_envio === 'aereo') {
      const peso = parseFloat(f.peso) || 0
      if (peso > 0) setF(p => ({ ...p, costo_envio: (peso * 50).toFixed(2) }))
    } else {
      const l = parseFloat(f.largo) || 0, a = parseFloat(f.ancho) || 0, h = parseFloat(f.alto) || 0
      if (l && a && h) setF(p => ({ ...p, costo_envio: (((l * a * h) / 1000000) * 3000).toFixed(2) }))
    }
  }, [f.peso, f.largo, f.ancho, f.alto, f.tipo_envio])

  // Auto ubicación
  useEffect(() => {
    if (!editId) {
      const t = f.tracking_compra.trim(), p = parseFloat(f.peso) || 0
      setF(prev => ({ ...prev, ubicacion: !t ? 'Proveedor' : p > 0 ? 'En Mano' : 'En tránsito a Daniel' }))
    }
  }, [f.tracking_compra, f.peso, editId])

  // Auto código
  useEffect(() => {
    if (f.oem) { setCodigoDisplay(f.oem); return }
    const mc = f.marca === 'OTHER' ? f.marca_custom.toUpperCase() : f.marca
    const anio = (f.anio || '').toString().slice(-2)
    const modelo = (f.modelo || '').toUpperCase().replace(/\s/g, '')
    if (!mc || !anio || !modelo || !f.subcodigo) { setCodigoDisplay('—'); return }
    setCodigoDisplay(`${mc}${anio}-${modelo}-${f.subcodigo}###`)
  }, [f.oem, f.marca, f.marca_custom, f.anio, f.modelo, f.subcodigo])

  // Auto pagina desde link
  useEffect(() => {
    if (!f.link_producto || f.pagina) return
    try {
      const url = new URL(f.link_producto)
      const host = url.hostname.replace('www.', '')
      if (host.includes('ebay')) setF(p => ({ ...p, pagina: 'eBay' }))
      else if (host.includes('amazon')) setF(p => ({ ...p, pagina: 'Amazon' }))
      else if (host.includes('aliexpress')) setF(p => ({ ...p, pagina: 'AliExpress' }))
      else if (host.includes('partzilla')) setF(p => ({ ...p, pagina: 'Partzilla' }))
      else setF(p => ({ ...p, pagina: host }))
    } catch { }
  }, [f.link_producto])

  const filtCli = clientes.filter(c => cliSearch && c.nombre.toLowerCase().includes(cliSearch.toLowerCase())).slice(0, 8)
  const filtCot = cotizaciones.filter(c => !cotSearch || (c.nro || '').toLowerCase().includes(cotSearch.toLowerCase()) || (c.cliente_nombre || '').toLowerCase().includes(cotSearch.toLowerCase())).slice(0, 6)

  const cargarDesdeCot = (cot: any) => {
    const items = cot.cotizacion_items || []
    if (!items.length) { toast.error('Esta cotización no tiene ítems'); return }
    const it = items[0]
    setF(p => ({
      ...p,
      producto: it.descripcion || p.producto,
      link_producto: it.link || p.link_producto,
      pagina: it.ubicacion_producto || p.pagina,
      importe: it.costo?.toString() || p.importe,
      peso: it.peso_estimado?.toString() || p.peso,
      costo_envio: it.costo_envio?.toString() || p.costo_envio,
      cliente_id: cot.cliente_id || p.cliente_id,
      cliente_nombre: cot.cliente_nombre || p.cliente_nombre,
    }))
    if (cot.cliente_nombre) setCliSearch(cot.cliente_nombre)
    setShowCotDrop(false)
    setCotSearch('')
    if (items.length > 1) toast.success(`Cargado ítem 1 de ${items.length}. Para los otros, volvé a buscar la cotización.`)
    else toast.success('Datos de cotización cargados ✓')
  }

  const guardar = async () => {
    if (!f.producto.trim()) { toast.error('El producto es obligatorio'); return }
    setSaving(true)

    let codigo = f.oem || undefined
    if (!codigo && f.marca && f.anio && f.modelo && f.subcodigo) {
      const mc = f.marca === 'OTHER' ? f.marca_custom.toUpperCase() : f.marca
      const key = `${mc}${f.anio.slice(-2)}-${f.modelo.toUpperCase().replace(/\s/g, '')}-${f.subcodigo}`
      const { data: cnt } = await supabase.rpc('increment_counter', { counter_key: key })
      codigo = `${key}${String(cnt || 1).padStart(3, '0')}`
    }

    const plat = f.plataforma === 'Otra' ? f.plataforma_custom : f.plataforma
    const payload: any = {
      pagina: f.pagina || null, fecha_compra: f.fecha_compra || null, producto: f.producto,
      marca: f.marca || null, anio: f.anio || null, modelo: f.modelo || null,
      subcodigo: f.subcodigo || null, oem: f.oem || null, nro_orden: f.nro_orden || null,
      tracking_compra: f.tracking_compra || null, link_tracking_compra: f.link_tracking_compra || null,
      eta: f.eta || null, link_producto: f.link_producto || null,
      importe: parseFloat(f.importe) || 0, peso: parseFloat(f.peso) || 0,
      tipo_envio: f.tipo_envio,
      largo: parseFloat(f.largo) || null, ancho: parseFloat(f.ancho) || null, alto: parseFloat(f.alto) || null,
      costo_envio: parseFloat(f.costo_envio) || 0, taxes: parseFloat(f.taxes) || 0,
      reembolsos: parseFloat(f.reembolsos) || 0, costo_total: calc.costo_total,
      precio_venta: parseFloat(f.precio_venta) || null,
      ganancia: parseFloat(f.precio_venta) ? calc.ganancia : null,
      cliente_id: f.cliente_id || null, cliente_nombre: f.cliente_nombre || null,
      ubicacion: f.ubicacion, destino: f.destino || null, estado_pago: f.estado_pago || null,
      plataforma: plat || null, link_publicacion: f.link_publicacion || null,
      updated_at: new Date().toISOString(),
    }

    let error: any
    if (editId) {
      const res = await supabase.from('items').update(payload).eq('id', editId)
      error = res.error
    } else {
      const res = await supabase.from('items').insert({ ...payload, codigo })
      error = res.error
    }

    if (error) { toast.error('Error: ' + error.message); setSaving(false); return }
    toast.success(editId ? 'Ítem actualizado ✓' : 'Ítem guardado ✓')
    router.push('/dashboard/inventario')
  }

  const s = (id: keyof typeof f) => ({
    value: f[id] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF(p => ({ ...p, [id]: e.target.value }))
  })

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{editId ? 'Editar ítem' : 'Nuevo ítem'}</h1>

      {/* DETECTOR DE LINK PRINCIPAL (PASADO ARRIBA DEL TODO) */}
      {!editId && (
        <div className="card mb-4 border-purple-200 bg-purple-50">
          <div className="text-sm font-semibold text-purple-800 mb-2">⚡ Automatizar carga desde Link de eBay</div>
          <div className="flex gap-2">
            <input 
              className="input bg-white border-purple-300 focus:border-purple-500" 
              placeholder="Pegá el link de eBay acá y presioná afuera para usar la IA..." 
              value={f.link_producto}
              onChange={e => setF(p => ({ ...p, link_producto: e.target.value }))}
              onBlur={e => analizarLinkConIA(e.target.value)}
              disabled={loadingIA}
            />
            <button 
              type="button" 
              onClick={() => analizarLinkConIA(f.link_producto)}
              disabled={loadingIA || !f.link_producto}
              className="btn bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 text-sm rounded-lg"
            >
              {loadingIA ? 'Leyendo...' : 'Escanear'}
            </button>
          </div>
          <p className="text-xs text-purple-600 mt-1">Busca y autocompleta: Producto en español, marca, año, modelo, OEM y peso estimado.</p>
        </div>
      )}

      {/* Cargar desde cotización */}
      {!editId && (
        <div className="card mb-4 border-blue-200 bg-blue-50">
          <div className="text-sm font-semibold text-blue-800 mb-2">📋 Cargar datos desde cotización</div>
          <div className="relative" ref={cotDropRef}>
            <input className="input" placeholder="Buscar cotización por número o cliente..."
              value={cotSearch} onChange={e => { setCotSearch(e.target.value); setShowCotDrop(true) }}
              onFocus={() => setShowCotDrop(true)} />
            {showCotDrop && filtCot.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1">
                {filtCot.map(c => (
                  <div key={c.id} className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                    onMouseDown={e => { e.preventDefault(); cargarDesdeCot(c) }}>
                    <div className="font-medium text-sm">{c.nro} — {c.cliente_nombre || 'Sin cliente'}</div>
                    <div className="text-xs text-gray-400">{c.cotizacion_items?.length || 0} ítems · {c.precio_final ? '$' + c.precio_final : 'Sin precio'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Básicos */}
        <div className="card">
          <div className="text-sm font-semibold mb-4">Información básica</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div><label className="label">Página / tienda</label><input className="input" placeholder="eBay, Amazon..." {...s('pagina')} /></div>
            <div><label className="label">Fecha de compra</label><input className="input" type="date" {...s('fecha_compra')} /></div>
            <div className="md:col-span-2 lg:col-span-3"><label className="label">Producto *</label><input className="input" placeholder="Descripción del repuesto" {...s('producto')} /></div>
          </div>
        </div>

        {/* Código */}
        <div className="card">
          <div className="text-sm font-semibold mb-4">Código de producto</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div><label className="label">Marca</label>
              <select className="input" {...s('marca')}>
                <option value="">—</option>
                {MARCAS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
            {f.marca === 'OTHER' && <div><label className="label">Código marca</label><input className="input" placeholder="ej: D" {...s('marca_custom')} maxLength={3} /></div>}
            <div><label className="label">Año</label><input className="input" type="number" placeholder="1988" {...s('anio')} /></div>
            <div><label className="label">Modelo</label><input className="input" placeholder="GSXR600" {...s('modelo')} /></div>
            <div><label className="label">Subcódigo</label>
              <select className="input" {...s('subcodigo')}>
                <option value="">—</option>
                {SUBCODIGOS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
            <div><label className="label">OEM</label><input className="input" placeholder="Número OEM" {...s('oem')} /></div>
            <div><label className="label">Código <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-1">auto</span></label>
              <div className="input-readonly font-mono text-sm">{codigoDisplay}</div>
            </div>
          </div>
        </div>

        {/* Logística */}
        <div className="card">
          <div className="text-sm font-semibold mb-4">Logística</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div><label className="label">Nro. de orden</label><input className="input" placeholder="#orden del proveedor" {...s('nro_orden')} /></div>
            <div><label className="label">Tracking compra</label><input className="input" placeholder="Número de tracking" {...s('tracking_compra')} /></div>
            <div><label className="label">Link tracking</label><input className="input" placeholder="https://..." {...s('link_tracking_compra')} /></div>
            <div><label className="label">ETA</label><input className="input" type="date" {...s('eta')} /></div>
          </div>
        </div>

        {/* Costos */}
        <div className="card">
          <div className="text-sm font-semibold mb-4">Costos</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div><label className="label">Importe (USD)</label><input className="input" type="number" step="0.01" placeholder="0.00" {...s('importe')} /></div>
            <div>
              <label className="label">Taxes 11% <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-1">auto</span></label>
              <div className="input-readonly text-sm">{calc.taxes11 > 0 ? '$' + calc.taxes11.toFixed(2) : '—'}</div>
            </div>
            <div><label className="label">Peso (kg)</label><input className="input" type="number" step="0.01" placeholder="0.00" {...s('peso')} /></div>
            <div><label className="label">Tipo envío</label>
              <select className="input" {...s('tipo_envio')}>
                <option value="aereo">Aéreo ($50/kg)</option>
                <option value="barco">Barco (m³×$3000)</option>
              </select>
            </div>
            {f.tipo_envio === 'barco' && <>
              <div><label className="label">Largo (cm)</label><input className="input" type="number" step="0.1" {...s('largo')} /></div>
              <div><label className="label">Ancho (cm)</label><input className="input" type="number" step="0.1" {...s('ancho')} /></div>
              <div><label className="label">Alto (cm)</label><input className="input" type="number" step="0.1" {...s('alto')} /></div>
            </>}
            <div><label className="label">Costo envío <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-1">auto</span></label>
              <input className="input" type="number" step="0.01" {...s('costo_envio')} />
            </div>
            <div><label className="label">Taxes EEUU (USD)</label><input className="input" type="number" step="0.01" placeholder="0.00" {...s('taxes')} /></div>
            <div><label className="label">Reembolsos (USD)</label><input className="input" type="number" step="0.01" placeholder="0.00" {...s('reembolsos')} /></div>
            <div><label className="label">Costo total</label>
              <div className="input-readonly font-semibold">{calc.costo_total > 0 ? '$' + calc.costo_total.toFixed(2) : '—'}</div>
            </div>
            <div><label className="label">Precio de venta (USD)</label><input className="input" type="number" step="0.01" placeholder="0.00" {...s('precio_venta')} /></div>
            <div><label className="label">Ganancia</label>
              <div className={`input-readonly font-semibold ${calc.ganancia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {f.precio_venta ? (calc.ganancia >= 0 ? '+' : '') + '$' + calc.ganancia.toFixed(2) : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Clasificación */}
        <div className="card">
          <div className="text-sm font-semibold mb-4">Clasificación</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">Cliente</label>
              <div className="relative" ref={cliDropRef}>
                <input className="input" placeholder="Escribí para buscar cliente..." value={cliSearch}
                  onChange={e => { setCliSearch(e.target.value); setShowCliDrop(true); if (!e.target.value) setF(p => ({ ...p, cliente_id: '', cliente_nombre: '' })) }}
                  onFocus={() => { if (cliSearch) setShowCliDrop(true) }} />
                {showCliDrop && filtCli.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1">
                    {filtCli.map(c => (
                      <div key={c.id} className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                        onMouseDown={e => { e.preventDefault(); setF(p => ({ ...p, cliente_id: c.id, cliente_nombre: c.nombre })); setCliSearch(c.nombre); setShowCliDrop(false) }}>
                        <div className="font-medium text-sm">{c.nombre}</div>
                        <div className="text-xs text-gray-400">{c.telefono} {c.provincia ? '· ' + c.provincia : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div><label className="label">Ubicación <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-1">auto</span></label>
              <select className="input" {...s('ubicacion')}>
                {UBICACIONES.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div><label className="label">Destino</label>
              <select className="input" {...s('destino')}>
                <option value="">—</option>
                {DESTINOS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div><label className="label">Estado $</label>
              <select className="input" {...s('estado_pago')}>
                <option value="">—</option>
                <option>Saldado</option><option>Debe</option><option>Debemos</option>
              </select>
            </div>
            <div><label className="label">Publicado en</label>
              <select className="input" {...s('plataforma')}>
                <option value="">No publicado</option>
                {PLATAFORMAS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            {f.plataforma === 'Otra' && <div><label className="label">Especificar</label><input className="input" placeholder="Plataforma" {...s('plataforma_custom')} /></div>}
            <div><label className="label">Link publicación</label><input className="input" placeholder="https://..." {...s('link_publicacion')} /></div>
          </div>
        </div>

        <div className="flex gap-3 pb-8">
          <button onClick={guardar} disabled={saving || !f.producto.trim()} className="btn btn-primary px-8">
            {saving ? 'Guardando...' : editId ? 'Actualizar ítem' : 'Guardar ítem'}
          </button>
          <button onClick={() => router.push('/dashboard/inventario')} className="btn">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function NuevoPage() {
  return <Suspense fallback={<div className="p-6 text-gray-400">Cargando...</div>}><NuevoForm /></Suspense>
}