'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase, fmtDate, fmt, type Cliente, type Item, type PedidoCliente, type CotizacionItem } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Search, Plus, Package, CheckCircle, List } from 'lucide-react'

// Tipo extendido para los ítems de cotización en esta página
interface ApprovedCotItem extends CotizacionItem {
  _cotNro: string; // Número de cotización para mostrar en el selector
}

export default function PedidosPage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [selectedCli, setSelectedCli] = useState<Cliente | null>(null)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [itemsCli, setItemsCli] = useState<any[]>([])
  const [cotizacionesCli, setCotizacionesCli] = useState<ApprovedCotItem[]>([]) // Usamos el tipo extendido
  const [searchCli, setSearchCli] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const [searchItemOrCot, setSearchItemOrCot] = useState('') // Búsqueda para ítems o cotizaciones
  const [showItemOrCotDrop, setShowItemOrCotDrop] = useState(false)
  const itemOrCotDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('clientes').select('*').order('nombre').then(({ data }) => setClientes(data || []))
  }, [])

  const filteredCli = clientes.filter((c: Cliente) => searchCli && c.nombre.toLowerCase().includes(searchCli.toLowerCase())).slice(0, 6)

  const selectCliente = async (cli: Cliente) => {
    setSelectedCli(cli)
    setSearchCli(cli.nombre)
    setShowDropdown(false)
    
    // Cargar pedidos, ítems del inventario del cliente y cotizaciones aprobadas del cliente
    const [pedRes, itemRes, cotRes] = await Promise.all([
      supabase.from('pedidos_cliente').select('*').eq('cliente_id', cli.id).order('created_at', { ascending: false }),
      supabase.from('items').select('*').or(`cliente_id.eq.${cli.id},cliente_nombre.ilike.${cli.nombre}`).order('created_at', { ascending: false }),
      supabase.from('cotizaciones').select('id, nro, cotizacion_items(*)').eq('cliente_id', cli.id).order('nro')
    ])
    setPedidos(pedRes.data || [])
    setItemsCli(itemRes.data || [])
    
    // Filtrar solo los ítems "activos" de las cotizaciones y tiparlos
    const approvedCotItems: ApprovedCotItem[] = [];
    (cotRes.data || []).forEach((cot: any) => {
        (cot.cotizacion_items || []).filter((ci: CotizacionItem) => ci.estado === 'activo').forEach((ci: CotizacionItem) => {
            approvedCotItems.push({ ...ci, _cotNro: cot.nro }); // Añadimos el nro de cotización para mostrar
        });
    });
    setCotizacionesCli(approvedCotItems);
  }

  const agregarPedido = async (selected: { type: 'item' | 'cotizacion_item', data: any }) => {
    if (!selectedCli) return

    let item_id = null;
    let cotizacion_item_id = null;
    let descripcion = selected.data.producto || selected.data.descripcion; // Descripción del pedido
    
    if (selected.type === 'item') {
      item_id = selected.data.id;
      descripcion = `${selected.data.codigo || selected.data.producto} (${selected.data.oem || 'N/A'})`;
    } else if (selected.type === 'cotizacion_item') {
      cotizacion_item_id = selected.data.id;
      descripcion = `${selected.data.codigo || selected.data.descripcion} (Cot: ${selected.data._cotNro})`;
    }

    try {
      const { data, error } = await supabase.from('pedidos_cliente').insert({
        cliente_id: selectedCli.id,
        descripcion: descripcion,
        item_id: item_id,
        cotizacion_item_id: cotizacion_item_id,
        fecha_pedido: new Date().toISOString()
      }).select().single()

      if (error) throw error

      if (data) setPedidos(p => [data, ...p])
      setSearchItemOrCot('');
      setShowItemOrCotDrop(false);
      toast.success('Ítem agregado al pedido')
    } catch (error: any) {
      toast.error('Error al agregar pedido: ' + error.message)
      console.error(error)
    }
  }

  const toggleEntregado = async (pedido: PedidoCliente) => {
    try {
      const { data, error } = await supabase.from('pedidos_cliente')
        .update({ entregado: !pedido.entregado, fecha_entrega: !pedido.entregado ? new Date().toISOString() : null })
        .eq('id', pedido.id).select().single()

      if (error) throw error

      if (data) setPedidos(p => p.map(x => x.id === data.id ? data : x))
    } catch (error: any) {
      toast.error('Error al actualizar entrega: ' + error.message)
      console.error(error)
    }
  }

  const eliminarPedido = async (id: string) => {
    if (!confirm('¿Eliminar este pedido?')) return
    try {
      const { error } = await supabase.from('pedidos_cliente').delete().eq('id', id)
      if (error) throw error
      setPedidos(p => p.filter(x => x.id !== id))
      toast.success('Pedido eliminado')
    } catch (error: any) {
      toast.error('Error al eliminar pedido: ' + error.message)
      console.error(error)
    }
  }

  const getItemStatus = (pedido: PedidoCliente) => {
    if (pedido.item_id) {
      const item = itemsCli.find(x => x.id === pedido.item_id)
      return item?.ubicacion || 'Inventario (Desconocido)'
    }
    if (pedido.cotizacion_item_id) {
      const cotItem = cotizacionesCli.find(x => x.id === pedido.cotizacion_item_id);
      return cotItem ? `Cotización ${cotItem._cotNro} (Activo)` : 'Cotización (Desconocido)';
    }
    return 'Ítem genérico';
  }

  const pendientes = pedidos.filter(p => !p.entregado)
  const entregados = pedidos.filter(p => p.entregado)

  // Items y Cotizaciones filtradas para el selector
  const combinedSearchResults = [
    ...(itemsCli || [])
      .filter((x: any) => 
        (x.producto || '').toLowerCase().includes(searchItemOrCot.toLowerCase()) || 
        (x.codigo || '').toLowerCase().includes(searchItemOrCot.toLowerCase()) ||
        (x.oem || '').toLowerCase().includes(searchItemOrCot.toLowerCase())
      )
      .map((x: any) => ({ type: 'item', data: x })),
    ...(cotizacionesCli || [])
      .filter((x: ApprovedCotItem) => 
        (x.descripcion || '').toLowerCase().includes(searchItemOrCot.toLowerCase()) ||
        (x.codigo || '').toLowerCase().includes(searchItemOrCot.toLowerCase()) ||
        (x._cotNro || '').toLowerCase().includes(searchItemOrCot.toLowerCase())
      )
      .map((x: ApprovedCotItem) => ({ type: 'cotizacion_item', data: x })),
  ].slice(0, 10); // Limitar resultados


  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold mb-8">Pedidos de clientes</h1>

        {/* Buscar cliente */}
        <div className="mb-8 p-6 bg-blue-50 rounded-lg">
          <label className="block text-lg font-bold mb-2">Seleccioná un cliente</label>
          <div className="relative">
            <input
              type="text"
              value={searchCli}
              onChange={e => { setSearchCli(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Buscar cliente por nombre..."
              className="w-full border rounded px-4 py-2"
            />
            {showDropdown && filteredCli.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border rounded mt-1 shadow-lg z-10 max-h-48 overflow-y-auto">
                {filteredCli.map((c: Cliente) => (
                  <button key={c.id} type="button" onClick={() => selectCliente(c)} className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b last:border-b-0">
                    <p className="font-bold">{c.nombre}</p>
                    <p className="text-sm text-gray-600">{c.telefono} {c.provincia ? '· ' + c.provincia : ''}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedCli && (
          <>
            {/* Cliente header */}
            <div className="mb-8 p-6 bg-blue-100 rounded-lg border-blue-300 border">
              <h2 className="text-2xl font-bold text-blue-800 mb-2">{selectedCli.nombre}</h2>
              <p className="text-blue-700">{selectedCli.telefono} {selectedCli.provincia ? '· ' + selectedCli.provincia : ''}</p>
              <div className="flex gap-4 mt-4">
                <div className="bg-white rounded p-3 text-center flex-1">
                  <p className="text-2xl font-bold text-orange-600">{pendientes.length}</p>
                  <p className="text-sm text-gray-600">ítems pendientes</p>
                </div>
                <div className="bg-white rounded p-3 text-center flex-1">
                  <p className="text-2xl font-bold text-green-600">{entregados.length}</p>
                  <p className="text-sm text-gray-600">ítems entregados</p>
                </div>
              </div>
            </div>

            {/* Agregar ítem al pedido - Selector Combinado */}
            <div className="mb-8 p-6 bg-green-50 rounded-lg border-green-200 border">
              <h2 className="text-xl font-bold text-green-800 mb-4">Agregar ítem al pedido</h2>
              <div className="relative flex gap-3">
                <input
                  type="text"
                  value={searchItemOrCot}
                  onChange={e => { setSearchItemOrCot(e.target.value); setShowItemOrCotDrop(true) }}
                  onFocus={() => setShowItemOrCotDrop(true)}
                  placeholder="Buscar ítem del inventario o de cotización aprobada..."
                  className="flex-1 border rounded px-3 py-2"
                />
                {showItemOrCotDrop && combinedSearchResults.length > 0 && (
                  <div ref={itemOrCotDropRef} className="absolute top-full left-0 right-0 bg-white border rounded mt-1 shadow-lg z-10 max-h-60 overflow-y-auto">
                    {combinedSearchResults.map((result: any) => (
                      <button
                        key={`${result.type}-${result.data.id}`}
                        type="button"
                        onClick={e => { e.preventDefault(); agregarPedido(result); }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b last:border-b-0"
                      >
                        <p className="font-bold">
                          {result.type === 'item' && `Inventario: ${result.data.codigo || result.data.producto} (${result.data.oem || 'N/A'})`}
                          {result.type === 'cotizacion_item' && `Cotización: ${result.data._cotNro} - ${result.data.descripcion} (${result.data.codigo || 'N/A'})`}
                        </p>
                        <p className="text-sm text-gray-600">
                          {result.type === 'item' && `Ubicación: ${result.data.ubicacion || 'N/A'} - Venta: ${fmt(result.data.precio_venta)}`}
                          {result.type === 'cotizacion_item' && `Precio: ${fmt(result.data.precio_venta)}`}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {/* Botón para agregar texto genérico si no se selecciona nada de la lista */}
                <button type="button" onClick={() => agregarPedido({ type: 'item', data: { producto: searchItemOrCot, id: null, codigo: 'GENERICO' } })} disabled={!searchItemOrCot.trim()} className="btn bg-gray-600 text-white hover:bg-gray-700">
                  <Plus size={20} /> Genérico
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">Buscá un ítem del inventario o una cotización aprobada.</p>
            </div>


            {/* Pedido pendiente */}
            {pendientes.length > 0 && (
              <div className="mb-8 p-6 bg-yellow-50 rounded-lg border-yellow-200 border">
                <h2 className="text-xl font-bold text-yellow-800 mb-4">⏳ Pendiente de entrega ({pendientes.length})</h2>
                <div className="space-y-4">
                  {pendientes.map(p => {
                    const status = getItemStatus(p)
                    return (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-white rounded shadow-sm">
                        <button type="button" onClick={() => toggleEntregado(p)} className="w-8 h-8 rounded-full border-2 border-yellow-500 flex items-center justify-center text-yellow-600 hover:bg-yellow-50 transition-all flex-shrink-0">
                          <CheckCircle size={16} />
                        </button>
                        <div className="flex-1 ml-4">
                          <p className="font-semibold">{p.descripcion}</p>
                          {status && (
                            <p className="text-sm text-gray-600 flex items-center gap-1"><Package size={14} /> {status}</p>
                          )}
                          {!status && <p className="text-sm text-red-600">No encontrado en inventario</p>}
                        </div>
                        <button type="button" onClick={() => eliminarPedido(p.id)} className="ml-4 p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all flex-shrink-0">✕</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Entregados */}
            {entregados.length > 0 && (
              <div className="mb-8 p-6 bg-green-50 rounded-lg border-green-200 border">
                <h2 className="text-xl font-bold text-green-800 mb-4">✓ Entregado ({entregados.length})</h2>
                <div className="space-y-4">
                  {entregados.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-white rounded shadow-sm">
                      <button type="button" onClick={() => toggleEntregado(p)} className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white hover:bg-green-700 transition-all flex-shrink-0">
                        <CheckCircle size={16} />
                      </button>
                      <div className="flex-1 ml-4">
                        <p className="font-semibold">{p.descripcion}</p>
                        {p.fecha_entrega && <p className="text-sm text-gray-600">Entregado el {fmtDate(p.fecha_entrega.split('T')[0])}</p>}
                      </div>
                      <button type="button" onClick={() => eliminarPedido(p.id)} className="ml-4 p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all flex-shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historial de compras para este cliente */}
            {itemsCli.length > 0 && (
              <div className="mb-8 p-6 bg-gray-50 rounded-lg border-gray-200 border">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Historial de compras ({itemsCli.length})</h2>
                <div className="space-y-4">
                  {itemsCli.map((x: any) => (
                    <div key={x.id} className="flex items-center justify-between p-3 bg-white rounded shadow-sm">
                      <div className="flex-1">
                        <p className="font-bold">{x.producto} <span className="font-mono text-blue-600">{x.codigo}</span></p>
                        <p className="text-sm text-gray-600">{x.nro_orden ? 'Orden: ' + x.nro_orden + ' · ' : ''}{fmtDate(x.fecha_compra)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{x.precio_venta ? fmt(x.precio_venta) : fmt(x.costo_total)}</p>
                        <p className="text-sm text-gray-600">{x.ubicacion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!selectedCli && (
          <div className="p-10 bg-gray-100 rounded-lg text-center text-gray-600 text-lg">
            <p>Buscá un cliente para ver su nota de pedido</p>
          </div>
        )}
      </div>
    </div>
  )
}
