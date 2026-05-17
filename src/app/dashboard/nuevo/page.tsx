'use client'
import { useState, useEffect, Suspense, useRef } from 'react'
import { supabase, type Cliente } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import BotonIA from './BotonIA'
import SelectorCotizacion from './SelectorCotizacion'

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
  const [saving, setSaving] = useState(false)
  const [codigoDisplay, setCodigoDisplay] = useState('—')

  const [f, setF] = useState({
    pagina: '', fecha_compra: new Date().toISOString().split('T')[0], producto: '',
    marca: '', marca_custom: '', anio: '', modelo: '', subcodigo: '', oem: '',
    nro_orden: '', tracking_compra: '', link_tracking_compra: '', eta: '', link_producto: '',
    importe: '', peso: '', tipo_envio: 'aereo', largo: '', ancho: '', alto: '',
    costo_envio: '', taxes: '', reembolsos: '', precio_venta: '',
    cliente_id: '', cliente_nombre: '', ubicacion: 'Proveedor', destino: '', estado_pago: '',
    plataforma: '', plataforma_custom: '', link_publicacion: '',
  })
  const [calc, setCalc] = useState({ costo_total: 0, ganancia: 0, taxes11: 0 })

  useEffect(() => {
    supabase.from('clientes').select('id, nombre, telefono, provincia').order('nombre').then(({ data }) => setClientes(data || []))
    supabase.from('cotizaciones').select('*, cotizacion_items(*)').order('created_at', { ascending: false }).limit(20).then(({ data }) => setCotizaciones(data || []))
    if (editId) loadEdit(editId)

    const h = (e: MouseEvent) => {
      if (cliDropRef.current && !cliDropRef.current.contains(e.target as Node)) setShowCliDrop(false)
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

  useEffect(() => {
    const imp = parseFloat(f.importe) || 0, env = parseFloat(f.costo_envio) || 0, tax = parseFloat(f.taxes) || 0, ree = parseFloat(f.reembolsos) || 0, ven = parseFloat(f.precio_venta) || 0
    const taxes11 = imp * 0.11, costo = imp + taxes11 + env + tax - ree
    setCalc({ costo_total: costo, ganancia: ven - costo, taxes11 })
  }, [f.importe, f.costo_envio, f.taxes, f.reembolsos, f.precio_venta])

  useEffect(() => {
    if (f.tipo_envio === 'aereo') {
      const p = parseFloat(f.peso) || 0
      if (p > 0) setF(prev => ({ ...prev, costo_envio: (p * 50).toFixed(2) }))
    } else {
      const l = parseFloat(f.largo) || 0, a = parseFloat(f.ancho) || 0, h = parseFloat(f.alto) || 0
      if (l && a && h) setF(prev => ({ ...prev, costo_envio: (((l * a * h) / 1000000) * 3000).toFixed(2) }))
    }
  }, [f.peso, f.largo, f.ancho, f.alto, f.tipo_envio])

  useEffect(() => {
    if (!editId) {
      const t = f.tracking_compra.trim(), p = parseFloat(f.peso) || 0
      setF(prev => ({ ...prev, ubicacion: !t ? 'Proveedor' : p > 0 ? 'En Mano' : 'En tránsito a Daniel' }))
    }
  }, [f.tracking_compra, f.peso, editId])

  useEffect(() => {
    if (f.oem) { setCodigoDisplay(f.oem); return }
    const mc = f.marca === 'OTHER' ? f.marca_custom.toUpperCase() : f.marca, anio = (f.anio || '').toString().slice(-2), mod = (f.modelo || '').toUpperCase().replace(/\s/g, '')
    if (!mc || !anio || !mod || !f.subcodigo) { setCodigoDisplay('—'); return }
    setCodigoDisplay(`${mc}${anio}-${mod}-${f.subcodigo}###`)
  }, [f.oem, f.marca, f.marca_custom, f.anio, f.modelo, f.subcodigo])

  const filtCli = clientes.filter(c => cliSearch && c.nombre.toLowerCase().includes(cliSearch.toLowerCase())).slice(0, 8)

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
      pagina: f.pagina || null, fecha_compra: f.fecha_compra || null, producto: f.producto, marca: f.marca || null, anio: f.anio || null, modelo: f.modelo || null, subcodigo: f.subcodigo || null, oem: f.oem || null, nro_orden: f.nro_orden || null, tracking_compra: f.tracking_compra || null, link_tracking_compra: f.link_tracking_compra || null, eta: f.eta || null, link_producto: f.link_producto || null, importe: parseFloat(f.importe) || 0, peso: parseFloat(f.peso) || 0, tipo_envio: f.tipo_envio, largo: parseFloat(f.largo) || null, ancho: parseFloat(f.ancho) || null, alto: parseFloat(f.alto) || null, costo_envio: parseFloat(f.costo_envio) || 0, taxes: parseFloat(f.taxes) || 0, reembolsos: parseFloat(f.reembolsos) || 0, costo_total: calc.costo_total, precio_venta: parseFloat(f.precio_venta) || null, ganancia: parseFloat(f.precio_venta) ? calc.ganancia : null, cliente_id: f.cliente_id || null, cliente_nombre: f.cliente_nombre || null, ubicacion: f.ubicacion, destino: f.destino || null, estado_pago: f.estado_pago || null, plataforma: plat || null, link_publicacion: f.link_publicacion || null, updated_at: new Date().toISOString(),
    }
    const { error } = editId ? await supabase.from('items').update(payload).eq('id', editId) : await supabase.from('items').insert({ ...payload, codigo })
    if (error) { toast.error('Error: ' + error.message); setSaving(false); return }
    toast.success(editId ? 'Ítem actualizado ✓' : 'Ítem guardado ✓')
    router.push('/dashboard/inventario')
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{editId ? 'Editar ítem' : 'Nuevo ítem'}</h1>
{!editId && <BotonIA linkProducto={f.link_producto} setLinkProducto={(v: string) => setF(p => ({ ...p, link_producto: v }))} setF={setF} />}
      {!editId && <SelectorCotizacion cotizaciones={cotizaciones} setF={setF} setCliSearch={setCliSearch} cotDropRef={cotDropRef} />}
      <div className="space-y-4">
        <div className="card">
          <div className="text-sm font-semibold mb-4">Información básica</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div><label className="label">Página / tienda</label><input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="eBay..." value={f.pagina} onChange={e => setF(p => ({ ...p, pagina: e.target.value }))} /></div>
            <div><label className="label">Fecha de compra</label><input className="w-full px-3 py-2 border rounded-lg text-sm" type="date" value={f.fecha_compra} onChange={e => setF(p => ({ ...p, fecha_compra: e.target.value }))} /></div>
            <div className="md:col-span-2 lg:col-span-3"><label className="label">Producto *</label><input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Descripción" value={f.producto} onChange={e => setF(p => ({ ...p, producto: e.target.value }))} /></div>
          </div>
        </div>
        <div className="card">
          <div className="text-sm font-semibold mb-4">Código de producto</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div><label className="label">Marca</label><select className="w-full px-3 py-2 border rounded-lg text-sm" value={f.marca} onChange={e => setF(p => ({ ...p, marca: e.target.value }))}><option value="">—</option>{MARCAS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}</select></div>
            {f.marca === 'OTHER' && <div><label className="label">Código marca</label><input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="ej: D" value={f.marca_custom} onChange={e => setF(p => ({ ...p, marca_custom: e.target.value }))} maxLength={3} /></div>}
            <div><label className="label">Año</label><input className="w-full px-3 py-2 border rounded-lg text-sm" type="number" placeholder="1988" value={f.anio} onChange={e => setF(p => ({ ...p, anio: e.target.value }))} /></div>
            <div><label className="label">Modelo</label><input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="GSXR600" value={f.modelo} onChange={e => setF(p => ({ ...p, modelo: e.target.value }))} /></div>
            <div><label className="label">Subcódigo</label><select className="w-full px-3 py-2 border rounded-lg text-sm" value={f.subcodigo} onChange={e => setF(p => ({ ...p, subcodigo: e.target.value }))}><option value="">—</option>{SUBCODIGOS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
            <div><label className="label">OEM</label><input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Número OEM" value={f.oem} onChange={e => setF(p => ({ ...p, oem: e.target.value }))} /></div>
            <div><label className="label">Código <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-1">auto</span></label><div className="px-3 py-2 border rounded-lg text-sm bg-gray-50 font-mono">{codigoDisplay}</div></div>
          </div>
        </div>
        <div className="card">
          <div className="text-sm font-semibold mb-4">Logística</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div><label className="label">Nro. de orden</label><input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="#orden" value={f.nro_orden} onChange={e => setF(p => ({ ...p, nro_orden: e.target.value }))} /></div>
            <div><label className="label">Tracking compra</label><input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Tracking" value={f.tracking_compra} onChange={e => setF(p => ({ ...p, tracking_compra: e.target.value }))} /></div>
            <div><label className="label">Link tracking</label><input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://..." value={f.link_tracking_compra} onChange={e => setF(p => ({ ...p, link_tracking_compra: e.target.value }))} /></div>
            <div><label className="label">ETA</label><input className="w-full px-3 py-2 border rounded-lg text-sm" type="date" value={f.eta} onChange={e => setF(p => ({ ...p, eta: e.target.value }))} /></div>
            <div className="md:col-span-2"><label className="label">Link del producto</label><input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://..." value={f.link_producto} onChange={e => setF(p => ({ ...p, link_producto: e.target.value }))} /></div>
          </div>
        </div>
        <div className="card">
          <div className="text-sm font-semibold mb-4">Costos</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div><label className="label">Importe (USD)</label><input className="w-full px-3 py-2 border rounded-lg text-sm" type="number" step="0.01" value={f.importe} onChange={e => setF(p => ({ ...p, importe: e.target.value }))} /></div>
            <div><label className="label">Taxes 11%</label><div className="px-3 py-2 border rounded-lg text-sm bg-gray-50">{calc.taxes11 > 0 ? '$' + calc.taxes11.toFixed(2) : '—'}</div></div>
            <div><label className="label">Peso (kg)</label><input className="w-full px-3 py-2 border rounded-lg text-sm" type="number" step="0.01" value={f.peso} onChange={e => setF(p => ({ ...p, peso: e.target.value }))} /></div>
            <div><label className="label">Tipo envío</label><select className="w-full px-3 py-2 border rounded-lg text-sm" value={f.tipo_envio} onChange={e => setF(p => ({ ...p, tipo_envio: e.target.value }))}><option value="aereo">Aéreo ($50/kg)</option><option value="barco">Barco</option></select></div>
            {f.tipo_envio === 'barco' && <>
              <div><label className="label">Largo (cm)</label><input className="w-full px-3 py-2 border rounded-lg text-sm" type="number" step="0.1" value={f.largo} onChange={e => setF(p => ({ ...p, largo: e.target.value }))} /></div>
              <div><label className="label">Ancho (cm)</label><input className="w-full px-3 py-2 border rounded-lg text-sm" type="number" step="0.1" value={f.ancho} onChange={e => setF(p => ({ ...p, ancho: e.target.value }))} /></div>
              <div><label className="label">Alto (cm)</label><input className="w-full px-3 py-2 border rounded-lg text-sm" type="number" step="0.1" value={f.alto} onChange={e => setF(p => ({ ...p, alto: e.target.value }))} /></div>
            </>}
            <div><label className="label">Costo envío</label><input className="w-full px-3 py-2 border rounded-lg text-sm" type="number" step="0.01" value={f.costo_envio} onChange={e => setF(p => ({ ...p, costo_envio: e.target.value }))} /></div>
            <div><label className="label">Taxes EEUU</label><input className="w-full px-3 py-2 border rounded-lg text-sm" type="number" step="0.01" value={f.taxes} onChange={e => setF(p => ({ ...p, taxes: e.target.value }))} /></div>
            <div><label className="label">Reembolsos</label><input className="w-full px-3 py-2 border rounded-lg text-sm" type="number" step="0.01" value={f.reembolsos} onChange={e => setF(p => ({ ...p, reembolsos: e.target.value }))} /></div>
            <div><label className="label">Costo total</label><div className="px-3 py-2 border rounded-lg text-sm bg-gray-50 font-semibold">{calc.costo_total > 0 ? '$' + calc.costo_total.toFixed(2) : '—'}</div></div>
            <div><label className="label">Precio venta</label><input className="w-full px-3 py-2 border rounded-lg text-sm" type="number" step="0.01" value={f.precio_venta} onChange={e => setF(p => ({ ...p, precio_venta: e.target.value }))} /></div>
            <div><label className="label">Ganancia</label><div className={`px-3 py-2 border rounded-lg text-sm bg-gray-50 font-semibold ${calc.ganancia >= 0 ? 'text-green-600' : 'text-red-600'}`}>{f.precio_venta ? (calc.ganancia >= 0 ? '+' : '') + '$' + calc.ganancia.toFixed(2) : '—'}</div></div>
          </div>
        </div>
        <div className="card">
          <div className="text-sm font-semibold mb-4">Clasificación</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">Cliente</label>
              <div className="relative" ref={cliDropRef}>
                <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Buscar cliente..." value={cliSearch} onChange={e => { setCliSearch(e.target.value); setShowCliDrop(true); if (!e.target.value) setF(p => ({ ...p, cliente_id: '', cliente_nombre: '' })) }} onFocus={() => { if (cliSearch) setShowCliDrop(true) }} />
                {showCliDrop && filtCli.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1">
                    {filtCli.map(c => (
                      <div key={c.id} className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer border-b last:border-0 text-sm" onMouseDown={e => { e.preventDefault(); setF(p => ({ ...p, cliente_id: c.id, cliente_nombre: c.nombre })); setCliSearch(c.nombre); setShowCliDrop(false) }}>
                        <div className="font-medium">{c.nombre}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div><label className="label">Ubicación</label><select className="w-full px-3 py-2 border rounded-lg text-sm" value={f.ubicacion} onChange={e => setF(p => ({ ...p, ubicacion: e.target.value }))}>{UBICACIONES.map(u => <option key={u}>{u}</option>)}</select></div>
            <div><label className="label">Destino</label><select className="w-full px-3 py-2 border rounded-lg text-sm" value={f.destino} onChange={e => setF(p => ({ ...p, destino: e.target.value }))}><option value="">—</option>{DESTINOS.map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label className="label">Estado $</label><select className="w-full px-3 py-2 border rounded-lg text-sm" value={f.estado_pago} onChange={e => setF(p => ({ ...p, estado_pago: e.target.value }))}><option value="">—</option><option>Saldado</option><option>Debe</option><option>Debemos</option></select></div>
            <div><label className="label">Publicado en</label><select className="w-full px-3 py-2 border rounded-lg text-sm" value={f.plataforma} onChange={e => setF(p => ({ ...p, plataforma: e.target.value }))}><option value="">No publicado</option>{PLATAFORMAS.map(p => <option key={p}>{p}</option>)}</select></div>
            {f.plataforma === 'Otra' && <div><label className="label">Especificar</label><input className="w-full px-3 py-2 border rounded-lg text-sm" value={f.plataforma_custom} onChange={e => setF(p => ({ ...p, plataforma_custom: e.target.value }))} /></div>}
            <div><label className="label">Link publicación</label><input className="w-full px-3 py-2 border rounded-lg text-sm" value={f.link_publicacion} onChange={e => setF(p => ({ ...p, link_publicacion: e.target.value }))} /></div>
          </div>
        </div>
        <div className="flex gap-3 pb-8">
          <button onClick={guardar} disabled={saving || !f.producto.trim()} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm">{saving ? 'Guardando...' : editId ? 'Actualizar' : 'Guardar'}</button>
          <button onClick={() => router.push('/dashboard/inventario')} className="px-6 py-2 border rounded-lg text-sm text-gray-600">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function NuevoPage() {
  return <Suspense fallback={<div className="p-6 text-gray-400">Cargando...</div>}><NuevoForm /></Suspense>
}