'use client'
import { useState, useEffect, Suspense } from 'react'
import { supabase, type Item, type Cliente } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

const MARCAS = [{ v: 'K', l: 'Kawasaki (K)' }, { v: 'Y', l: 'Yamaha (Y)' }, { v: 'S', l: 'Suzuki (S)' }, { v: 'H', l: 'Honda (H)' }, { v: 'HD', l: 'Harley-Davidson (HD)' }, { v: 'OTHER', l: 'Otra...' }]
const SUBCODIGOS = [{ v: 'M', l: 'M – Motor' }, { v: 'C', l: 'C – Carbureción' }, { v: 'E', l: 'E – Electricidad' }, { v: 'T', l: 'T – Transmisión' }, { v: 'F', l: 'F – Frenos' }, { v: 'S', l: 'S – Suspensión/Chasis' }, { v: 'X', l: 'X – Carrocería' }, { v: 'I', l: 'I – Iluminación' }]
const UBICACIONES = ['Proveedor','En tránsito','En tránsito a Daniel','Daniel','Pablo','Blue Mail','Tato','Tránsito a Bs As','En Mano','Vendido','Cancelado']
const DESTINOS = ['Argentina','Stock EEUU','Uso propio','Stock Argentina','Stock Internacional']
const PLATAFORMAS = ['MercadoLibre','eBay','Facebook Marketplace','OLX','Instagram','WhatsApp','Otra']

function NuevoForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const [clientes, setClientes] = useState<Cliente[]>([])
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
    cliente_id: '', cliente_nombre: '',
    ubicacion: 'Proveedor', destino: '', estado_pago: '',
    plataforma: '', plataforma_custom: '', link_publicacion: '',
  })

  const [calc, setCalc] = useState({ costo_total: 0, ganancia: 0 })

  useEffect(() => {
    supabase.from('clientes').select('id, nombre, telefono, provincia').order('nombre').then(({ data }) => setClientes(data || []))
    if (editId) loadEdit(editId)
  }, [editId])

  const loadEdit = async (id: string) => {
    const { data } = await supabase.from('items').select('*').eq('id', id).single()
    if (!data) return
    setF({
      pagina: data.pagina||'', fecha_compra: data.fecha_compra||'', producto: data.producto||'',
      marca: data.marca||'', marca_custom: '', anio: data.anio||'', modelo: data.modelo||'', subcodigo: data.subcodigo||'', oem: data.oem||'',
      nro_orden: data.nro_orden||'', tracking_compra: data.tracking_compra||'', link_tracking_compra: data.link_tracking_compra||'',
      eta: data.eta||'', link_producto: data.link_producto||'',
      importe: data.importe?.toString()||'', peso: data.peso?.toString()||'', tipo_envio: data.tipo_envio||'aereo',
      largo: data.largo?.toString()||'', ancho: data.ancho?.toString()||'', alto: data.alto?.toString()||'',
      costo_envio: data.costo_envio?.toString()||'', taxes: data.taxes?.toString()||'', reembolsos: data.reembolsos?.toString()||'',
      precio_venta: data.precio_venta?.toString()||'',
      cliente_id: data.cliente_id||'', cliente_nombre: data.cliente_nombre||'',
      ubicacion: data.ubicacion||'Proveedor', destino: data.destino||'', estado_pago: data.estado_pago||'',
      plataforma: data.plataforma||'', plataforma_custom: '', link_publicacion: data.link_publicacion||'',
    })
    setCodigoDisplay(data.codigo || '—')
    setCalc({ costo_total: data.costo_total || 0, ganancia: data.ganancia || 0 })
    setCliSearch(data.cliente_nombre || '')
  }

  useEffect(() => {
    const imp = parseFloat(f.importe) || 0
    const env = parseFloat(f.costo_envio) || 0
    const tax = parseFloat(f.taxes) || 0
    const ree = parseFloat(f.reembolsos) || 0
    const ven = parseFloat(f.precio_venta) || 0
    const costo = imp + env + tax - ree
    setCalc({ costo_total: costo, ganancia: ven - costo })
  }, [f.importe, f.costo_envio, f.taxes, f.reembolsos, f.precio_venta])

  // Auto envío
  useEffect(() => {
    if (f.tipo_envio === 'aereo') {
      const peso = parseFloat(f.peso) || 0
      if (peso > 0) setF(p => ({ ...p, costo_envio: (peso * 50).toFixed(2) }))
    } else {
      const l = parseFloat(f.largo) || 0, a = parseFloat(f.ancho) || 0, h = parseFloat(f.alto) || 0
      if (l && a && h) {
        const m3 = (l * a * h) / 1000000
        setF(p => ({ ...p, costo_envio: (m3 * 3000).toFixed(2) }))
      }
    }
  }, [f.peso, f.largo, f.ancho, f.alto, f.tipo_envio])

  // Auto ubicación
  useEffect(() => {
    if (!editId) {
      const t = f.tracking_compra.trim(), p = parseFloat(f.peso) || 0
      setF(prev => ({ ...prev, ubicacion: !t ? 'Proveedor' : p > 0 ? 'En Mano' : 'En tránsito a Daniel' }))
    }
  }, [f.tracking_compra, f.peso, editId])

  // Código auto
  useEffect(() => {
    if (f.oem) { setCodigoDisplay(f.oem); return }
    const mc = f.marca === 'OTHER' ? f.marca_custom.toUpperCase() : f.marca
    const anio = (f.anio || '').toString().slice(-2)
    const modelo = (f.modelo || '').toUpperCase().replace(/\s/g, '')
    if (!mc || !anio || !modelo || !f.subcodigo) { setCodigoDisplay('—'); return }
    setCodigoDisplay(`${mc}${anio}-${modelo}-${f.subcodigo}###`)
  }, [f.oem, f.marca, f.marca_custom, f.anio, f.modelo, f.subcodigo])

  const guardar = async () => {
    if (!f.producto.trim()) { toast.error('El producto es obligatorio'); return }
    setSaving(true)

    // Get next code
    let codigo = f.oem || undefined
    if (!codigo && f.marca && f.anio && f.modelo && f.subcodigo) {
      const mc = f.marca === 'OTHER' ? f.marca_custom.toUpperCase() : f.marca
      const anio = f.anio.slice(-2)
      const modelo = f.modelo.toUpperCase().replace(/\s/g, '')
      const key = `${mc}${anio}-${modelo}-${f.subcodigo}`
      const { data: cnt } = await supabase.rpc('increment_counter', { counter_key: key })
      codigo = `${key}${String(cnt || 1).padStart(3, '0')}`
    }

    const plat = f.plataforma === 'Otra' ? f.plataforma_custom : f.plataforma

    const payload = {
      codigo: editId ? undefined : codigo,
      pagina: f.pagina, fecha_compra: f.fecha_compra || null, producto: f.producto,
      marca: f.marca, marca_code: f.marca === 'OTHER' ? f.marca_custom : f.marca,
      anio: f.anio, modelo: f.modelo, subcodigo: f.subcodigo, oem: f.oem,
      nro_orden: f.nro_orden, tracking_compra: f.tracking_compra, link_tracking_compra: f.link_tracking_compra,
      eta: f.eta || null, link_producto: f.link_producto,
      importe: parseFloat(f.importe) || 0, peso: parseFloat(f.peso) || 0,
      tipo_envio: f.tipo_envio, largo: parseFloat(f.largo) || null, ancho: parseFloat(f.ancho) || null, alto: parseFloat(f.alto) || null,
      costo_envio: parseFloat(f.costo_envio) || 0, taxes: parseFloat(f.taxes) || 0, reembolsos: parseFloat(f.reembolsos) || 0,
      costo_total: calc.costo_total, precio_venta: parseFloat(f.precio_venta) || null, ganancia: parseFloat(f.precio_venta) ? calc.ganancia : null,
      cliente_id: f.cliente_id || null, cliente_nombre: f.cliente_nombre || null,
      ubicacion: f.ubicacion, destino: f.destino || null, estado_pago: f.estado_pago || null,
      plataforma: plat || null, link_publicacion: f.link_publicacion || null,
      updated_at: new Date().toISOString(),
    }

    let error
    if (editId) {
      const res = await supabase.from('items').update(payload).eq('id', editId)
      error = res.error
    } else {
      const res = await supabase.from('items').insert({ ...payload, codigo })
      error = res.error
    }

    if (error) { toast.error('Error al guardar: ' + error.message); setSaving(false); return }
    toast.success(editId ? 'Ítem actualizado' : 'Ítem guardado')
    router.push('/dashboard/inventario')
  }

  const filtCli = clientes.filter(c => c.nombre.toLowerCase().includes(cliSearch.toLowerCase())).slice(0, 6)

  const inp = (id: keyof typeof f, label: string, rest: any = {}) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={f[id] as string} onChange={e => setF(p => ({ ...p, [id]: e.target.value }))} {...rest} />
    </div>
  )

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{editId ? 'Editar ítem' : 'Nuevo ítem'}</h1>
      </div>

      <div className="space-y-4">
        {/* Básicos */}
        <div className="card">
          <div className="text-sm font-semibold mb-4">Información básica</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {inp('pagina', 'Página / tienda', { placeholder: 'eBay, Amazon, AliExpress...' })}
            {inp('fecha_compra', 'Fecha de compra', { type: 'date' })}
            <div className="md:col-span-2 lg:col-span-3">
              {inp('producto', 'Producto *', { placeholder: 'Descripción del repuesto' })}
            </div>
          </div>
        </div>

        {/* Código */}
        <div className="card">
          <div className="text-sm font-semibold mb-4">Código de producto</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="label">Marca</label>
              <select className="input" value={f.marca} onChange={e => setF(p => ({ ...p, marca: e.target.value }))}>
                <option value="">—</option>
                {MARCAS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
            {f.marca === 'OTHER' && (
              <div>{inp('marca_custom', 'Código marca', { placeholder: 'ej: D para Ducati', maxLength: 3 })}</div>
            )}
            {inp('anio', 'Año de la moto', { placeholder: '1988', type: 'number' })}
            {inp('modelo', 'Modelo', { placeholder: 'GSXR600' })}
            <div>
              <label className="label">Subcódigo</label>
              <select className="input" value={f.subcodigo} onChange={e => setF(p => ({ ...p, subcodigo: e.target.value }))}>
                <option value="">—</option>
                {SUBCODIGOS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
            {inp('oem', 'OEM (si tiene)', { placeholder: 'Número OEM' })}
            <div>
              <label className="label">Código generado <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-1">auto</span></label>
              <div className="input-readonly font-mono">{codigoDisplay}</div>
            </div>
          </div>
        </div>

        {/* Logística */}
        <div className="card">
          <div className="text-sm font-semibold mb-4">Logística y tracking</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {inp('nro_orden', 'Nro. de orden', { placeholder: '#orden del proveedor' })}
            {inp('tracking_compra', 'Tracking compra', { placeholder: 'Número de tracking' })}
            {inp('link_tracking_compra', 'Link tracking compra', { placeholder: 'https://...' })}
            {inp('eta', 'Fecha est. entrega', { type: 'date' })}
            {inp('link_producto', 'Link del producto', { placeholder: 'https://...' })}
          </div>
        </div>

        {/* Costos */}
        <div className="card">
          <div className="text-sm font-semibold mb-4">Costos</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {inp('importe', 'Importe (USD)', { type: 'number', step: '0.01', placeholder: '0.00' })}
            {inp('peso', 'Peso (kg)', { type: 'number', step: '0.01', placeholder: '0.00' })}
            <div>
              <label className="label">Tipo de envío</label>
              <select className="input" value={f.tipo_envio} onChange={e => setF(p => ({ ...p, tipo_envio: e.target.value }))}>
                <option value="aereo">Aéreo ($50/kg)</option>
                <option value="barco">Barco/Tato (m³ × $3000)</option>
              </select>
            </div>
            {f.tipo_envio === 'barco' && <>
              {inp('largo', 'Largo (cm)', { type: 'number', step: '0.1' })}
              {inp('ancho', 'Ancho (cm)', { type: 'number', step: '0.1' })}
              {inp('alto', 'Alto (cm)', { type: 'number', step: '0.1' })}
            </>}
            <div>
              <label className="label">Costo envío (USD) <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-1">auto</span></label>
              <input className="input" type="number" step="0.01" value={f.costo_envio} onChange={e => setF(p => ({ ...p, costo_envio: e.target.value }))} />
            </div>
            {inp('taxes', 'Taxes EEUU (USD)', { type: 'number', step: '0.01', placeholder: '0.00' })}
            {inp('reembolsos', 'Reembolsos (USD)', { type: 'number', step: '0.01', placeholder: '0.00' })}
            <div>
              <label className="label">Costo total</label>
              <div className="input-readonly font-semibold">{calc.costo_total > 0 ? '$' + calc.costo_total.toFixed(2) : '—'}</div>
            </div>
            {inp('precio_venta', 'Precio de venta (USD)', { type: 'number', step: '0.01', placeholder: '0.00' })}
            <div>
              <label className="label">Ganancia</label>
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
            {/* Cliente */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">Cliente</label>
              <div className="relative">
                <input className="input" placeholder="Buscar cliente..." value={cliSearch}
                  onChange={e => { setCliSearch(e.target.value); setShowCliDrop(true) }}
                  onFocus={() => setShowCliDrop(true)} />
                {showCliDrop && filtCli.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1">
                    {filtCli.map(c => (
                      <div key={c.id} className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                        onClick={() => { setF(p => ({ ...p, cliente_id: c.id, cliente_nombre: c.nombre })); setCliSearch(c.nombre); setShowCliDrop(false) }}>
                        <div className="font-medium text-sm">{c.nombre}</div>
                        <div className="text-xs text-gray-400">{c.telefono} {c.provincia ? '· ' + c.provincia : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="label">Ubicación <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-1">auto</span></label>
              <select className="input" value={f.ubicacion} onChange={e => setF(p => ({ ...p, ubicacion: e.target.value }))}>
                {UBICACIONES.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Destino</label>
              <select className="input" value={f.destino} onChange={e => setF(p => ({ ...p, destino: e.target.value }))}>
                <option value="">—</option>
                {DESTINOS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estado $</label>
              <select className="input" value={f.estado_pago} onChange={e => setF(p => ({ ...p, estado_pago: e.target.value }))}>
                <option value="">—</option>
                <option>Saldado</option><option>Debe</option><option>Debemos</option>
              </select>
            </div>
            <div>
              <label className="label">Publicado en</label>
              <select className="input" value={f.plataforma} onChange={e => setF(p => ({ ...p, plataforma: e.target.value }))}>
                <option value="">No publicado</option>
                {PLATAFORMAS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            {f.plataforma === 'Otra' && inp('plataforma_custom', 'Especificar plataforma', { placeholder: 'Nombre de la plataforma' })}
            {inp('link_publicacion', 'Link de publicación', { placeholder: 'https://... (opcional)' })}
          </div>
        </div>

        <div className="flex gap-3">
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
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">Cargando...</div>}>
      <NuevoForm />
    </Suspense>
  )
}
