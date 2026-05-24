'use client'

import { useState, useEffect } from 'react'
import { supabase, fmt, fmtDate, type Cliente } from '@/lib/supabase'

const MULTIPLICADOR = 1.11

export default function CotizacionesPage() {
  const [vista, setVista] = useState<'lista' | 'form'>('lista')
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)

  // Estado del formulario principal
  const [f, setF] = useState({
    nro: '', fecha: '', cliente_id: '', cliente_nombre: '', destino: 'AR', vin: '', precio_final: 0.00
  })

  const [cotItems, setCotItems] = useState<any[]>([])
  const [rawText, setRawText] = useState('')
  const [cliSearch, setCliSearch] = useState('')
  
  // Estado para el panel lateral de detalles del ítem activo
  const [itemActivoIndex, setItemActivoIndex] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: cots } = await supabase
      .from('cotizaciones')
      .select('*, cotizacion_items(*)')
      .order('created_at', { ascending: false })
    const { data: clis } = await supabase.from('clientes').select('*').order('nombre')
    if (cots) setCotizaciones(cots)
    if (clis) setClientes(clis)
    setLoading(false)
  }

  const procesarPegadoMasivo = () => {
    if (!rawText.trim()) return
    const lineas = rawText.split('\n')
    const nuevosItems = lineas
      .map(linea => {
        const columnas = linea.split('\t')
        if (!columnas[0] && !columnas[1]) return null

        const cantidad = columnas[0] === '0' ? 0 : (parseInt(columnas[0]) || 1)
        const codigo = (columnas[1] || '').trim()
        const descripcion = (columnas[2] || '').trim()
        const peso = parseFloat(parseFloat(columnas[3] || '0').toFixed(2)) || 0
        
        const basoli = parseFloat(parseFloat(columnas[4] || '0').toFixed(2)) || 0
        const partzilla = parseFloat(parseFloat(columnas[5] || '0').toFixed(2)) || 0
        const otra = parseFloat(parseFloat(columnas[6] || '0').toFixed(2)) || 0
        const precio_venta = parseFloat(parseFloat(columnas[7] || '0').toFixed(2)) || 0

        let proveedor_elegido = 'basoli'
        if (partzilla > 0 && (basoli === 0 || partzilla < basoli)) proveedor_elegido = 'partzilla'
        if (otra > 0 && (otra < basoli || basoli === 0) && (otra < partzilla || partzilla === 0)) proveedor_elegido = 'otra'

        return { 
          cantidad, codigo, descripcion, peso, basoli, partzilla, otra, precio_venta, proveedor_elegido,
          proveedor_otro_nombre: 'Otra', proveedor_otro_link: '' 
        }
      })
      .filter(Boolean)

    if (nuevosItems.length > 0) {
      const matrizCompleta = [...nuevosItems]
      while (matrizCompleta.length < 30) {
        matrizCompleta.push({ cantidad: 1, codigo: '', descripcion: '', peso: 0.00, basoli: 0.00, partzilla: 0.00, otra: 0.00, precio_venta: 0.00, proveedor_elegido: 'basoli', proveedor_otro_nombre: '', proveedor_otro_link: '' })
      }
      setCotItems(matrizCompleta)
      setRawText('')
    }
  }

  const ordenarPorProveedor = () => {
    const validos = cotItems.filter(item => item.codigo.trim() !== '' || item.descripcion.trim() !== '')
    const vacios = cotItems.filter(item => item.codigo.trim() === '' && item.descripcion.trim() === '')
    const ordenados = validos.sort((a, b) => {
      if (a.cantidad === 0 && b.cantidad !== 0) return 1
      if (a.cantidad !== 0 && b.cantidad === 0) return -1
      return a.proveedor_elegido.localeCompare(b.proveedor_elegido)
    })
    setCotItems([...ordenados, ...vacios])
  }

  const actualizarCeldaItem = (index: number, campo: string, valor: any) => {
    const copia = [...cotItems]
    if (['peso', 'basoli', 'partzilla', 'otra', 'precio_venta'].includes(campo)) {
      copia[index] = { ...copia[index], [campo]: valor === '' ? '' : parseFloat(parseFloat(valor).toFixed(2)) || 0 }
    } else if (campo === 'cantidad') {
      copia[index] = { ...copia[index], [campo]: valor === '' ? 0 : parseInt(valor) }
    } else {
      copia[index] = { ...copia[index], [campo]: valor }
    }
    setCotItems(copia)
  }

  const obtenerCostoConRecargo = (item: any) => {
    let costoBase = 0
    if (item.proveedor_elegido === 'basoli') costoBase = parseFloat(item.basoli) || 0
    if (item.proveedor_elegido === 'partzilla') costoBase = parseFloat(item.partzilla) || 0
    if (item.proveedor_elegido === 'otra') costoBase = parseFloat(item.otra) || 0
    return parseFloat((costoBase * MULTIPLICADOR).toFixed(2))
  }

  const nuevaCot = async () => {
    setEditId(null)
    const { data: cnt } = await supabase.rpc('increment_counter', { counter_key: 'cot' })
    setF({ nro: 'COT-' + String(cnt || 1).padStart(3, '0'), fecha: new Date().toISOString().split('T')[0], cliente_id: '', cliente_nombre: '', destino: 'AR', vin: '', precio_final: 0.00 })
    setCotItems(Array.from({ length: 30 }, () => ({ cantidad: 1, codigo: '', descripcion: '', peso: 0.00, basoli: 0.00, partzilla: 0.00, otra: 0.00, precio_venta: 0.00, proveedor_elegido: 'basoli', proveedor_otro_nombre: '', proveedor_otro_link: '' })))
    setCliSearch('')
    setItemActivoIndex(null)
    setVista('form')
  }

  const editarCot = (cot: any) => {
    setEditId(cot.id)
    setF({ nro: cot.nro, fecha: cot.fecha || '', cliente_id: cot.cliente_id || '', cliente_nombre: cot.cliente_nombre || '', destino: cot.destino || 'AR', vin: cot.vin || '', precio_final: parseFloat(parseFloat(cot.precio_final || '0').toFixed(2)) })
    setCliSearch(cot.cliente_nombre || '')
    
    const itemsCargados = (cot.cotizacion_items || []).map((item: any) => ({
      ...item,
      peso: parseFloat(parseFloat(item.peso || '0').toFixed(2)),
      basoli: parseFloat(parseFloat(item.basoli || '0').toFixed(2)),
      partzilla: parseFloat(parseFloat(item.partzilla || '0').toFixed(2)),
      otra: parseFloat(parseFloat(item.otra || '0').toFixed(2)),
      precio_venta: parseFloat(parseFloat(item.precio_venta || '0').toFixed(2)),
      proveedor_otro_nombre: item.proveedor_otro_nombre || '',
      proveedor_otro_link: item.proveedor_otro_link || ''
    }))

    while (itemsCargados.length < 30) {
      itemsCargados.push({ cantidad: 1, codigo: '', descripcion: '', peso: 0.00, basoli: 0.00, partzilla: 0.00, otra: 0.00, precio_venta: 0.00, proveedor_elegido: 'basoli', proveedor_otro_nombre: '', proveedor_otro_link: '' })
    }
    setCotItems(itemsCargados)
    setItemActivoIndex(null)
    setVista('form')
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    const itemsFiltrados = cotItems.filter(item => item.codigo.trim() !== '' || item.descripcion.trim() !== '')
    if (editId) {
      await supabase.from('cotizaciones').update(f).eq('id', editId)
      await supabase.from('cotizacion_items').delete().eq('cotizacion_id', editId)
      if (itemsFiltrados.length > 0) await supabase.from('cotizacion_items').insert(itemsFiltrados.map(i => ({ ...i, cotizacion_id: editId })))
    } else {
      const { data: nueva } = await supabase.from('cotizaciones').insert([f]).select().single()
      if (nueva && itemsFiltrados.length > 0) await supabase.from('cotizacion_items').insert(itemsFiltrados.map(i => ({ ...i, cotizacion_id: nueva.id })))
    }
    fetchData()
    setVista('lista')
  }

  const itemsActivos = cotItems.filter(i => (i.codigo.trim() !== '' || i.descripcion.trim() !== '') && i.cantidad > 0)
  const itemsPendientes = cotItems.filter(i => (i.codigo.trim() !== '' || i.descripcion.trim() !== '') && i.cantidad === 0)

  const deBasoli = itemsActivos.filter(i => i.proveedor_elegido === 'basoli')
  const dePartzilla = itemsActivos.filter(i => i.proveedor_elegido === 'partzilla')
  const deOtra = itemsActivos.filter(i => i.proveedor_elegido === 'otra')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Cotizaciones Masivas</h1>
        {vista === 'lista' && (
          <button onClick={nuevaCot} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            Nueva Cotización
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : vista === 'lista' ? (
        <div className="space-y-4">
          {cotizaciones.map((cot) => {
            const pends = (cot.cotizacion_items || []).filter((i: any) => i.cantidad === 0 && i.codigo).map((i: any) => i.codigo)
            return (
              <div key={cot.id} className="bg-white rounded-xl shadow p-6 border border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-3">
                      <span className="text-lg font-bold text-blue-600">{cot.nro}</span>
                      <span className="text-sm font-medium text-gray-700">{cot.cliente_nombre || 'Sin cliente'}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Fecha: {fmtDate(cot.fecha)} &bull; {cot.cotizacion_items?.length || 0} ítems</p>
                  </div>
                  <div className="flex space-x-2 text-sm font-semibold">
                    <button onClick={() => editarCot(cot)} className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-md">Editar / Ver Pedidos</button>
                    <button onClick={() => { if(confirm('¿Borrar?')) { supabase.from('cotizaciones').delete().eq('id', cot.id); fetchData(); } }} className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md">Borrar</button>
                  </div>
                </div>
                {pends.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-red-100 text-xs text-red-700 bg-red-50 p-2 rounded">
                    <strong>Pendiente de cotizar:</strong> {pends.join(', ')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Formulario y Matriz Principal */}
          <div className={`${itemActivoIndex !== null ? 'lg:col-span-3' : 'lg:col-span-4'} space-y-6 transition-all`}>
            <form onSubmit={guardar} className="space-y-6 bg-white p-6 rounded-xl shadow">
              {/* Encabezado */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <label className="block text-xs font-bold text-gray-600">Número</label>
                  <input type="text" value={f.nro} readOnly className="w-full mt-1 p-2 bg-gray-200 border rounded" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600">Fecha</label>
                  <input type="date" value={f.fecha} onChange={e => setF({...f, fecha: e.target.value})} className="w-full mt-1 p-2 border rounded" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600">Destino</label>
                  <select value={f.destino} onChange={e => setF({...f, destino: e.target.value})} className="w-full mt-1 p-2 border rounded">
                    <option value="AR">Argentina</option>
                    <option value="USA">Estados Unidos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600">VIN</label>
                  <input type="text" value={f.vin} onChange={e => setF({...f, vin: e.target.value})} className="w-full mt-1 p-2 border rounded" />
                </div>
              </div>

              {/* Caja de Pegado Masivo */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Pegado Masivo desde Excel</label>
                <textarea value={rawText} onChange={e => setRawText(e.target.value)} placeholder="Cant | Código | Descripción | Peso | Básoli | Partzilla | Otra | Venta" className="w-full h-16 p-2 border border-blue-300 rounded font-mono text-xs" />
                <div className="flex space-x-2 mt-2">
                  <button type="button" onClick={procesarPegadoMasivo} className="bg-blue-600 text-white text-xs px-4 py-2 rounded hover:bg-blue-700">Procesar Excel</button>
                  <button type="button" onClick={ordenarPorProveedor} className="bg-gray-700 text-white text-xs px-4 py-2 rounded hover:bg-gray-800 font-bold">🛠️ Ordenar por Proveedor</button>
                </div>
              </div>

              {/* Matriz de Carga */}
              <div className="overflow-x-auto border rounded-lg max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-100 font-bold sticky top-0 z-10">
                    <tr>
                      <th className="p-2 text-center w-12">Cant</th>
                      <th className="p-2 text-left w-36">Código</th>
                      <th className="p-2 text-left">Descripción aprox ℹ️</th>
                      <th className="p-2 text-center w-14">Peso</th>
                      <th className="p-2 text-center w-18">Básoli</th>
                      <th className="p-2 text-center w-18">Partzilla</th>
                      <th className="p-2 text-center w-18">Otro</th>
                      <th className="p-2 text-center w-24">Prov Elegido</th>
                      <th className="p-2 text-center w-24 bg-yellow-100 text-yellow-900 border-x border-yellow-200">Costo * 1.11</th>
                      <th className="p-2 text-center w-24">Venta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {cotItems.map((item, index) => {
                      const costoConRecargo = obtenerCostoConRecargo(item)
                      const esVentaMenor = (item.codigo || item.descripcion) && item.cantidad > 0 && item.precio_venta > 0 && item.precio_venta < costoConRecargo
                      const estaSeleccionado = itemActivoIndex === index

                      return (
                        <tr key={index} className={`hover:bg-gray-50 transition-colors ${item.cantidad === 0 && item.codigo ? 'bg-red-50/60' : ''} ${estaSeleccionado ? 'bg-blue-50/70 border-2 border-blue-400' : ''}`}>
                          <td className="p-1"><input type="number" value={item.cantidad} onChange={e => actualizarCeldaItem(index, 'cantidad', e.target.value)} className="w-full p-1 text-center border rounded font-bold" /></td>
                          <td className="p-1"><input type="text" value={item.codigo} onChange={e => actualizarCeldaItem(index, 'codigo', e.target.value)} className="w-full p-1 border rounded font-mono" /></td>
                          <td className="p-1">
                            <input 
                              type="text" 
                              value={item.descripcion} 
                              onChange={e => actualizarCeldaItem(index, 'descripcion', e.target.value)} 
                              onClick={() => setItemActivoIndex(index)} 
                              className="w-full p-1 border rounded cursor-pointer hover:bg-gray-100 text-left" 
                              placeholder="Ver panel de detalles..."
                            />
                          </td>
                          <td className="p-1"><input type="number" step="0.01" value={item.peso} onChange={e => actualizarCeldaItem(index, 'peso', e.target.value)} className="w-full p-1 text-center border rounded font-medium" /></td>
                          <td className="p-1"><input type="number" step="0.01" value={item.basoli} onChange={e => actualizarCeldaItem(index, 'basoli', e.target.value)} className="w-full p-1 text-center border rounded bg-gray-50" /></td>
                          <td className="p-1"><input type="number" step="0.01" value={item.partzilla} onChange={e => actualizarCeldaItem(index, 'partzilla', e.target.value)} className="w-full p-1 text-center border rounded bg-gray-50" /></td>
                          <td className="p-1">
                            <input 
                              type="number" 
                              step="0.01" 
                              value={item.otra} 
                              onChange={e => actualizarCeldaItem(index, 'otra', e.target.value)} 
                              onClick={() => setItemActivoIndex(index)}
                              className="w-full p-1 text-center border rounded bg-purple-50 hover:bg-purple-100 cursor-pointer font-medium text-purple-800" 
                              title="Click para ver/editar el proveedor externo"
                            />
                          </td>
                          <td className="p-1">
                            <select value={item.proveedor_elegido} onChange={e => actualizarCeldaItem(index, 'proveedor_elegido', e.target.value)} className="w-full p-1 border rounded bg-blue-50 font-bold text-center">
                              <option value="basoli">Básoli</option>
                              <option value="partzilla">Partzilla</option>
                              <option value="otra">Otra</option>
                            </select>
                          </td>
                          <td className="p-1 bg-yellow-50 border-x border-yellow-100 text-center font-bold text-gray-700">
                            {costoConRecargo > 0 ? `$${costoConRecargo.toFixed(2)}` : '$0.00'}
                          </td>
                          <td className="p-1">
                            <input type="number" step="0.01" value={item.precio_venta} onChange={e => actualizarCeldaItem(index, 'precio_venta', e.target.value)} className={`w-full p-1 text-center border rounded font-bold ${esVentaMenor ? 'bg-red-600 text-white border-red-700 animate-pulse' : 'bg-green-50 text-green-700 border-green-200'}`} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button type="button" onClick={() => setVista('lista')} className="px-4 py-2 border rounded-lg text-sm">Volver</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold">Guardar Cambios</button>
              </div>
            </form>

            {/* Listas por Proveedor */}
            <div className="bg-white p-6 rounded-xl shadow space-y-6">
              <h2 className="text-lg font-bold text-gray-800 border-b pb-2 flex items-center justify-between">
                <span>📋 Hojas de Pedido Separadas</span>
                <button onClick={() => window.print()} className="bg-gray-200 text-gray-800 text-xs px-3 py-1.5 rounded hover:bg-gray-300 font-bold">🖨️ Imprimir / Guardar PDF</button>
              </h2>

              {deBasoli.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                  <h3 className="font-bold text-gray-800 text-sm uppercase mb-2 border-b pb-1">Pedido Directo: BÁSOLI</h3>
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-gray-500 border-b"><th className="py-1 w-12 text-center">Cant</th><th className="py-1 w-40">Código</th><th className="py-1">Descripción aprox</th><th className="py-1 text-right w-24">Costo * 1.11</th></tr>
                    </thead>
                    <tbody>
                      {deBasoli.map((i, idx) => (
                        <tr key={idx} className="border-b border-gray-100"><td className="py-1 text-center font-bold">{i.cantidad}</td><td className="py-1 font-mono">{i.codigo}</td><td className="py-1 text-gray-600">{i.descripcion}</td><td className="py-1 text-right font-bold">${(parseFloat(i.basoli) * MULTIPLICADOR).toFixed(2)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {dePartzilla.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                  <h3 className="font-bold text-gray-800 text-sm uppercase mb-2 border-b pb-1">Pedido: PARTZILLA</h3>
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-gray-500 border-b"><th className="py-1 w-12 text-center">Cant</th><th className="py-1 w-40">Código</th><th className="py-1">Descripción aprox</th><th className="py-1 text-right w-24">Costo * 1.11</th></tr>
                    </thead>
                    <tbody>
                      {dePartzilla.map((i, idx) => (
                        <tr key={idx} className="border-b border-gray-100"><td className="py-1 text-center font-bold">{i.cantidad}</td><td className="py-1 font-mono">{i.codigo}</td><td className="py-1 text-gray-600">{i.descripcion}</td><td className="py-1 text-right font-bold">${(parseFloat(i.partzilla) * MULTIPLICADOR).toFixed(2)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {deOtra.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                  <h3 className="font-bold text-purple-800 text-sm uppercase mb-2 border-b pb-1">Pedidos a Otros Proveedores Externos</h3>
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-gray-500 border-b">
                        <th className="py-1 w-12 text-center">Cant</th>
                        <th className="py-1 w-32">Proveedor</th>
                        <th className="py-1 w-36">Código</th>
                        <th className="py-1">Descripción aprox</th>
                        <th className="py-1 text-right w-24">Costo * 1.11</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deOtra.map((i, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="py-1 text-center font-bold">{i.cantidad}</td>
                          <td className="py-1 font-semibold text-purple-700 uppercase">
                            {i.proveedor_otro_link ? (
                              <a href={i.proveedor_otro_link} target="_blank" rel="noreferrer" className="underline hover:text-purple-900">{i.proveedor_otro_nombre || 'Ebay/Web'} 🔗</a>
                            ) : (
                              i.proveedor_otro_nombre || 'Web Externa'
                            )}
                          </td>
                          <td className="py-1 font-mono">{i.codigo}</td>
                          <td className="py-1 text-gray-600">{i.descripcion}</td>
                          <td className="py-1 text-right font-bold">${(parseFloat(i.otra) * MULTIPLICADOR).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* PANEL LATERAL DINÁMICO (Aparece al tocar una fila) */}
          {itemActivoIndex !== null && (
            <div className="bg-white p-4 rounded-xl shadow border border-gray-200 space-y-4 lg:col-span-1 sticky top-6">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-bold text-sm text-blue-700">⚙️ Detalles Línea #{itemActivoIndex + 1}</h3>
                <button type="button" onClick={() => setItemActivoIndex(null)} className="text-gray-400 hover:text-gray-600 text-sm font-bold">✖ Cerrar</button>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400">Repuesto Seleccionado</span>
                <p className="font-mono text-xs font-bold text-gray-800 truncate">{cotItems[itemActivoIndex]?.codigo || 'Sin Código'}</p>
                <p className="text-xs text-gray-500 italic mt-0.5">{cotItems[itemActivoIndex]?.descripcion || 'Sin descripción'}</p>
              </div>

              {/* Ajuste manual de peso para el cálculo final */}
              <div className="bg-gray-50 p-2.5 rounded border">
                <label className="block text-xs font-bold text-gray-700">Peso del Artículo (kg)</label>
                <input 
                  type="number" step="0.01" 
                  value={cotItems[itemActivoIndex]?.peso} 
                  onChange={e => actualizarCeldaItem(itemActivoIndex, 'peso', e.target.value)} 
                  className="w-full mt-1 p-1.5 border rounded text-xs font-bold bg-white text-center"
                />
              </div>

              {/* Ajustes específicos de Proveedor Externo */}
              <div className="bg-purple-50/50 p-3 rounded-lg border border-purple-100 space-y-3">
                <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">Identificación de Proveedor</h4>
                
                <div>
                  <label className="block text-[11px] font-medium text-purple-700">¿Qué Proveedor es? (Ej: CMSNL, Ebay)</label>
                  <input 
                    type="text" 
                    value={cotItems[itemActivoIndex]?.proveedor_otro_nombre || ''} 
                    onChange={e => actualizarCeldaItem(itemActivoIndex, 'proveedor_otro_nombre', e.target.value)} 
                    placeholder="Escribí el nombre..."
                    className="w-full mt-1 p-1.5 border rounded text-xs bg-white uppercase font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-purple-700">Link Web de Referencia</label>
                  <input 
                    type="url" 
                    value={cotItems[itemActivoIndex]?.proveedor_otro_link || ''} 
                    onChange={e => actualizarCeldaItem(itemActivoIndex, 'proveedor_otro_link', e.target.value)} 
                    placeholder="https://..."
                    className="w-full mt-1 p-1.5 border rounded text-xs bg-white font-mono text-blue-600 underline"
                  />
                </div>

                {cotItems[itemActivoIndex]?.proveedor_otro_link && (
                  <a 
                    href={cotItems[itemActivoIndex].proveedor_otro_link} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="block text-center bg-purple-600 text-white rounded p-1.5 text-xs font-bold hover:bg-purple-700 transition"
                  >
                    🌐 Ir a la Web para revisar Peso
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
