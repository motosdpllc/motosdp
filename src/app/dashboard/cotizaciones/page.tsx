'use client'

import { useState, useEffect } from 'react'
import { supabase, fmtDate, fmt, getNextCounter } from '@/lib/supabase'

const MULTIPLICADOR = 1.11

interface CotizacionItem {
  id?: string
  cotizacion_id?: string
  cantidad: number
  codigo: string
  descripcion: string
  peso_estimado: number
  basoli: number
  partzilla: number
  otra: number
  precio_venta: number
  proveedor_elegido: 'basoli' | 'partzilla' | 'otra' | null
  proveedor_otro_nombre: string
  proveedor_otro_link: string
}

interface Cotizacion {
  id: string
  nro: string
  fecha: string
  cliente_id: string
  cliente_nombre: string
  destino: string
  vin: string
  precio_final: number
  cotizacion_items?: CotizacionItem[]
}

interface Cliente {
  id: string
  nombre: string
  telefono?: string
}

const ITEM_VACIO: CotizacionItem = {
  cantidad: 1,
  codigo: '',
  descripcion: '',
  peso_estimado: 0,
  basoli: 0,
  partzilla: 0,
  otra: 0,
  precio_venta: 0,
  proveedor_elegido: null,
  proveedor_otro_nombre: '',
  proveedor_otro_link: ''
}

