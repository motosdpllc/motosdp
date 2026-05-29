'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { supabase, fmt, type Item, type PedidoCliente } from '@/lib/supabase' // Agregamos PedidoCliente
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { X, List, Plus } from 'lucide-react' // Usaremos List para pedidos y Plus para el genérico

// Importación dinámica para VentasForm para evitar problemas de SSR con useSearchParams
import dynamic from 'next/dynamic';

const DynamicVentasForm = dynamic(() => Promise.resolve(VentasForm), { ssr: false });


interface VentaItem {
  id: string; producto: string; oem?: string; codigo?: string
  costoTotal: number; precio: number; tipo: 'inventario' | 'rapido' | 'pedido' // Tipo 'pedido'
  pedido_id?: string // Para vincular con el pedido
}

function VentasForm() {
  const router = useRouter()
  const searchParams = useSearchParams() // Este hook requiere Suspense
  const cliDropRef = useRef<HTMLDivElement>(null)
  const itemDropRef = useRef<HTMLDivElement>(null)
  const pedidoDropRef = useRef<HTMLDivElement>(null) // Nuevo ref para pedidos

  const [clientes, setClientes] = useState<any[]>([])
  const [cliSearch, setCliSearch] = useState('')
  const [showCliDrop, setShowCliDrop] = useState(false)
  const [clienteId, setClienteId] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [destino, setDestino] = useState('')
  const [nroVenta, setNroVenta] = useState('')
  const [estadoPago, setEstadoPago] = useState('')
  const [ventaItems, setVentaItems] = useState<VentaItem[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [itemResults, setItemResults] = useState<any[]>([])
  const [showItemDrop, setShowItemDrop] = useState(false)
  const [rprod, setRprod] = useState('')
  const [rcosto, setRcosto] = useState('')
  const [rprecio, setRprecio] = useState('')
  const [roem, setRoem] = useState('')
  const [saving, setSaving] = useState(false)

  const [pedidosCliente, setPedidosCliente] = useState<PedidoCliente[]>([]) // Pedidos pendientes del cliente
  const [searchPedido, setSearchPedido] = useState('')
  const [showPedidoDrop, setShowPedidoDrop] = useState(false)

  useEffect(() => {
    supabase.from('clientes').select('id, nombre, telefono, provincia').order('nombre').then(({ data }) => setClientes(data || []))

    // Manejar el clic fuera de los dropdowns
    const h = (e: MouseEvent) => {
      if (cliDropRef.current && !cliDropRef.current.contains(e.target as Node)) setShowCliDrop(false)
      if (itemDropRef.current && !itemDropRef.current.contains(e.target as Node)) setShowItemDrop(false)
      if (pedidoDropRef.current && !pedidoDropRef.current.contains(e.target as Node)) setShowPedidoDrop(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Cargar pedidos pendientes del cliente seleccionado
  useEffect(() => {
    if (clienteId) {
      supabase.from('pedidos_cliente')
        .select('*, items(*)') // Traemos la info del item si está vinculado
        .eq('cliente_id', clienteId)
        .eq('entregado', false)
        .order('fecha_pedido', { ascending: false })
        .then(({ data }) => setPedidosCliente(data || []));
    } else {
      setPedidosCliente([]);
    }
  }, [clienteId]);


  const filtCli = clientes.filter((c: any) => cliSearch && c.nombre.toLowerCase().includes(cliSearch.toLowerCase())).slice(0, 6)
  const filtPedidos = pedidosCliente.filter(p => searchPedido && p.descripcion.toLowerCase().includes(searchPedido.toLowerCase())).slice(0, 6);

  const autoNro = async (dest: string) => {
    if (!dest) { setNroVenta(''); return }
    const { data } = await supabase.from('counters').select('value').eq('key', 'venta_' + dest).single()
    setNroVenta(dest + '-' + String((data?.value || 0) + 1).padStart(3, '0'))
  }

  const buscarItems = async (q: string) => {
    setItemSearch(q)
    if (!q.trim()) { setItemResults([]); setShowItemDrop(false); return }
    const { data } = await supabase.from('items').select('*')
      .not('ubicacion', 'eq', 'Vendido').not('ubicacion', 'eq', 'Cancelado').not('ubicacion', 'eq', 'Entregado')
      .or(`producto.ilike.%${q}%,oem.ilike.%${q}%,codigo.ilike.%${q}%,nro_orden.ilike.%${q}%`)
      .limit(8)
    setItemResults((data || []).filter((x: any) => !ventaItems.find(v => v.id === x.id)))
    setShowItemDrop(true)
  }

  const agregarItem = (item: Item) => {
    setVentaItems(p => [...p, { id: item.id, producto: item.producto, oem: item.oem, codigo: item.codigo, costoTotal: item.costo_total || 0, precio: item.precio_venta || 0, tipo: 'inventario' }])
    setItemSearch(''); setItemResults([]); setShowItemDrop(false)
  }

  const agregarPedidoComoVenta = async (pedido: PedidoCliente) => {
    let itemData: any = null;
    if (pedido.item_id) {
      // Si el pedido está vinculado a un ítem de inventario
      const { data } = await supabase.from('items').select('*').eq('id', pedido.item_id).single();
      itemData = data;
    } else if (pedido.cotizacion_item_id) {
        // Si el pedido está vinculado a un ítem de cotización (hay que buscarlo)
        const { data: cotItem } = await supabase.from('cotizacion_items').select('*').eq('id', pedido.cotizacion_item_id).single();
        if (cotItem) {
          itemData = {
            producto: cotItem.descripcion,
            oem: cotItem.oem, // Si está en cotizacion_items
            codigo: cotItem.codigo,
            costo_total: cotItem.basoli || cotItem.partzilla || cotItem.otra || 0, // Usar el costo del proveedor elegido en cotización
            precio_venta: cotItem.precio_venta || 0,
            // ID temporal para VentaItem, no es de inventario real
            id: `cotpedido_${pedido.cotizacion_item_id}` 
          };
        }
    }

    if (itemData) {
      setVentaItems(p => [...p, { 
        id: itemData.id, 
        producto: itemData.producto, 
        oem: itemData.oem, 
        codigo: itemData.codigo, 
        costoTotal: itemData.costo_total || 0, 
        precio: itemData.precio_venta || 0, 
        tipo: pedido.item_id ? 'inventario' : 'pedido', // Si viene de item_id es inventario, sino pedido
        pedido_id: pedido.id // Vincular el pedido original
      }]);
    } else {
        // Si no se encontró un ítem vinculado, agrega como rápido
        setVentaItems(p => [...p, { 
            id: `pedido_rapido_${pedido.id}`, 
            producto: pedido.descripcion, 
            oem: '', 
            codigo: '', 
            costoTotal: 0, 
            precio: 0, 
            tipo: 'pedido', 
            pedido_id: pedido.id 
        }]);
    }
    setSearchPedido(''); 
    setShowPedidoDrop(false);
    toast.success(`Pedido "${pedido.descripcion}" agregado a la venta.`);
  };


  const agregarRapido = () => {
    if (!rprod.trim()) { toast.error('Ingresá el nombre'); return }
    setVentaItems(p => [...p, { id: 'rapido_' + Date.now(), producto: rprod, oem: roem, codigo: '', costoTotal: parseFloat(rcosto) || 0, precio: parseFloat(rprecio) || 0, tipo: 'rapido' }])
    setRprod(''); setRcosto(''); setRprecio(''); setRoem('')
  }

  const total = ventaItems.reduce((a, x) => a + x.precio, 0)
  const costo = ventaItems.reduce((a, x) => a + x.costoTotal, 0)

  const confirmar = async () => {
    if (!ventaItems.length) { toast.error('Agregá al menos un ítem'); return }
    if (!destino) { toast.error('Seleccioná el destino'); return }
    setSaving(true)
    const { data: cnt } = await supabase.rpc('increment_counter', { counter_key: 'venta_' + destino })
    const nro = destino + '-' + String(cnt || 1).padStart(3, '0')

    for (const vi of ventaItems) {
      if (vi.tipo === 'inventario') {
        await supabase.from('items').update({
          ubicacion: 'Vendido', precio_venta: vi.precio, ganancia: vi.precio - vi.costoTotal,
          cliente_id: clienteId || null, cliente_nombre: clienteNombre || null,
          nro_venta: nro, estado_pago: estadoPago || null, fecha_venta: fecha,
          updated_at: new Date().toISOString()
        }).eq('id', vi.id)
      } else if (vi.tipo === 'pedido') { // Es un ítem de pedido
        // 1. Marcar el pedido como entregado
        if (vi.pedido_id) {
          await supabase.from('pedidos_cliente')
            .update({ entregado: true, fecha_entrega: new Date().toISOString() })
            .eq('id', vi.pedido_id);
        }

        // 2. Insertar como item nuevo (si no vino del inventario)
        await supabase.from('items').insert({
          producto: vi.producto, oem: vi.oem || null, codigo: vi.codigo || null,
          costo_total: vi.costoTotal, precio_venta: vi.precio, ganancia: vi.precio - vi.costoTotal,
          cliente_id: clienteId || null, cliente_nombre: clienteNombre || null,
          nro_venta: nro, estado_pago: estadoPago || null, fecha_venta: fecha,
          ubicacion: 'Entregado', // Se asume que al vender el pedido, se entrega
        })
      }
      else { // Cotización o Rápido
        await supabase.from('items').insert({
          producto: vi.producto, oem: vi.oem || null, codigo: vi.codigo || null,
          costo_total: vi.costoTotal, precio_venta: vi.precio, ganancia: vi.precio - vi.costoTotal,
          cliente_id: clienteId || null, cliente_nombre: clienteNombre || null,
          nro_venta: nro, estado_pago: estadoPago || null, fecha_venta: fecha,
          ubicacion: 'Entregado', // Se asume que al vender el rápido, se entrega
        })
      }
    }
    toast.success('✓ Venta ' + nro + ' registrada!')
    setSaving(false)
    router.push('/dashboard')
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow">
      <h1 className="text-3xl font-bold mb-8">Nueva venta</h1>

      {/* Datos de la venta */}
      <div className="bg-gray-50 p-6 rounded-lg mb-8">
        <h2 className="text-lg font-bold mb-4">Datos de la venta</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2">Cliente</label>
            <div className="relative">
              <input
                type="text"
                value={cliSearch}
                onChange={(e) => { setCliSearch(e.target.value); setShowCliDrop(true); if (!e.target.value) { setClienteId(''); setClienteNombre('') } }}
                placeholder="Buscar..."
                className="w-full border rounded px-3 py-2"
                onFocus={() => { if (cliSearch) setShowCliDrop(true) }}
              />
              {showCliDrop && filtCli.length > 0 && (
                <div ref={cliDropRef} className="absolute top-full left-0 right-0 bg-white border rounded mt-1 shadow-lg z-10 max-h-48 overflow-y-auto">
                  {filtCli.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={(e) => { e.preventDefault(); setClienteId(c.id); setClienteNombre(c.nombre); setCliSearch(c.nombre); setShowCliDrop(false) }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                    >
                      <p className="font-bold">{c.nombre}</p>
                      {c.telefono && <p className="text-xs text-gray-600">{c.telefono}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Destino</label>
            <select value={destino} onChange={(e) => { setDestino(e.target.value); autoNro(e.target.value) }} className="w-full border rounded px-3 py-2">
              <option value="">— seleccionar —</option>
              <option value="AR">Argentina (AR-###)</option>
              <option value="EB">eBay (EB-###)</option>
              <option value="US">EEUU (US-###)</option>
              <option value="INT">Internacional (INT-###)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Nro. venta</label>
            <input type="text" value={nroVenta} disabled className="w-full border rounded px-3 py-2 bg-gray-100" />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Estado pago</label>
            <select value={estadoPago} onChange={(e) => setEstadoPago(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">— —</option>
              <option value="Saldado">Saldado</option>
              <option value="Debe">Debe</option>
              <option value="Debemos">Debemos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cargar desde Pedidos Pendientes */}
      {clienteId && pedidosCliente.length > 0 && (
        <div className="bg-yellow-50 p-6 rounded-lg mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <List size={20} /> Pedidos pendientes de {clienteNombre}
          </h2>
          <div className="relative">
            <input
              type="text"
              value={searchPedido}
              onChange={e => { setSearchPedido(e.target.value); setShowPedidoDrop(true); }}
              onFocus={() => setShowPedidoDrop(true)}
              placeholder="Buscar pedido por descripción..."
              className="w-full border rounded px-3 py-2"
            />
            {showPedidoDrop && filtPedidos.length > 0 && (
              <div ref={pedidoDropRef} className="absolute top-full left-0 right-0 bg-white border rounded mt-1 shadow-lg z-10 max-h-48 overflow-y-auto">
                {filtPedidos.map((p: PedidoCliente) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={e => { e.preventDefault(); agregarPedidoComoVenta(p); }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                  >
                    <p className="font-bold">{p.descripcion}</p>
                    {(p.item_id || p.cotizacion_item_id) && <p className="text-sm text-gray-600">Vinculado a {p.item_id ? 'Inventario' : 'Cotización'}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


      {/* Items de la venta */}
      <div className="bg-gray-50 p-6 rounded-lg mb-8">
        <h2 className="text-lg font-bold mb-4">Ítems de esta venta</h2>

        {/* Buscador de ítems de inventario */}
        <div className="relative mb-6">
          <input
            type="text"
            value={itemSearch}
            onChange={(e) => buscarItems(e.target.value)}
            placeholder="Buscar ítems de inventario por producto, código, OEM..."
            className="w-full border rounded px-3 py-2"
            onFocus={() => { if (itemResults.length) setShowItemDrop(true) }}
          />
          {showItemDrop && itemResults.length > 0 && (
            <div ref={itemDropRef} className="absolute top-full left-0 right-0 bg-white border rounded mt-1 shadow-lg z-10 max-h-48 overflow-y-auto">
              {itemResults.map((x: any) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={(e) => { e.preventDefault(); agregarItem(x) }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                >
                  <p className="font-mono font-bold text-blue-600">{x.codigo}</p>
                  <p className="font-semibold">{x.producto}</p>
                  <p className="text-sm text-gray-600">{x.oem ? 'OEM: ' + x.oem + ' · ' : ''}Costo: {fmt(x.costo_total)} · {x.ubicacion}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {ventaItems.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Cargá un pedido pendiente, o buscá ítems del inventario, o agregá uno rápido.</p>
        ) : (
          <div className="space-y-4 mb-6">
            {ventaItems.map(x => (
              <div key={x.id} className="border rounded p-4 bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold flex-1">
                    {x.codigo ? (
                      <p><span className="font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">{x.codigo}</span> — {x.producto}</p>
                    ) : (
                      <p>{x.producto}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setVentaItems(p => p.filter(v => v.id !== x.id))}
                    className="text-red-600 hover:text-red-800 ml-4"
                  >
                    <X size={20} />
                  </button>
                </div>

                <p className="text-sm text-gray-600 mb-3">
                  {x.oem ? 'OEM: ' + x.oem + ' · ' : ''}Costo: {fmt(x.costoTotal)}
                  {x.tipo === 'pedido' && ' · Pedido'}
                  {x.tipo === 'inventario' && ' · Inventario'}
                  {x.tipo === 'rapido' && ' · Rápido'}
                </p>

                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-bold mb-1">Precio venta</label>
                    <input
                      type="number"
                      step="0.01"
                      value={x.precio}
                      onChange={(e) => setVentaItems(p => p.map(v => v.id === x.id ? { ...v, precio: parseFloat(e.target.value) || 0 } : v))}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <p className="font-bold text-green-600">{fmt(x.precio - x.costoTotal)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ítem rápido */}
      <div className="bg-yellow-50 p-6 rounded-lg mb-8">
        <h2 className="text-lg font-bold mb-4">Ítem rápido (no está en el inventario)</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-bold mb-1">Producto</label>
            <input type="text" value={rprod} onChange={(e) => setRprod(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Costo (USD)</label>
            <input type="number" step="0.01" value={rcosto} onChange={(e) => setRcosto(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Precio venta</label>
            <input type="number" step="0.01" value={rprecio} onChange={(e) => setRprecio(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">OEM</label>
            <input type="text" value={roem} onChange={(e) => setRoem(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <button type="button" onClick={agregarRapido} className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 font-bold">Agregar</button>
        </div>
      </div>

      {/* Totales */}
      <div className="bg-gray-50 p-6 rounded-lg mb-8">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-600 mb-2">Costo total</p>
            <p className="text-2xl font-bold text-red-600">{fmt(costo)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Total venta</p>
            <p className="text-2xl font-bold text-blue-600">{fmt(total)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Ganancia</p>
            <p className={`text-2xl font-bold ${total - costo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {total - costo >= 0 ? '+' : ''}{fmt(total - costo)}
            </p>
          </div>
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-4 justify-end">
        <button type="button" onClick={() => router.push('/dashboard')} className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Cancelar</button>
        <button
          type="button"
          onClick={confirmar}
          disabled={saving || ventaItems.length === 0}
          className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-bold"
        >
          {saving ? 'Guardando...' : 'Confirmar venta'}
        </button>
      </div>
    </div>
  )
}

export default function VentasPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Cargando...</div>}>
      <VentasForm />
    </Suspense>
  )
}
