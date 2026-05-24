'use client'

import { useState, useEffect } from 'react'
import { supabase, fmt, fmtDate, type Cliente } from '@/lib/supabase'

export default function CotizacionesPage() {
  const [vista, setVista] = useState<'lista' | 'form'>('lista')
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)

  // Estado del formulario principal
  const [f, setF] = useState({
    nro: '',
    fecha: '',
    cliente_id: '',
    cliente_nombre: '',
    destino: 'AR',
    vin: '',
    precio_final: 0.00
  })

  // Estado de los ítems de la cotización (Matriz Masiva de 30 líneas)
  const [cotItems, setCotItems] = useState<any[]>([])
  const [rawText, setRawText] = useState('')
  const [cliSearch, setCliSearch] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: cots } = await supabase
      .from('cotizaciones')
      .select('*, cotizacion_items(*)')
      .order('created_at', { ascending: false })
    
    const { data: clis } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre')

    if (cots) setCotizaciones(cots)
    if (clis) setClientes(clis)
    setLoading(false)
  }

  // Procesador del pegado masivo aplicando el 1.11 directo en la celda de Partzilla
  const procesarPegadoMasivo = () => {
    if (!rawText.trim()) return
    const lineas = rawText.split('\n')
    const nuevosItems = lineas
      .map(linea => {
        const columnas = linea.split('\t')
        if (!columnas[0] && !columnas[1]) return null

        const cantidad = parseInt(columnas[0]) || 1
        const codigo = (columnas[1] || '').trim()
        const descripcion = (columnas[2] || '').trim()
        
        const peso = parseFloat(parseFloat(columnas[3] || '0').toFixed(2)) || 0
        const basoli = parseFloat(parseFloat(columnas[4] || '0').toFixed(2)) || 0
        
        // Leemos el valor original de Partzilla y le cargamos el 11% directo para guardarlo e imprimirlo en la celda
        const partzillaOriginal = parseFloat(columnas[5] || '0')
        const partzilla = partzillaOriginal > 0 ? parseFloat((partzillaOriginal * 1.11).toFixed(2)) : 0.00

        const otra = parseFloat(parseFloat(columnas[6] || '0').toFixed(2)) || 0
        const precio_venta = parseFloat(parseFloat(columnas[7] || '0').toFixed(2)) || 0

        let proveedor_elegido = 'basoli'
        if (partzilla > 0 && (basoli === 0 || partzilla < basoli)) {
          proveedor_elegido = 'partzilla'
        }
        if (otra > 0 && (otra < basoli || basoli === 0) && (otra < partzilla || partzilla === 0)) {
          proveedor_elegido = 'otra'
        }

        return { cantidad, codigo, descripcion, peso, basoli, partzilla, otra, precio_venta, proveedor_elegido }
      })
      .filter(Boolean)

    if (nuevosItems.length > 0) {
      const matrizCompleta = [...nuevosItems]
      while (matrizCompleta.length < 30) {
        matrizCompleta.push({ cantidad: 1, codigo: '', descripcion: '', peso: 0.00, basoli: 0.00, partzilla: 0.00, otra: 0.00, precio_venta: 0.00, proveedor_elegido: 'basoli' })
      }
      setCotItems(matrizCompleta)
      setRawText('')
    }
  }

  const actualizarCeldaItem = (index: number, campo: string, valor: any) => {
    const copia = [...cotItems]
    if (['peso', 'basoli', 'partzilla', 'otra', 'precio_venta'].includes(campo)) {
      copia[index] = { ...copia[index], [campo]: valor === '' ? '' : parseFloat(parseFloat(valor).toFixed(2)) || 0 }
    } else {
      copia[index] = { ...copia[index], [campo]: valor }
    }
    setCotItems(copia)
  }

  const nuevaCot = async () => {
    setEditId(null)
    const { data: cnt } = await supabase.rpc('increment_counter', { counter_key: 'cot' })
    setF({
      nro: 'COT-' + String(cnt || 1).padStart(3, '0'),
      fecha: new Date().toISOString().split('T')[0],
      cliente_id: '', 
      cliente_nombre: '', 
      destino: 'AR', 
      vin: '',
      precio_final: 0.00
    })
    
    const matrizInicial = Array.from({ length: 30 }, () => ({
      cantidad: 1, codigo: '', descripcion: '', peso: 0.00, basoli: 0.00, partzilla: 0.00, otra: 0.00, precio_venta: 0.00, proveedor_elegido: 'basoli'
    }))
    setCotItems(matrizInicial)
    setCliSearch('')
    setVista('form')
  }

  const editarCot = (cot: any) => {
    setEditId(cot.id)
    setF({
      nro: cot.nro, 
      fecha: cot.fecha || '',
      cliente_id: cot.cliente_id || '', 
      cliente_nombre: cot.cliente_nombre || '',
      destino: cot.destino || 'AR', 
      vin: cot.vin || '',
      precio_final: parseFloat(parseFloat(cot.precio_final || '0').toFixed(2))
    })
    setCliSearch(cot.cliente_nombre || '')
    
    const itemsCargados = cot.cotizacion_items || []
    const matrizCompleta = itemsCargados.map((item: any) => ({
      ...item,
      peso: parseFloat(parseFloat(item.peso || '0').toFixed(2)),
      basoli: parseFloat(parseFloat(item.basoli || '0').toFixed(2)),
      partzilla: parseFloat(parseFloat(item.partzilla || '0').toFixed(2)),
      otra: parseFloat(parseFloat(item.otra || '0').toFixed(2)),
      precio_venta: parseFloat(parseFloat(item.precio_venta || '0').toFixed(2))
    }))

    while (matrizCompleta.length < 30) {
      matrizCompleta.push({ cantidad: 1, codigo: '', descripcion: '', peso: 0.00, basoli: 0.00, partzilla: 0.00, otra: 0.00, precio_venta: 0.00, proveedor_elegido: 'basoli' })
    }
    setCotItems(matrizCompleta)
    setVista('form')
  }

  const cancelar = () => {
    setEditId(null)
    setF({ nro: '', fecha: '', cliente_id: '', cliente_nombre: '', destino: 'AR', vin: '', precio_final: 0.00 })
    setCotItems([])
    setCliSearch('')
    setVista('lista')
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const itemsFiltrados = cotItems.filter(item => item.codigo.trim() !== '' || item.descripcion.trim() !== '')

    if (editId) {
      await supabase.from('cotizaciones').update(f).eq('id', editId)
      await supabase.from('cotizacion_items').delete().eq('cotizacion_id', editId)
      if (itemsFiltrados.length > 0) {
        const ins = itemsFiltrados.map(i => ({ ...i, cotizacion_id: editId }))
        await supabase.from('cotizacion_items').insert(ins)
      }
    } else {
      const { data: nueva } = await supabase.from('cotizaciones').insert([f]).select().single()
      if (nueva && itemsFiltrados.length > 0) {
        const ins = itemsFiltrados.map(i => ({ ...i, cotizacion_id: nueva.id }))
        await supabase.from('cotizacion_items').insert(ins)
      }
    }
    fetchData()
    setVista('lista')
  }

  const borrarCot = async (id: string) => {
    if (!confirm('¿Borrar cotización?')) return
    await supabase.from('cotizacion_items').delete().eq('cotizacion_id', id)
    await supabase.from('cotizaciones').delete().eq('id', id)
    fetchData()
  }

  const clisFiltrados = clientes.filter(c => 
    c.nombre.toLowerCase().includes(cliSearch.toLowerCase())
  )

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
        <p className="text-gray-500">Cargando datos...</p>
      ) : vista === 'lista' ? (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cotizaciones.map((cot) => (
                <tr key={cot.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">{cot.nro}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{fmtDate(cot.fecha)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cot.cliente_nombre || 'Sin cliente'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{cot.destino}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cot.cotizacion_items?.length || 0} ítems</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button onClick={() => editarCot(cot)} className="text-blue-600 hover:text-blue-900">Editar</button>
                    <button onClick={() => borrarCot(cot.id)} className="text-red-600 hover:text-red-900">Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <form onSubmit={guardar} className="space-y-6 bg-white p-6 rounded-xl shadow">
          {/* Encabezado */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase">Número</label>
              <input type="text" value={f.nro} readOnly className="w-full mt-1 p-2 bg-gray-200 border rounded" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase">Fecha</label>
              <input type="date" value={f.fecha} onChange={e => setF({...f, fecha: e.target.value})} className="w-full mt-1 p-2 border rounded" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase">Destino</label>
              <select value={f.destino} onChange={e => setF({...f, destino: e.target.value})} className="w-full mt-1 p-2 border rounded">
                <option value="AR">Argentina (AR)</option>
                <option value="USA">Estados Unidos (USA)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase">VIN / Chasis</label>
              <input type="text" value={f.vin} onChange={e => setF({...f, vin: e.target.value})} className="w-full mt-1 p-2 border rounded" placeholder="Opcional" />
            </div>
          </div>

          {/* Buscador Cliente */}
          <div className="relative bg-gray-50 p-4 rounded-lg">
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Buscar Cliente</label>
            <input type="text" value={cliSearch} onChange={e => setCliSearch(e.target.value)} placeholder="Escribí para buscar..." className="w-full p-2 border rounded" />
            {cliSearch && f.cliente_nombre !== cliSearch && (
              <div className="absolute z-10 left-4 right-4 bg-white border rounded shadow-lg max-h-40 overflow-y-auto mt-1">
                {clisFiltrados.map(c => (
                  <div key={c.id} onClick={() => { setF({...f, cliente_id: c.id, cliente_nombre: c.nombre}); setCliSearch(c.nombre) }} className="p-2 hover:bg-gray-100 cursor-pointer text-sm">
                    {c.nombre}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pegado Masivo */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Caja de Pegado Masivo (Desde Excel / Sheets)</label>
            <textarea value={rawText} onChange={e => setRawText(e.target.value)} placeholder="Pegá las columnas acá: Cantidad | Código | Descripción | Peso | Básoli | Partzilla | Otra | Venta" className="w-full h-20 p-2 border border-blue-300 rounded font-mono text-xs" />
            <button type="button" onClick={procesarPegadoMasivo} className="mt-2 bg-blue-600 text-white text-xs px-4 py-2 rounded hover:bg-blue-700 transition">
              Procesar y Cargar en Matriz
            </button>
          </div>

          {/* Matriz de Ítems */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-100 font-bold text-gray-700">
                <tr>
                  <th className="p-2 text-center w-12">Cant</th>
                  <th className="p-2 text-left w-40">Código</th>
                  <th className="p-2 text-left">Descripción</th>
                  <th className="p-2 text-center w-16">Peso</th>
                  <th className="p-2 text-center w-20">Básoli</th>
                  <th className="p-2 text-center w-20">Partzilla (Con 1.11)</th>
                  <th className="p-2 text-center w-20">Otra</th>
                  <th className="p-2 text-center w-24">Prov. Elegido</th>
                  <th className="p-2 text-center w-24">Precio Venta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {cotItems.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-1"><input type="number" value={item.cantidad} onChange={e => actualizarCeldaItem(index, 'cantidad', parseInt(e.target.value) || 0)} className="w-full p-1 text-center border rounded" /></td>
                    <td className="p-1"><input type="text" value={item.codigo} onChange={e => actualizarCeldaItem(index, 'codigo', e.target.value)} className="w-full p-1 border rounded font-mono" placeholder="Código" /></td>
                    <td className="p-1"><input type="text" value={item.descripcion} onChange={e => actualizarCeldaItem(index, 'descripcion', e.target.value)} className="w-full p-1 border rounded" placeholder="Descripción" /></td>
                    <td className="p-1"><input type="number" step="0.01" value={item.peso === '' ? '' : item.peso} onChange={e => actualizarCeldaItem(index, 'peso', e.target.value)} className="w-full p-1 text-center border rounded" /></td>
                    <td className="p-1"><input type="number" step="0.01" value={item.basoli === '' ? '' : item.basoli} onChange={e => actualizarCeldaItem(index, 'basoli', e.target.value)} className="w-full p-1 text-center border rounded bg-orange-50 font-medium" /></td>
                    <td className="p-1"><input type="number" step="0.01" value={item.partzilla === '' ? '' : item.partzilla} onChange={e => actualizarCeldaItem(index, 'partzilla', e.target.value)} className="w-full p-1 text-center border rounded bg-blue-50 font-medium" /></td>
                    <td className="p-1"><input type="number" step="0.01" value={item.otra === '' ? '' : item.otra} onChange={e => actualizarCeldaItem(index, 'otra', e.target.value)} className="w-full p-1 text-center border rounded bg-gray-50 font-medium" /></td>
                    <td className="p-1">
                      <select value={item.proveedor_elegido} onChange={e => actualizarCeldaItem(index, 'proveedor_elegido', e.target.value)} className="w-full p-1 border rounded font-semibold bg-yellow-50">
                        <option value="basoli">Básoli</option>
                        <option value="partzilla">Partzilla</option>
                        <option value="otra">Otra</option>
                      </select>
                    </td>
                    <td className="p-1"><input type="number" step="0.01" value={item.precio_venta === '' ? '' : item.precio_venta} onChange={e => actualizarCeldaItem(index, 'precio_venta', e.target.value)} className="w-full p-1 text-center border rounded bg-green-50 font-bold text-green-700" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Botonera */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={cancelar} className="px-4 py-2 border rounded-lg hover:bg-gray-100 transition text-sm">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-semibold">
              Guardar Cotización
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