export default function CotizacionesPage() {
  const [vista, setVista] = useState<'lista' | 'editar'>('lista')
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Estado del formulario
  const [nro, setNro] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [clienteId, setClienteId] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [destino, setDestino] = useState('AR')
  const [vin, setVin] = useState('')
  const [precioFinal, setPrecioFinal] = useState(0)

  // Items y pegado masivo
  const [items, setItems] = useState<CotizacionItem[]>(Array(30).fill(null).map(() => ({ ...ITEM_VACIO })))
  const [rawText, setRawText] = useState('')
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([])
  const [mostrarListaClientes, setMostrarListaClientes] = useState(false)

  // Panel lateral
  const [itemActivoIndex, setItemActivoIndex] = useState<number | null>(null)

  // Cargar datos iniciales
  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true)
        const { data: cots } = await supabase
          .from('cotizaciones')
          .select('*, cotizacion_items(*)')
          .order('created_at', { ascending: false })

        const { data: clis } = await supabase
          .from('clientes')
          .select('*')
          .order('nombre')

        if (cots) setCotizaciones(cots as Cotizacion[])
        if (clis) setClientes(clis as Cliente[])
      } catch (err) {
        alert('Error al cargar datos: ' + (err instanceof Error ? err.message : 'Error desconocido'))
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  // Buscar clientes
  const handleBusquedaCliente = (valor: string) => {
    setBusquedaCliente(valor)
    if (valor.trim()) {
      const filtrados = clientes.filter(c =>
        c.nombre.toLowerCase().includes(valor.toLowerCase())
      )
      setClientesFiltrados(filtrados)
      setMostrarListaClientes(true)
    } else {
      setClientesFiltrados([])
      setMostrarListaClientes(false)
    }
  }

  const seleccionarCliente = (cliente: Cliente) => {
    setClienteId(cliente.id)
    setClienteNombre(cliente.nombre)
    setBusquedaCliente(cliente.nombre)
    setMostrarListaClientes(false)
  }

  // Procesar pegado masivo
  const procesarPegadoMasivo = () => {
    if (!rawText.trim()) {
      alert('Pegá datos primero')
      return
    }

    try {
      const lineas = rawText.split('\n').filter(l => l.trim())
      const nuevosItems: CotizacionItem[] = []

      lineas.forEach(linea => {
        const cols = linea.split('\t')
        if (cols.length < 8) return

        nuevosItems.push({
          cantidad: parseInt(cols[0]) || 1,
          codigo: cols[1]?.trim() || '',
          descripcion: cols[2]?.trim() || '',
          peso_estimado: parseFloat(cols[3]) || 0,
          basoli: parseFloat(cols[4]) || 0,
          partzilla: parseFloat(cols[5]) || 0,
          otra: parseFloat(cols[6]) || 0,
          precio_venta: parseFloat(cols[7]) || 0,
          proveedor_elegido: 'basoli',
          proveedor_otro_nombre: '',
          proveedor_otro_link: ''
        })
      })

      // Llenar hasta 30 filas
      while (nuevosItems.length < 30) {
        nuevosItems.push({ ...ITEM_VACIO })
      }

      setItems(nuevosItems.slice(0, 30))
      setRawText('')
      alert(`✅ Se procesaron ${lineas.length} filas`)
    } catch (err) {
      alert('Error al procesar: ' + (err instanceof Error ? err.message : 'Error'))
    }
  }

  // Actualizar item
  const actualizarItem = (index: number, campo: keyof CotizacionItem, valor: any) => {
    const nuevoItems = [...items]
    if (['peso_estimado', 'basoli', 'partzilla', 'otra', 'precio_venta'].includes(campo)) {
      nuevoItems[index] = { ...nuevoItems[index], [campo]: parseFloat(valor) || 0 }
    } else if (campo === 'cantidad') {
      nuevoItems[index] = { ...nuevoItems[index], [campo]: parseInt(valor) || 0 }
    } else {
      nuevoItems[index] = { ...nuevoItems[index], [campo]: valor }
    }
    setItems(nuevoItems)
  }

  // Calcular costo con recargo
  const calcularCostoConRecargo = (item: CotizacionItem): number => {
    let costo = 0
    if (item.proveedor_elegido === 'basoli') costo = item.basoli
    else if (item.proveedor_elegido === 'partzilla') costo = item.partzilla
    else if (item.proveedor_elegido === 'otra') costo = item.otra
    return parseFloat((costo * MULTIPLICADOR).toFixed(2))
  }

  // Validar si el precio es menor al costo
  const esVentaMenor = (item: CotizacionItem): boolean => {
    if (!item.proveedor_elegido || item.cantidad === 0) return false
    const costoConRecargo = calcularCostoConRecargo(item)
    return item.precio_venta > 0 && item.precio_venta < costoConRecargo
  }

  // Nueva cotización
  const nuevaCotizacion = async () => {
    try {
      const contador = await getNextCounter('cot')
      setNro('COT-' + String(contador).padStart(3, '0'))
      setFecha(new Date().toISOString().split('T')[0])
      setClienteId('')
      setClienteNombre('')
      setBusquedaCliente('')
      setDestino('AR')
      setVin('')
      setPrecioFinal(0)
      setItems(Array(30).fill(null).map(() => ({ ...ITEM_VACIO })))
      setItemActivoIndex(null)
      setEditId(null)
      setVista('editar')
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Error'))
    }
  }

  // Editar cotización
  const editarCotizacion = (cot: Cotizacion) => {
    setEditId(cot.id)
    setNro(cot.nro)
    setFecha(cot.fecha)
    setClienteId(cot.cliente_id)
    setClienteNombre(cot.cliente_nombre)
    setBusquedaCliente(cot.cliente_nombre)
    setDestino(cot.destino)
    setVin(cot.vin)
    setPrecioFinal(cot.precio_final)

    const itemsCargados = (cot.cotizacion_items || []).map(i => ({
      ...i,
      id: i.id,
      cotizacion_id: i.cotizacion_id,
      cantidad: i.cantidad || 1,
      codigo: i.codigo || '',
      descripcion: i.descripcion || '',
      peso_estimado: i.peso_estimado || 0,
      basoli: i.basoli || 0,
      partzilla: i.partzilla || 0,
      otra: i.otra || 0,
      precio_venta: i.precio_venta || 0,
      proveedor_elegido: (i.proveedor_elegido as any) || null,
      proveedor_otro_nombre: i.proveedor_otro_nombre || '',
      proveedor_otro_link: i.proveedor_otro_link || ''
    })) as CotizacionItem[]

    while (itemsCargados.length < 30) {
      itemsCargados.push({ ...ITEM_VACIO })
    }

    setItems(itemsCargados)
    setItemActivoIndex(null)
    setVista('editar')
  }

  // Guardar cotización
  const guardarCotizacion = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nro || !clienteNombre) {
      alert('⚠️ Número de cotización y cliente son requeridos')
      return
    }

    try {
      setGuardando(true)

      const datos = {
        nro,
        fecha,
        cliente_id: clienteId,
        cliente_nombre: clienteNombre,
        destino,
        vin,
        precio_final: precioFinal
      }

      let cotizacionId = editId

      if (editId) {
        // Actualizar
        const { error } = await supabase
          .from('cotizaciones')
          .update(datos)
          .eq('id', editId)

        if (error) throw error
      } else {
        // Crear
        const { data, error } = await supabase
          .from('cotizaciones')
          .insert([datos])
          .select()
          .single()

        if (error) throw error
        cotizacionId = data.id
      }

      // Limpiar items viejos
      if (cotizacionId) {
        await supabase
          .from('cotizacion_items')
          .delete()
          .eq('cotizacion_id', cotizacionId)

        // Insertar nuevos items (solo los que tienen código o descripción)
        const itemsAGuardar = items
          .filter(i => i.codigo.trim() !== '' || i.descripcion.trim() !== '')
          .map(i => ({
            cotizacion_id: cotizacionId,
            cantidad: i.cantidad,
            codigo: i.codigo,
            descripcion: i.descripcion,
            peso_estimado: i.peso_estimado,
            basoli: i.basoli,
            partzilla: i.partzilla,
            otra: i.otra,
            precio_venta: i.precio_venta,
            proveedor_elegido: i.proveedor_elegido,
            proveedor_otro_nombre: i.proveedor_otro_nombre,
            proveedor_otro_link: i.proveedor_otro_link
          }))

        if (itemsAGuardar.length > 0) {
          const { error: insertError } = await supabase
            .from('cotizacion_items')
            .insert(itemsAGuardar)

          if (insertError) throw insertError
        }
      }

      alert('✅ Cotización guardada correctamente')
      setVista('lista')
      setEditId(null)

      // Recargar
      const { data: cots } = await supabase
        .from('cotizaciones')
        .select('*, cotizacion_items(*)')
        .order('created_at', { ascending: false })

      if (cots) setCotizaciones(cots as Cotizacion[])
    } catch (err) {
      alert('❌ Error al guardar: ' + (err instanceof Error ? err.message : 'Error'))
    } finally {
      setGuardando(false)
    }
  }

  // Eliminar cotización
  const eliminarCotizacion = async (id: string) => {
    if (!confirm('¿Estás seguro de que querés eliminar esta cotización?')) return

    try {
      setLoading(true)

      // Eliminar items
      await supabase.from('cotizacion_items').delete().eq('cotizacion_id', id)

      // Eliminar cotización
      await supabase.from('cotizaciones').delete().eq('id', id)

      alert('✅ Cotización eliminada')

      // Recargar
      const { data: cots } = await supabase
        .from('cotizaciones')
        .select('*, cotizacion_items(*)')
        .order('created_at', { ascending: false })

      if (cots) setCotizaciones(cots as Cotizacion[])
    } catch (err) {
      alert('❌ Error: ' + (err instanceof Error ? err.message : 'Error'))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-500 text-lg">Cargando...</p>
      </div>
    )
  }

  // VISTA LISTA
  if (vista === 'lista') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Cotizaciones</h1>
            <button
              onClick={nuevaCotizacion}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-semibold"
            >
              + Nueva Cotización
            </button>
          </div>

          {cotizaciones.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 text-lg">No hay cotizaciones aún</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="px-6 py-3 text-left text-sm font-bold">Nro</th>
                    <th className="px-6 py-3 text-left text-sm font-bold">Cliente</th>
                    <th className="px-6 py-3 text-left text-sm font-bold">VIN</th>
                    <th className="px-6 py-3 text-left text-sm font-bold">Fecha</th>
                    <th className="px-6 py-3 text-left text-sm font-bold">Items</th>
                    <th className="px-6 py-3 text-right text-sm font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cotizaciones.map(cot => (
                    <tr key={cot.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-3 font-semibold">{cot.nro}</td>
                      <td className="px-6 py-3">{cot.cliente_nombre}</td>
                      <td className="px-6 py-3 text-sm font-mono">{cot.vin || '—'}</td>
                      <td className="px-6 py-3 text-sm">{fmtDate(cot.fecha)}</td>
                      <td className="px-6 py-3 text-sm">{cot.cotizacion_items?.length || 0}</td>
                      <td className="px-6 py-3 text-right space-x-2">
                        <button
                          onClick={() => editarCotizacion(cot)}
                          className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarCotizacion(cot.id)}
                          className="text-red-600 hover:text-red-800 font-semibold text-sm"
                        >
                          Borrar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // VISTA EDITAR
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">
            {editId ? 'Editar Cotización' : 'Nueva Cotización'}
          </h1>
          <button
            onClick={() => setVista('lista')}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            ← Volver
          </button>
        </div>

        <form onSubmit={guardarCotizacion}>
          {/* ENCABEZADO */}
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-bold mb-1">Nro Cotización</label>
                <input
                  type="text"
                  value={nro}
                  disabled
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Fecha</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Destino</label>
                <select
                  value={destino}
                  onChange={e => setDestino(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="AR">Argentina</option>
                  <option value="EEUU">Estados Unidos</option>
                  <option value="INT">Internacional</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">VIN</label>
                <input
                  type="text"
                  value={vin}
                  onChange={e => setVin(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Ej: JH2RC5004LM200001"
                />
              </div>
            </div>

            {/* Cliente */}
            <div className="mt-4 relative">
              <label className="block text-sm font-bold mb-1">Cliente</label>
              <input
                type="text"
                value={busquedaCliente}
                onChange={e => handleBusquedaCliente(e.target.value)}
                onFocus={() => busquedaCliente && setMostrarListaClientes(true)}
                className="w-full border rounded px-3 py-2"
                placeholder="Escribí el nombre del cliente..."
              />

              {mostrarListaClientes && clientesFiltrados.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border rounded mt-1 shadow-lg z-10 max-h-48 overflow-y-auto">
                  {clientesFiltrados.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => seleccionarCliente(c)}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0"
                    >
                      {c.nombre}
                      {c.telefono && <span className="text-xs text-gray-500 ml-2">({c.telefono})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-bold mb-1">Precio Final (opcional)</label>
              <input
                type="number"
                step="0.01"
                value={precioFinal}
                onChange={e => setPrecioFinal(parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          {/* PEGADO MASIVO */}
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-lg font-bold mb-3">📋 Pegado Masivo (TSV)</h2>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="Cantidad	Código	Descripción	Peso	Basoli	Partzilla	Otra	Precio Venta
1	BRC-001	Frenos	0.5	100	120	110	150
2	MGN-002	Magneto	1.2	300	350	320	450"
              className="w-full h-24 border rounded px-3 py-2 font-mono text-xs mb-3"
            />
            <button
              type="button"
              onClick={procesarPegadoMasivo}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold"
            >
              Procesar Excel
            </button>
          </div>

          {/* TABLA DE ITEMS */}
          <div className="bg-white rounded-lg shadow overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-2 py-2 text-left font-bold">Cant</th>
                  <th className="px-2 py-2 text-left font-bold">Código</th>
                  <th className="px-2 py-2 text-left font-bold">Descripción</th>
                  <th className="px-2 py-2 text-center font-bold">Peso</th>
                  <th className="px-2 py-2 text-center font-bold">Basoli</th>
                  <th className="px-2 py-2 text-center font-bold">Partzilla</th>
                  <th className="px-2 py-2 text-center font-bold">Otra</th>
                  <th className="px-2 py-2 text-center font-bold">Prov</th>
                  <th className="px-2 py-2 text-center font-bold">Costo x 1.11</th>
                  <th className="px-2 py-2 text-center font-bold">Venta</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const costoConRecargo = calcularCostoConRecargo(item)
                  const esAlerta = esVentaMenor(item)
                  const rowClass = esAlerta ? 'bg-red-200' : ''

                  return (
                    <tr key={idx} className={`border-b ${rowClass}`}>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          value={item.cantidad || ''}
                          onChange={e => actualizarItem(idx, 'cantidad', e.target.value)}
                          className="w-12 border rounded px-1 py-0.5 text-center text-sm"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={item.codigo}
                          onChange={e => actualizarItem(idx, 'codigo', e.target.value)}
                          className="w-16 border rounded px-1 py-0.5 text-sm font-mono"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={item.descripcion}
                          onChange={e => actualizarItem(idx, 'descripcion', e.target.value)}
                          onClick={() => setItemActivoIndex(idx)}
                          className="w-32 border rounded px-1 py-0.5 text-sm cursor-pointer hover:bg-gray-100"
                          placeholder="Click para detalles..."
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          step="0.1"
                          value={item.peso_estimado || ''}
                          onChange={e => actualizarItem(idx, 'peso_estimado', e.target.value)}
                          className="w-14 border rounded px-1 py-0.5 text-center text-sm"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          step="0.01"
                          value={item.basoli || ''}
                          onChange={e => actualizarItem(idx, 'basoli', e.target.value)}
                          className="w-14 border rounded px-1 py-0.5 text-center text-sm bg-gray-50"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          step="0.01"
                          value={item.partzilla || ''}
                          onChange={e => actualizarItem(idx, 'partzilla', e.target.value)}
                          className="w-14 border rounded px-1 py-0.5 text-center text-sm bg-gray-50"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          step="0.01"
                          value={item.otra || ''}
                          onChange={e => actualizarItem(idx, 'otra', e.target.value)}
                          onClick={() => setItemActivoIndex(idx)}
                          className="w-14 border rounded px-1 py-0.5 text-center text-sm bg-purple-50 cursor-pointer hover:bg-purple-100 font-semibold text-purple-800"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={item.proveedor_elegido || ''}
                          onChange={e => actualizarItem(idx, 'proveedor_elegido', e.target.value || null)}
                          className="w-16 border rounded px-1 py-0.5 text-center text-sm bg-blue-50 font-bold"
                        >
                          <option value="">—</option>
                          <option value="basoli">Basoli</option>
                          <option value="partzilla">Partzilla</option>
                          <option value="otra">Otra</option>
                        </select>
                      </td>
                      <td className="px-2 py-1 text-center text-sm font-bold">
                        {costoConRecargo > 0 ? `$${costoConRecargo.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          step="0.01"
                          value={item.precio_venta || ''}
                          onChange={e => actualizarItem(idx, 'precio_venta', e.target.value)}
                          className={`w-16 border rounded px-1 py-0.5 text-center text-sm font-bold ${
                            esAlerta ? 'bg-red-600 text-white border-red-700' : 'bg-green-50 text-green-700'
                          }`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* BOTONES */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setVista('lista')}
              className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar Cotización'}
            </button>
          </div>
        </form>

        {/* PANEL LATERAL */}
        {itemActivoIndex !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
            <div className="bg-white w-full md:w-96 h-screen md:h-auto md:rounded-lg p-6 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">
                  ⚙️ Detalles Línea #{itemActivoIndex + 1}
                </h2>
                <button
                  type="button"
                  onClick={() => setItemActivoIndex(null)}
                  className="text-gray-500 hover:text-gray-700 font-bold text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Código</label>
                  <input
                    type="text"
                    value={items[itemActivoIndex]?.codigo || ''}
                    onChange={e => actualizarItem(itemActivoIndex, 'codigo', e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1">Descripción</label>
                  <input
                    type="text"
                    value={items[itemActivoIndex]?.descripcion || ''}
                    onChange={e => actualizarItem(itemActivoIndex, 'descripcion', e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={items[itemActivoIndex]?.peso_estimado || ''}
                    onChange={e => actualizarItem(itemActivoIndex, 'peso_estimado', e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-bold text-sm mb-3">Proveedor Externo</h3>

                  <div className="mb-3">
                    <label className="block text-xs font-bold mb-1">Nombre (Ej: CMSNL, Ebay)</label>
                    <input
                      type="text"
                      value={items[itemActivoIndex]?.proveedor_otro_nombre || ''}
                      onChange={e => actualizarItem(itemActivoIndex, 'proveedor_otro_nombre', e.target.value)}
                      className="w-full border rounded px-3 py-1 text-xs uppercase"
                      placeholder="Nombre del proveedor..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1">Link Web</label>
                    <input
                      type="text"
                      value={items[itemActivoIndex]?.proveedor_otro_link || ''}
                      onChange={e => actualizarItem(itemActivoIndex, 'proveedor_otro_link', e.target.value)}
                      className="w-full border rounded px-3 py-1 text-xs font-mono text-blue-600"
                      placeholder="https://..."
                    />
                  </div>

                  {items[itemActivoIndex]?.proveedor_otro_link && (
                    <a
                      href={items[itemActivoIndex]?.proveedor_otro_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs mt-2 block font-semibold"
                    >
                      🌐 Abrir en la web
                    </a>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setItemActivoIndex(null)}
                className="w-full mt-6 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
