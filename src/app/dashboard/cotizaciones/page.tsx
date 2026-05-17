'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase, fmt, fmtDate, type Cliente, type Cotizacion, type CotizacionItem } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { FileText, Plus, X, Eye, Send, Clock, CheckSquare, Square } from 'lucide-react'

const EMPTY_ITEM: any = {
  descripcion: '', link: '', img_url: '', ubicacion_producto: '', costo: 0,
  taxes_impo: 0, peso_estimado: 0, costo_envio: 0, taxes_11: 0, subtotal: 0, orden: 0,
  ganancia_deseada: 0, precio_venta: 0
}
const COSTO_ENVIO_KG = 50 

export default function CotizacionesPage() {
  const [vista, setVista] = useState<'lista' | 'form' | 'pdf'>('lista')
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [currentCot, setCurrentCot] = useState<any>(null)
  const [cliSearch, setCliSearch] = useState('')
  const [showCliDrop, setShowCliDrop] = useState(false)
  const [cotItems, setCotItems] = useState<any[]>([{ ...EMPTY_ITEM }])
  const [saving, setSaving] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [estimandoPeso, setEstimandoPeso] = useState<number | null>(null)
  const cliDropRef = useRef<HTMLDivElement>(null)

  // Opciones de visibilidad para el cliente (Envío / PDF)
  const [visibilidad, setVisibilidad] = useState({
    mostrarLink: false,
    mostrarImagen: true,
    mostrarPrecioUnitario: true,
    mostrarPeso: false
  })

  // Estado para la programación de fecha y hora
  const [showModalProgramar, setShowModalProgramar] = useState(false)
  const [fechaEnvio, setFechaEnvio] = useState('')
  const [horaEnvio, setHoraEnvio] = useState('')

  const [f, setF] = useState({
    nro: '', fecha: new Date().toISOString().split('T')[0],
    cliente_id: '', cliente_nombre: '', destino: '', vin: '',
    precio_final: 0, suma_adicional: 0,
  })

  useEffect(() => {
    loadAll()
    supabase.from('config').select('value').eq('key', 'logo_url').single().then(({ data }) => {
      if (data?.value) setLogoUrl(data.value)
    })
    const h = (e: MouseEvent) => {
      if (cliDropRef.current && !cliDropRef.current.contains(e.target as Node)) setShowCliDrop(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const loadAll = async () => {
    const [cotRes, cliRes] = await Promise.all([
      supabase.from('cotizaciones').select('*, cotizacion_items(*)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nombre')
    ])
    setCotizaciones(cotRes.data || [])
    setClientes(cliRes.data || [])
  }

  const filtCli = clientes.filter(c => cliSearch && c.nombre.toLowerCase().includes(cliSearch.toLowerCase())).slice(0, 6)
  const sinTaxes = ['ES', 'US'].includes(f.destino)

  const recalcItems = (items: any[], destino?: string) => {
    const st = destino !== undefined ? ['ES', 'US'].includes(destino) : sinTaxes
    return items.map(it => {
      const taxes11 = (it.costo || 0) * 0.11
      const taxesImpo = st ? 0 : (it.taxes_impo || 0)
      const costoEnvio = it.peso_estimado ? it.peso_estimado * COSTO_ENVIO_KG : (it.costo_envio || 0)
      const subtotal = (it.costo || 0) + taxes11 + taxesImpo + costoEnvio
      return { ...it, taxes_11: taxes11, costo_envio: costoEnvio, subtotal }
    })
  }

  const updateItem = (i: number, field: string, val: any) => {
    const updated = [...cotItems]
    updated[i] = { ...updated[i], [field]: val }
    setCotItems(recalcItems(updated))
  }

  const totalCosto = cotItems.reduce((a, x) => a + (x.subtotal || 0), 0)
  const totalPeso = cotItems.reduce((a, x) => a + (x.peso_estimado || 0), 0)
  const ganancia = f.precio_final ? f.precio_final - totalCosto : 0

  const nuevaCot = async () => {
    setEditId(null)
    const { data: cnt } = await supabase.rpc('increment_counter', { counter_key: 'cot' })
    setF({
      nro: 'COT-' + String(cnt || 1).padStart(3, '0'),
      fecha: new Date().toISOString().split('T')[0],
      cliente_id: '', cliente_nombre: '', destino: '', vin: '',
      precio_final: 0, suma_adicional: 0
    })
    setCotItems([{ ...EMPTY_ITEM }])
    setCliSearch('')
    setVista('form')
  }

  const editarCot = (cot: any) => {
    setEditId(cot.id)
    setF({
      nro: cot.nro, fecha: cot.fecha || '',
      cliente_id: cot.cliente_id || '', cliente_nombre: cot.cliente_nombre || '',
      destino: cot.destino || '', vin: cot.vin || '',
      precio_final: cot.precio_final || 0, suma_adicional: 0
    })
    setCliSearch(cot.cliente_nombre || '')
    const items = cot.cotizacion_items?.length ? cot.cotizacion_items : [{ ...EMPTY_ITEM }]
    setCotItems(recalcItems(items, cot.destino || ''))
    setVista('form')
  }

  const ejecutarEnvioWhatsApp = (cotData: any) => {
    const cl = clientes.find(c => c.id === cotData.cliente_id)
    const telefono = cl?.telefono ? cl.telefono.replace(/[^0-9]/g, '') : ''
    window.open(`https://wa.me/${telefono}`, '_blank')
  }

  const guardarPre = async (tipoEnvio: 'solo_guardar' | 'enviar_ya' | 'programar') => {
    if (!cotItems[0].descripcion) { toast.error('Agregá al menos un ítem'); return }
    
    if (tipoEnvio === 'programar') {
      setFechaEnvio(new Date().toISOString().split('T')[0])
      setHoraEnvio('10:00')
      setShowModalProgramar(true)
    } else {
      await procesarGuardar(tipoEnvio)
    }
  }

  const procesarGuardar = async (tipoEnvio: 'solo_guardar' | 'enviar_ya' | 'programar') => {
    setSaving(true)
    const payload = {
      nro: f.nro, fecha: f.fecha,
      cliente_id: f.cliente_id || null, cliente_nombre: f.cliente_nombre || null,
      destino: f.destino || null, vin: f.vin || null,
      precio_final: f.precio_final || null,
      updated_at: new Date().toISOString()
    }
    
    let cotId = editId
    if (editId) {
      await supabase.from('cotizaciones').update(payload).eq('id', editId)
      await supabase.from('cotizacion_items').delete().eq('cotizacion_id', editId)
    } else {
      const { data } = await supabase.from('cotizaciones').insert(payload).select().single()
      cotId = data?.id
    }

    if (cotId) {
      const itemsToInsert = cotItems.map((it, i) => {
        const { ganancia_deseada, precio_venta, ...cleanItem } = it
        return { ...cleanItem, cotizacion_id: cotId, orden: i }
      })
      await supabase.from('cotizacion_items').insert(itemsToInsert)
    }

    toast.success('✓ Cotización guardada')
    setSaving(false)
    loadAll()
    
    if (tipoEnvio === 'enviar_ya') {
      ejecutarEnvioWhatsApp(payload)
    }
    
    setVista('lista')
  }

  const handleModalConfirm = () => {
    if (!fechaEnvio || !horaEnvio) {
      toast.error('Por favor selecciona fecha y hora')
      return
    }
    toast.success(`📅 Envío agendado para el ${fmtDate(fechaEnvio)} a las ${horaEnvio} hs`)
    setShowModalProgramar(false)
    
    if (vista === 'pdf' && currentCot) {
      ejecutarEnvioWhatsApp(currentCot)
    } else {
      procesarGuardar('solo_guardar')
    }
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta cotización?')) return
    await supabase.from('cotizaciones').delete().eq('id', id)
    loadAll()
  }

  const estimarPeso = async (i: number) => {
    const desc = cotItems[i].descripcion
    if (!desc) { toast.error('Ingresá la descripción primero'); return }
    setEstimandoPeso(i)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-1.5-flash',
          messages: [{
            role: 'user',
            content: [{ type: 'text', text: `Estimá el peso en kg de este repuesto de moto: "${desc}". Respondé SOLO con un número decimal. Ej: 0.85` }]
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text?.trim()
      const peso = parseFloat(text)
      if (!isNaN(peso) && peso > 0) {
        updateItem(i, 'peso_estimado', peso)
        toast.success(`Peso estimado: ${peso} kg`)
      } else {
        toast.error('No se pudo estimar. Ingresá el peso manualmente.')
      }
    } catch {
      toast.error('Error con la IA. Ingresá el peso manualmente.')
    }
    setEstimandoPeso(null)
  }

  const convertirAVenta = (cot: any) => {
    sessionStorage.setItem('cotizacion_para_venta', JSON.stringify(cot))
    window.location.href = '/dashboard/ventas?desde_cot=' + cot.id
  }

  const verPDF = (cot: any) => { setCurrentCot(cot); setVista('pdf') }

  // Variables calculadas para el render del PDF externo
  const itemsPdf = currentCot?.cotizacion_items || []
  const tPesoPdf = itemsPdf.reduce((a: number, x: any) => a + (x.peso_estimado || 0), 0)
  const tTotalPdf = currentCot?.precio_final || itemsPdf.reduce((a: number, x: any) => a + (x.subtotal || 0), 0)

  return (
    <div className="relative">
      {/* MODAL GLOBAL PARA EL BOTÓN NARANJA */}
      {showModalProgramar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 max-w-md w-full shadow-xl">
            <div className="text-base font-bold mb-2 flex items-center gap-2 text-amber-600">
              <Clock size={18} /> Programar Seguimiento de Envío
            </div>
            <p className="text-xs text-gray-500 mb-4">Elegí la fecha y hora estimada en la que querés dejar asentado el envío para este cliente:</p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha de envío</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-amber-500" 
                  value={fechaEnvio} 
                  onChange={e => setFechaEnvio(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Hora estimada</label>
                <input 
                  type="time" 
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-amber-500" 
                  value={horaEnvio} 
                  onChange={e => setHoraEnvio(e.target.value)} 
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowModalProgramar(false)} className="btn btn-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button onClick={handleModalConfirm} className="btn btn-sm bg-amber-500 text-white hover:bg-amber-600 font-medium">Confirmar y Agendar</button>
            </div>
          </div>
        </div>
      )}

      {/* RENDER DE VISTAS */}
      {vista === 'pdf' && currentCot && (
        <div className="p-6 max-w-5xl grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 bg-gray-50 p-4 rounded-xl border border-gray-200 h-fit no-print">
            <div className="text-sm font-bold mb-3 text-gray-700">Filtros para el Cliente</div>
            <div className="space-y-2.5">
              <button onClick={() => setVisibilidad(p => ({ ...p, mostrarLink: !p.mostrarLink }))} className="flex items-center gap-2 text-sm text-gray-600">
                {visibilidad.mostrarLink ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />} Mostrar Links
              </button>
              <button onClick={() => setVisibilidad(p => ({ ...p, mostrarImagen: !p.mostrarImagen }))} className="flex items-center gap-2 text-sm text-gray-600">
                {visibilidad.mostrarImagen ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />} Mostrar Imágenes
              </button>
              <button onClick={() => setVisibilidad(p => ({ ...p, mostrarPrecioUnitario: !p.mostrarPrecioUnitario }))} className="flex items-center gap-2 text-sm text-gray-600">
                {visibilidad.mostrarPrecioUnitario ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />} Mostrar Precio Unitario
              </button>
              <button onClick={() => setVisibilidad(p => ({ ...p, mostrarPeso: !p.mostrarPeso }))} className="flex items-center gap-2 text-sm text-gray-600">
                {visibilidad.mostrarPeso ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />} Mostrar Peso Estimado
              </button>
            </div>
            <hr className="my-4 border-gray-200" />
            <button onClick={() => ejecutarEnvioWhatsApp(currentCot)} className="btn btn-sm w-full bg-green-600 hover:bg-green-700 text-white flex justify-center gap-1.5 mb-2">
              <Send size={14} /> Enviar por WhatsApp
            </button>
            <button onClick={() => { setFechaEnvio(new Date().toISOString().split('T')[0]); setHoraEnvio('10:00'); setShowModalProgramar(true) }} className="btn btn-sm w-full bg-amber-500 hover:bg-amber-600 text-white flex justify-center gap-1.5">
              <Clock size={14} /> WhatsApp Personalizado
            </button>
          </div>

          <div className="lg:col-span-3">
            <div className="flex gap-2 mb-4 no-print justify-between">
              <button onClick={() => setVista('lista')} className="btn">← Volver</button>
              <button onClick={() => window.print()} className="btn btn-primary">🖨️ Imprimir o Guardar PDF</button>
            </div>
            <div id="pdf-content" style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 12, padding: '2rem', fontFamily: 'Georgia, serif', color: '#222' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, borderBottom: '2px solid #111', paddingBottom: 16 }}>
                <div>
                  {logoUrl ? <img src={logoUrl} alt="Logo" style={{ height: 60, objectFit: 'contain' }} /> : <div style={{ fontSize: 22, fontWeight: 700 }}>🏍️ Motos DP LLC</div>}
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'system-ui', fontSize: 13 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{currentCot.nro}</div>
                  <div style={{ color: '#666' }}>{fmtDate(currentCot.fecha)}</div>
                </div>
              </div>
              <div style={{ marginBottom: 20, fontFamily: 'system-ui' }}>
                <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Cliente</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{currentCot.cliente_nombre || '—'}</div>
                {currentCot.vin && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>VIN: {currentCot.vin}</div>}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, fontFamily: 'system-ui' }}>Cotización de repuestos</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16, fontFamily: 'system-ui' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #ddd', fontWeight: 600, fontSize: 11 }}>#</th>
                    {visibilidad.mostrarImagen && <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #ddd', fontWeight: 600, fontSize: 11 }}>Imagen</th>}
                    <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #ddd', fontWeight: 600, fontSize: 11 }}>Descripción</th>
                    {visibilidad.mostrarLink && <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #ddd', fontWeight: 600, fontSize: 11 }}>Link</th>}
                    {visibilidad.mostrarPeso && <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid #ddd', fontWeight: 600, fontSize: 11 }}>Peso</th>}
                    <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid #ddd', fontWeight: 600, fontSize: 11 }}>Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsPdf.map((it: any, i: number) => (
                    <tr key={i}>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>{i + 1}</td>
                      {visibilidad.mostrarImagen && (
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>
                          {it.img_url ? <img src={it.img_url} alt="" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 4 }} /> : <div style={{ width: 40, height: 40, background: '#f3f4f6', borderRadius: 4 }} />}
                        </td>
                      )}
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}><strong>{it.descripcion || '—'}</strong></td>
                      {visibilidad.mostrarLink && (
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', fontSize: 11 }}>
                          {it.link ? <a href={it.link} style={{ color: '#3b82f6' }} target="_blank" rel="noreferrer">Ver link</a> : '—'}
                        </td>
                      )}
                      {visibilidad.mostrarPeso && <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>{it.peso_estimado ? it.peso_estimado.toFixed(2) + ' kg' : '—'}</td>}
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                        {visibilidad.mostrarPrecioUnitario ? (it.precio_venta ? fmt(it.precio_venta) : it.subtotal ? fmt(it.subtotal) : '—') : 'Incluido'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ textAlign: 'right', fontFamily: 'system-ui' }}>
                {visibilidad.mostrarPeso && <div style={{ fontSize: 13 }}>Peso total estimado: <strong>{tPesoPdf.toFixed(2)} kg</strong></div>}
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>TOTAL: {fmt(tTotalPdf)} USD</div>
              </div>
              <div style={{ marginTop: 32, fontSize: 11, color: '#aaa', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 12, fontFamily: 'system-ui' }}>
                Cotización válida por 15 días · Precios en dólares estadounidenses
              </div>
            </div>
          </div>
        </div>
      )}

      {vista === 'form' && (
        <div className="p-6 max-w-5xl">
          <h1 className="text-2xl font-bold mb-6">{editId ? 'Editar — ' + f.nro : 'Nueva cotización'}</h1>
          <div className="card mb-4">
            <div className="text-sm font-semibold mb-4">Datos generales</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="md:col-span-2 lg:col-span-3">
                <label className="label">Cliente</label>
                <div className="relative" ref={cliDropRef}>
                  <input className="input" placeholder="Escribí para buscar..." value={cliSearch}
                    onChange={e => { setCliSearch(e.target.value); setShowCliDrop(true); if (!e.target.value) setF(p => ({ ...p, cliente_id: '', cliente_nombre: '' })) }}
                    onFocus={() => { if (cliSearch) setShowCliDrop(true) }} />
                  {showCliDrop && filtCli.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1">
                      {filtCli.map(c => (
                        <div key={c.id} className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                          onMouseDown={e => { e.preventDefault(); setF(p => ({ ...p, cliente_id: c.id, cliente_nombre: c.nombre })); setCliSearch(c.nombre); setShowCliDrop(false) }}>
                          <div className="font-medium text-sm">{c.nombre}</div>
                          <div className="text-xs text-gray-400">{c.telefono}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div><label className="label">Fecha</label><input className="input" type="date" value={f.fecha} onChange={e => setF(p => ({ ...p, fecha: e.target.value }))} /></div>
              <div><label className="label">Nro. cotización</label><input className="input-readonly" readOnly value={f.nro} /></div>
              <div>
                <label className="label">Destino</label>
                <select className="input" value={f.destino} onChange={e => { const d = e.target.value; setF(p => ({ ...p, destino: d })); setCotItems(recalcItems(cotItems, d)) }}>
                  <option value="">—</option>
                  <option value="AR">Argentina</option>
                  <option value="ES">España (sin taxes impo)</option>
                  <option value="US">EEUU (sin taxes impo)</option>
                  <option value="INT">Internacional</option>
                </select>
              </div>
              <div><label className="label">VIN</label><input className="input" placeholder="Número de VIN" value={f.vin} onChange={e => setF(p => ({ ...p, vin: e.target.value }))} /></div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="text-sm font-semibold mb-3">Ítems</div>
            {cotItems.map((it, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4 mb-3 bg-gray-50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                  <div className="col-span-2 md:col-span-4"><label className="label">Descripción *</label><input className="input" placeholder="Nombre del repuesto" value={it.descripcion || ''} onChange={e => updateItem(i, 'descripcion', e.target.value)} /></div>
                  <div className="col-span-2"><label className="label">Link del producto</label><input className="input text-sm" placeholder="https://..." value={it.link || ''} onChange={e => updateItem(i, 'link', e.target.value)} /></div>
                  <div className="col-span-2"><label className="label">URL Imagen</label><input className="input text-sm" placeholder="https://..." value={it.img_url || ''} onChange={e => updateItem(i, 'img_url', e.target.value)} /></div>
                  <div><label className="label">Costo (USD)</label><input className="input text-sm" type="number" step="0.01" value={it.costo || ''} onChange={e => updateItem(i, 'costo', parseFloat(e.target.value) || 0)} /></div>
                  <div><label className="label">Taxes 11%</label><input className="input-readonly text-sm" readOnly value={it.taxes_11 ? '$' + it.taxes_11.toFixed(2) : ''} /></div>
                  <div><label className="label">Taxes impo</label><input className="input text-sm" type="number" step="0.01" disabled={sinTaxes} value={it.taxes_impo || ''} onChange={e => updateItem(i, 'taxes_impo', parseFloat(e.target.value) || 0)} /></div>
                  <div>
                    <label className="label">Peso (kg) <button onClick={() => estimarPeso(i)} disabled={estimandoPeso === i} className="ml-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{estimandoPeso === i ? '...' : '🤖 IA'}</button></label>
                    <input className="input text-sm" type="number" step="0.01" value={it.peso_estimado || ''} onChange={e => updateItem(i, 'peso_estimado', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div><label className="label">Envío ($50/kg)</label><input className="input text-sm" type="number" step="0.01" value={it.costo_envio || ''} onChange={e => updateItem(i, 'costo_envio', parseFloat(e.target.value) || 0)} /></div>
                  <div><label className="label">Ganancia (USD)</label><input className="input text-sm" type="number" step="0.01" value={it.ganancia_deseada || ''} onChange={e => { const g = parseFloat(e.target.value) || 0; setCotItems(p => { const u = [...p]; u[i] = { ...u[i], ganancia_deseada: g, precio_venta: (it.subtotal || 0) + g }; return u }) }} /></div>
                  <div><label className="label">Precio venta</label><input className="input text-sm font-semibold" type="number" step="0.01" value={it.precio_venta || ''} onChange={e => { const pv = parseFloat(e.target.value) || 0; setCotItems(p => { const u = [...p]; u[i] = { ...u[i], precio_venta: pv, ganancia_deseada: pv - (it.subtotal || 0) }; return u }) }} /></div>
                  <div><label className="label">Subtotal</label><input className="input-readonly text-sm font-semibold text-green-700" readOnly value={it.subtotal ? '$' + it.subtotal.toFixed(2) : ''} /></div>
                </div>
                <div className="flex justify-end"><button onClick={() => setCotItems(p => p.filter((_, j) => j !== i))} className="btn btn-sm btn-danger text-xs"><X size={12} /> Eliminar ítem</button></div>
              </div>
            ))}
            <button onClick={() => setCotItems(p => [...p, { ...EMPTY_ITEM }])} className="btn btn-sm mb-4"><Plus size={14} /> Agregar ítem</button>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between text-sm py-1"><span className="text-gray-500">Subtotal ítems</span><span className="font-semibold">{fmt(totalCosto)}</span></div>
              <div className="flex justify-between text-sm py-1"><span className="text-gray-500">Peso total</span><span className="font-semibold">{totalPeso.toFixed(2)} kg</span></div>
            </div>
          </div>

          <div className="card mb-6">
            <div className="text-sm font-semibold mb-3">Precio final</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="label">Suma adicional</label><input className="input" type="number" step="0.01" value={f.suma_adicional || ''} onChange={e => { const extra = parseFloat(e.target.value) || 0; setF(p => ({ ...p, suma_adicional: extra, precio_final: totalCosto + extra })) }} /></div>
              <div><label className="label">Precio final</label><input className="input text-lg font-bold" type="number" step="0.01" value={f.precio_final || ''} onChange={e => setF(p => ({ ...p, precio_final: parseFloat(e.target.value) || 0 }))} /></div>
              <div><label className="label">Ganancia total</label><div className={`input-readonly font-semibold text-lg ${ganancia >= 0 ? 'text-green-600' : 'text-red-600'}`}>{f.precio_final ? (ganancia >= 0 ? '+' : '') + fmt(ganancia) : '—'}</div></div>
            </div>
          </div>

          <div className="flex gap-3 pb-8 flex-wrap">
            <button onClick={() => guardarPre('solo_guardar')} disabled={saving} className="btn bg-gray-700 text-white hover:bg-gray-800 px-6">Guardar</button>
            <button onClick={() => guardarPre('enviar_ya')} disabled={saving} className="btn bg-green-600 text-white hover:bg-green-700 px-6 flex items-center gap-1.5"><Send size={16} /> Guardar y Enviar Ya</button>
            <button onClick={() => guardarPre('programar')} disabled={saving} className="btn bg-amber-500 text-white hover:bg-amber-600 px-6 flex items-center gap-1.5"><Clock size={16} /> Guardar y Programar Envío</button>
            <button onClick={() => setVista('lista')} className="btn">Cancelar</button>
          </div>
        </div>
      )}

      {vista === 'lista' && (
        <div className="p-6 max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3"><FileText size={24} className="text-gray-700" /><h1 className="text-2xl font-bold">Cotizaciones</h1></div>
            <button onClick={nuevaCot} className="btn btn-primary"><Plus size={16} /> Nueva cotización</button>
          </div>
          {cotizaciones.length === 0 ? (
            <div className="text-center py-16 text-gray-400"><FileText size={40} className="mx-auto mb-3 opacity-30" /><div>No hay cotizaciones aún</div></div>
          ) : (
            cotizaciones.map(c => (
              <div key={c.id} className="card mb-3 hover:border-gray-400 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 cursor-pointer" onClick={() => editarCot(c)}>
                    <div className="font-bold text-base">{c.nro} — {c.cliente_nombre || 'Sin cliente'}</div>
                    <div className="text-sm text-gray-500 mt-1">{fmtDate(c.fecha)} · {c.cotizacion_items?.length || 0} ítem(s)</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-lg">{c.precio_final ? fmt(c.precio_final) : <span className="text-gray-400 text-sm font-normal">Pendiente</span>}</div>
                    <div className="flex gap-2 mt-2 justify-end flex-wrap">
                      <button onClick={() => editarCot(c)} className="btn btn-sm text-xs">✏️ Editar</button>
                      <button onClick={() => verPDF(c)} className="btn btn-sm bg-blue-50 text-blue-700 border-blue-200 text-xs flex items-center gap-1"><Eye size={12} /> Ver / Enviar</button>
                      <button onClick={() => convertirAVenta(c)} className="btn btn-sm text-xs">💰 Convertir a Venta</button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}