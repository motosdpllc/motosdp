'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase, fmt, fmtDate, type Cliente } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { FileText, Plus, X, Eye, Send, Clock, CheckSquare, Square, CheckCircle, Circle, Clipboard } from 'lucide-react'

const COSTO_ENVIO_KG = 50 

export default function CotizacionesPage() {
  const [vista, setVista] = useState<'lista' | 'form' | 'pdf'>('lista')
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [currentCot, setCurrentCot] = useState<any>(null)
  const [cliSearch, setCliSearch] = useState('')
  const [showCliDrop, setShowCliDrop] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const cliDropRef = useRef<HTMLDivElement>(null)

  // Caja de texto para pegar masivo desde Excel
  const [bulkInput, setBulkInput] = useState('')

  // Estructura de la Matriz optimizada para carga masiva rápida
  const [cotItems, setCotItems] = useState<any[]>([
    { cantidad: 1, codigo: '', descripcion: '', peso: 0, basoli: 0, partzilla: 0, otra: 0, precio_venta: 0, proveedor_elegido: 'basoli' }
  ])

  const [visibilidad, setVisibilidad] = useState({
    mostrarLink: false,
    mostrarImagen: false,
    mostrarPrecioUnitario: true,
    mostrarPeso: true
  })

  const [showModalProgramar, setShowModalProgramar] = useState(false)
  const [fechaEnvio, setFechaEnvio] = useState('')
  const [horaEnvio, setHoraEnvio] = useState('')
  const [mensajePersonalizado, setMensajePersonalizado] = useState('')

  const [f, setF] = useState({
    nro: '', fecha: new Date().toISOString().split('T')[0],
    cliente_id: '', cliente_nombre: '', destino: 'AR', vin: '',
    precio_final: 0
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

  // FUNCIÓN MATEMÁTICA: Procesa los costos de la fila, elige el menor y aplica coeficientes logísticos
  const calcularFila = (item: any) => {
    const precios = []
    if (item.basoli > 0) precios.push({ tipo: 'basoli', valor: item.basoli })
    if (item.partzilla > 0) precios.push({ tipo: 'partzilla', valor: item.partzilla })
    if (item.otra > 0) precios.push({ tipo: 'otra', valor: item.otra })

    let menorCosto = 0
    let provSugerido = item.proveedor_elegido || 'basoli'

    if (precios.length > 0) {
      const ordenados = precios.sort((a, b) => a.valor - b.valor)
      menorCosto = ordenados[0].valor
      // Si el usuario no forzó uno manualmente, sugerimos el más barato
      if (!item.manual_prov) {
        provSugerido = ordenados[0].tipo
      }
    }

    // Coeficientes lógicos (Multiplicador logístico + flete peso)
    const taxes11 = menorCosto * 0.11
    const costoEnvio = (item.peso || 0) * COSTO_ENVIO_KG
    const costoFinalCalculado = (menorCosto + taxes11 + costoEnvio) * (item.cantidad || 1)
    
    // Si no tiene precio de venta asignado a mano, sugerimos un estimado con margen base (ej: 35%)
    const precioVentaSugerido = item.precio_venta > 0 ? item.precio_venta : costoFinalCalculado * 1.35

    return {
      ...item,
      costo: menorCosto,
      proveedor_elegido: provSugerido,
      subtotal: costoFinalCalculado,
      precio_venta: precioVentaSugerido
    }
  }

  // PROCESADOR DE PEGADO MASIVO DESDE EXCEL
  const handleBulkPaste = () => {
    if (!bulkInput.trim()) {
      toast.error('Pegá filas de Excel válidas primero')
      return
    }

    const lineas = bulkInput.split('\n')
    const nuevosItems = lineas.map(linea => {
      const c = linea.split('\t') // Separación por tabulador nativo de Excel
      if (c.length < 2) return null

      return calcularFila({
        cantidad: parseInt(c[0]) || 1,
        codigo: c[1]?.trim() || '',
        descripcion: c[2]?.trim() || 'Repuesto',
        peso: parseFloat(c[3]?.replace(',', '.')) || 0,
        precio_venta: parseFloat(c[4]?.replace(/[^0-9.]/g, '')) || 0,
        basoli: 0,
        partzilla: 0,
        otra: 0,
        manual_prov: false
      })
    }).filter(Boolean)

    if (nuevosItems.length > 0) {
      setCotItems(nuevosItems)
      setBulkInput('')
      toast.success(`Se cargaron ${nuevosItems.length} repuestos a la matriz`)
    } else {
      toast.error('Formato no reconocido. Asegurate de copiar las columnas de tu Excel.')
    }
  }

  const updateMatrizField = (index: number, field: string, value: any) => {
    const updated = [...cotItems]
    updated[index][field] = value
    
    if (field === 'proveedor_elegido') {
      updated[index]['manual_prov'] = true
    }

    updated[index] = calcularFila(updated[index])
    setCotItems(updated)
  }

  const totalCosto = cotItems.reduce((a, x) => a + (x.subtotal || 0), 0)
  const totalVentaSugerido = cotItems.reduce((a, x) => a + (x.precio_venta || 0), 0)

  const nuevaCot = async () => {
    setEditId(null)
    const { data: cnt } = await supabase.rpc('increment_counter', { counter_key: 'cot' })
    setF({
      nro: 'COT-' + String(cnt || 1).padStart(3, '0'),
      fecha: new Date().toISOString().split('T')[0],
      cliente_id: '', cliente_nombre: '', destino: 'AR', vin: ''
    })
    setCotItems([{ cantidad: 1, codigo: '', descripcion: '', peso: 0, basoli: 0, partzilla: 0, otra: 0, precio_venta: 0, proveedor_elegido: 'basoli' }])
    setCliSearch('')
    setVista('form')
  }

  const editarCot = (cot: any) => {
    setEditId(cot.id)
    setF({
      nro: cot.nro, fecha: cot.fecha || '',
      cliente_id: cot.cliente_id || '', cliente_nombre: cot.cliente_nombre || '',
      destino: cot.destino || 'AR', vin: cot.vin || ''
    })
    setCliSearch(cot.cliente_nombre || '')
    setCotItems(cot.cotizacion_items || [])
    setVista('form')
  }

  const ejecutarEnvioWhatsApp = (cotData: any) => {
    const cl = clientes.find(c => c.id === cotData.cliente_id)
    const telefono = cl?.telefono ? cl.telefono.replace(/[^0-9]/g, '') : ''
    let texto = `Hola ${cotData.cliente_nombre || ''}, te adjunto la cotización ${cotData.nro}.`
    if (mensajePersonalizado.trim()) texto += `\n\n${mensajePersonalizado.trim()}`
    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`
    window.open(url, '_blank')
  }

  const guardarPre = async (tipoEnvio: 'solo_guardar' | 'enviar_ya' | 'programar') => {
    if (!cotItems[0].descripcion && !cotItems[0].codigo) { toast.error('La matriz está vacía'); return }
    if (tipoEnvio === 'programar') {
      setFechaEnvio(new Date().toISOString().split('T')[0])
      setHoraEnvio('09:00')
      setShowModalProgramar(true)
    } else {
      await procesarGuardar(tipoEnvio)
    }
  }

  const procesarGuardar = async (tipoEnvio: 'solo_guardar' | 'enviar_ya' | 'programar', dataProgramacion?: { fecha: string, hora: string }) => {
    setSaving(true)
    const timestampProgramado = dataProgramacion ? `${dataProgramacion.fecha}T${dataProgramacion.hora}:00` : null

    const payload: any = {
      nro: f.nro, fecha: f.fecha,
      cliente_id: f.cliente_id || null, cliente_nombre: f.cliente_nombre || null,
      destino: f.destino || null, vin: f.vin || null,
      precio_final: totalVentaSugerido, updated_at: new Date().toISOString(),
      enviar_automatico: tipoEnvio === 'programar',
      fecha_envio_programado: timestampProgramado,
      mensaje_whatsapp: mensajePersonalizado.trim() || null
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
      const itemsPayload = cotItems.map((it, idx) => ({
        cotizacion_id: cotId,
        orden: idx,
        cantidad: it.cantidad,
        codigo: it.codigo,
        descripcion: it.descripcion,
        peso_estimado: it.peso,
        costo: it.costo || 0,
        subtotal: it.subtotal || 0,
        precio_venta: it.precio_venta || 0,
        ubicacion_producto: it.proveedor_elegido
      }))
      await supabase.from('cotizacion_items').insert(itemsPayload)
    }

    setSaving(false)
    loadAll()
    
    if (tipoEnvio === 'enviar_ya') {
      ejecutarEnvioWhatsApp(payload)
      toast.success('✓ Guardado y WhatsApp abierto')
    } else {
      toast.success('✓ Cotización procesada exitosamente')
    }
    setVista('lista')
  }

  const handleModalConfirm = async () => {
    setShowModalProgramar(false)
    await procesarGuardar('programar', { fecha: fechaEnvio, hora: horaEnvio })
  }

  return (
    <div className="relative p-4">
      {/* MODAL PROGRAMAR */}
      {showModalProgramar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 max-w-md w-full shadow-xl">
            <div className="text-base font-bold mb-2 flex items-center gap-2 text-amber-600"><Clock size={18} /> Programar Envío</div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha de envío</label>
                <input type="date" className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50" value={fechaEnvio} onChange={e => setFechaEnvio(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Hora</label>
                <input type="time" className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50" value={horaEnvio} onChange={e => setHoraEnvio(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowModalProgramar(false)} className="px-3 py-1.5 text-xs text-gray-600">Cancelar</button>
              <button onClick={handleModalConfirm} className="bg-amber-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* VISTA LISTA GENERAL */}
      {vista === 'lista' && (
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Panel de Cotizaciones</h1>
              <p className="text-xs text-gray-500">Historial de presupuestos cruzados a clientes</p>
            </div>
            <button onClick={nuevaCot} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-sm hover:bg-blue-700">
              <Plus size={16} /> Nueva Cotización Masiva
            </button>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 text-xs font-bold uppercase">
                  <th className="p-4">Nro</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4 text-right">Total Venta</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700">
                {cotizaciones.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 font-mono font-bold text-blue-600">{c.nro}</td>
                    <td className="p-4 text-xs">{fmtDate(c.fecha)}</td>
                    <td className="p-4 font-medium">{c.cliente_nombre || '—'}</td>
                    <td className="p-4 text-right font-bold text-gray-900">{fmt(c.precio_final)}</td>
                    <td className="p-4 flex justify-center gap-2">
                      <button onClick={() => { setCurrentCot(c); setVista('pdf') }} className="p-1 text-gray-400 hover:text-blue-600" title="Ver PDF"><FileText size={16} /></button>
                      <button onClick={() => editarCot(c)} className="p-1 text-gray-400 hover:text-gray-600" title="Editar"><Eye size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA FORMULARIO MATRIZ MASIVA */}
      {vista === 'form' && (
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900">{editId ? `Modificando ${f.nro}` : 'Nueva Matriz de Cotización'}</h1>
            <button onClick={() => setVista('lista')} className="text-sm font-medium text-gray-500 hover:text-gray-700">← Cancelar y salir</button>
          </div>

          {/* DATOS GENERALES */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative" ref={cliDropRef}>
              <label className="block text-xs font-bold text-gray-500 mb-1">Cliente</label>
              <input className="w-full border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Buscar cliente por nombre..." value={cliSearch} onChange={e => { setCliSearch(e.target.value); setShowCliDrop(true); if (!e.target.value) setF(p => ({ ...p, cliente_id: '', cliente_nombre: '' })) }} />
              {showCliDrop && filtCli.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1 max-h-48 overflow-y-auto">
                  {filtCli.map(c => (
                    <div key={c.id} className="p-2 hover:bg-gray-50 cursor-pointer text-xs" onMouseDown={() => { setF(p => ({ ...p, cliente_id: c.id, cliente_nombre: c.nombre })); setCliSearch(c.nombre); setShowCliDrop(false) }}>
                      <div className="font-bold">{c.nombre}</div>
                      <div className="text-gray-400">{c.telefono}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Fecha</label>
              <input type="date" className="w-full border border-gray-200 rounded-xl p-2 text-sm" value={f.fecha} onChange={e => setF(p => ({ ...p, fecha: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Número de Cotización</label>
              <input className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-sm font-mono font-bold text-gray-400" readOnly value={f.nro} />
            </div>
          </div>

          {/* BLOQUE DE PEGADO MASIVO DE EXCEL */}
          <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
              <Clipboard size={16} /> Sección Importador Rápido desde Excel
            </div>
            <p className="text-xs text-amber-700">Copió las columnas de tu Excel <span className="font-mono bg-white px-1 border border-amber-200 rounded">(CANTIDAD | CÓDIGO | DESCRIPCIÓN | PESO | PRECIO VENTA)</span> y pegalas en este cuadro de texto:</p>
            <div className="flex gap-2">
              <textarea className="flex-1 p-2 text-xs border border-amber-200 rounded-xl bg-white font-mono focus:outline-none focus:border-amber-500 resize-none" rows={2} placeholder="Pegá acá las filas de tu planilla..." value={bulkInput} onChange={e => setBulkInput(e.target.value)} />
              <button type="button" onClick={handleBulkPaste} className="bg-amber-600 hover:bg-amber-700 text-white px-4 rounded-xl text-xs font-bold flex items-center gap-1">Procesar Lista</button>
            </div>
          </div>

          {/* MATRIZ DE COMPARACIÓN DE PROVEEDORES */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Cuadro Comparativo Multiprovedor (30+ items)</span>
              <span className="text-[11px] text-gray-400 font-normal">Tildá el círculo en el proveedor que vayas a comprar físicamente para fijar el costo</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                    <th className="p-2 w-12 text-center">Cant</th>
                    <th className="p-2 w-36">Código</th>
                    <th className="p-2 w-56">Descripción</th>
                    <th className="p-2 w-16 text-right">Peso kg</th>
                    <th className="p-2 bg-blue-50/50 text-blue-800 text-center border-x border-gray-200">Basoli (€)</th>
                    <th className="p-2 bg-orange-50/50 text-orange-800 text-center border-r border-gray-200">Partzilla ($)</th>
                    <th className="p-2 bg-purple-50/50 text-purple-800 text-center border-r border-gray-200">Otra (Ebay/etc)</th>
                    <th className="p-2 text-center">Prov Elegido</th>
                    <th className="p-2 text-right">Costo Total</th>
                    <th className="p-2 text-right bg-green-50/30 text-green-900 w-28">P. Venta Cli</th>
                    <th className="p-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cotItems.map((it, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                      <td className="p-1">
                        <input type="number" className="w-full p-1 border border-gray-200 rounded text-center font-bold" value={it.cantidad || 1} onChange={e => updateMatrizField(idx, 'cantidad', parseInt(e.target.value) || 1)} />
                      </td>
                      <td className="p-1">
                        <input className="w-full p-1 border border-gray-200 rounded font-mono font-semibold" placeholder="92015-1700" value={it.codigo || ''} onChange={e => updateMatrizField(idx, 'codigo', e.target.value)} />
                      </td>
                      <td className="p-1">
                        <input className="w-full p-1 border border-gray-200 rounded" placeholder="Tuerca / Collar / Piñón" value={it.descripcion || ''} onChange={e => updateMatrizField(idx, 'descripcion', e.target.value)} />
                      </td>
                      <td className="p-1">
                        <input type="number" step="0.01" className="w-full p-1 border border-gray-200 rounded text-right" placeholder="0.00" value={it.peso || ''} onChange={e => updateMatrizField(idx, 'peso', parseFloat(e.target.value) || 0)} />
                      </td>
                      
                      {/* COLUMNA BASOLI */}
                      <td className="p-1 bg-blue-50/20 border-x border-gray-100">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => updateMatrizField(idx, 'proveedor_elegido', 'basoli')} className="text-blue-600">
                            {it.proveedor_elegido === 'basoli' ? <CheckCircle size={14} /> : <Circle size={14} className="text-gray-300" />}
                          </button>
                          <input type="number" step="0.01" className="w-full p-0.5 bg-transparent border-b border-gray-200 text-right font-medium text-blue-900" placeholder="0.00" value={it.basoli || ''} onChange={e => updateMatrizField(idx, 'basoli', parseFloat(e.target.value) || 0)} />
                        </div>
                      </td>

                      {/* COLUMNA PARTZILLA */}
                      <td className="p-1 bg-orange-50/20 border-r border-gray-100">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => updateMatrizField(idx, 'proveedor_elegido', 'partzilla')} className="text-orange-600">
                            {it.proveedor_elegido === 'partzilla' ? <CheckCircle size={14} /> : <Circle size={14} className="text-gray-300" />}
                          </button>
                          <input type="number" step="0.01" className="w-full p-0.5 bg-transparent border-b border-gray-200 text-right font-medium text-orange-900" placeholder="0.00" value={it.partzilla || ''} onChange={e => updateMatrizField(idx, 'partzilla', parseFloat(e.target.value) || 0)} />
                        </div>
                      </td>

                      {/* COLUMNA OTRA */}
                      <td className="p-1 bg-purple-50/20 border-r border-gray-100">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => updateMatrizField(idx, 'proveedor_elegido', 'otra')} className="text-purple-600">
                            {it.proveedor_elegido === 'otra' ? <CheckCircle size={14} /> : <Circle size={14} className="text-gray-300" />}
                          </button>
                          <input type="number" step="0.01" className="w-full p-0.5 bg-transparent border-b border-gray-200 text-right font-medium text-purple-900" placeholder="0.00" value={it.otra || ''} onChange={e => updateMatrizField(idx, 'otra', parseFloat(e.target.value) || 0)} />
                        </div>
                      </td>

                      {/* SELECCIÓN ACTUAL VISTA CONTABLE */}
                      <td className="p-1 text-center font-bold uppercase text-[9px]">
                        <span className={`px-1.5 py-0.5 rounded-full ${it.proveedor_elegido === 'basoli' ? 'bg-blue-100 text-blue-800' : it.proveedor_elegido === 'partzilla' ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800'}`}>
                          {it.proveedor_elegido}
                        </span>
                      </td>

                      <td className="p-1 text-right font-mono text-gray-500 font-medium">
                        {fmt(it.subtotal)}
                      </td>

                      {/* PRECIO DE VENTA FINAL PARA EL CLIENTE */}
                      <td className="p-1 bg-green-50/20">
                        <input type="number" step="0.01" className="w-full p-1 border border-green-200 bg-white font-bold text-right text-green-700 rounded focus:outline-none focus:border-green-500" value={it.precio_venta || ''} onChange={e => updateMatrizField(idx, 'precio_venta', parseFloat(e.target.value) || 0)} />
                      </td>

                      <td className="p-1 text-center">
                        <button type="button" onClick={() => setCotItems(cotItems.filter((_, iIdx) => iIdx !== idx))} disabled={cotItems.length <= 1} className="text-gray-300 hover:text-red-500 disabled:opacity-20"><X size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <button type="button" onClick={() => setCotItems([...cotItems, { cantidad: 1, codigo: '', descripcion: '', peso: 0, basoli: 0, partzilla: 0, otra: 0, precio_venta: 0, proveedor_elegido: 'basoli' }])} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={14} /> Añadir fila manual</button>
              <div className="text-right text-sm space-y-1">
                <div className="text-gray-500 text-xs">Costo Total Logístico: <span className="font-mono font-bold text-gray-700">{fmt(totalCosto)}</span></div>
                <div className="text-base font-black text-gray-900">Suma Final Presupuesto: <span className="text-green-600">{fmt(totalVentaSugerido)} USD</span></div>
              </div>
            </div>
          </div>

          {/* ACCIONES DE GUARDADO */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <button onClick={() => guardarPre('solo_guardar')} disabled={saving} className="px-4 py-2 border bg-white border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-100">Solo Guardar en Sistema</button>
            <button onClick={() => guardarPre('programar')} disabled={saving} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"><Clock size={14} /> Programar Envío</button>
            <button onClick={() => guardarPre('enviar_ya')} disabled={saving} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"><Send size={14} /> Confirmar y Abrir WhatsApp</button>
          </div>
        </div>
      )}

      {/* VISTA CONTENEDOR PDF IMPRIMIBLE */}
      {vista === 'pdf' && currentCot && (
        <div className="p-4 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 bg-gray-50 p-4 rounded-xl border border-gray-200 h-fit no-print space-y-4">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">Opciones Visuales</div>
            <div className="space-y-2">
              <button onClick={() => setVisibilidad(p => ({ ...p, mostrarPrecioUnitario: !p.mostrarPrecioUnitario }))} className="flex items-center gap-2 text-xs text-gray-600">
                {visibilidad.mostrarPrecioUnitario ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} />} Detalle de Precios
              </button>
              <button onClick={() => setVisibilidad(p => ({ ...p, mostrarPeso: !p.mostrarPeso }))} className="flex items-center gap-2 text-xs text-gray-600">
                {visibilidad.mostrarPeso ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} />} Peso en Impresión
              </button>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Nota para WhatsApp:</label>
              <textarea className="w-full p-2 text-xs border border-gray-300 rounded-lg bg-white resize-none" rows={3} placeholder="Ej: Quedo a la espera de la confirmación..." value={mensajePersonalizado} onChange={e => setMensajePersonalizado(e.target.value)} />
            </div>
            <button onClick={() => ejecutarEnvioWhatsApp(currentCot)} className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-xs font-bold flex justify-center items-center gap-1"><Send size={14} /> Enviar WhatsApp Ya</button>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="flex justify-between items-center no-print">
              <button onClick={() => setVista('lista')} className="px-4 py-2 border rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50">← Volver al Panel</button>
              <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm">🖨️ Generar PDF Comercial</button>
            </div>
            
            {/* HOJA EN BLANCO COMERCIAL */}
            <div id="pdf-content" className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-gray-900" style={{ fontFamily: 'system-ui, sans-serif' }}>
              <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-6">
                <div>
                  {logoUrl ? <img src={logoUrl} alt="Logo" className="h-12 object-contain" /> : <div className="text-lg font-black tracking-tight">🏍️ MOTOS DP LLC</div>}
                </div>
                <div className="text-right text-xs">
                  <div className="font-mono font-bold text-sm text-blue-600">{currentCot.nro}</div>
                  <div className="text-gray-400">{fmtDate(currentCot.fecha)}</div>
                </div>
              </div>
              <div className="mb-6">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">Presupuesto para</span>
                <div className="text-base font-bold text-gray-800">{currentCot.cliente_nombre || '—'}</div>
              </div>
              <table className="w-full text-left text-xs mb-6">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-200">
                    <th className="p-2 w-10 text-center">Cant</th>
                    <th className="p-2 w-32">Código</th>
                    <th className="p-2">Descripción del Repuesto</th>
                    {visibilidad.mostrarPeso && <th className="p-2 text-right w-20">Peso Total</th>
                    }<th className="p-2 text-right w-24">Precio Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(currentCot.cotizacion_items || []).map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2 text-center font-bold text-gray-600">{it.cantidad || 1}</td>
                      <td className="p-2 font-mono text-gray-500 font-medium">{it.codigo || '—'}</td>
                      <td className="p-2 font-medium text-gray-800">{it.descripcion || '—'}</td>
                      {visibilidad.mostrarPeso && <td className="p-2 text-right text-gray-400">{(it.peso_estimado ? it.peso_estimado * (it.cantidad || 1) : 0).toFixed(2)} kg</td>}
                      <td className="p-2 text-right font-bold text-gray-900">{visibilidad.mostrarPrecioUnitario ? fmt(it.precio_venta) : 'Incluido'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-right border-t border-gray-200 pt-4">
                <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">Monto Neto Final</div>
                <div className="text-xl font-black text-green-600 font-mono">{fmt(currentCot.precio_final)} USD</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}