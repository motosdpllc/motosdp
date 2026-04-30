'use client'
import { useState, useEffect } from 'react'
import { supabase, fmtDate, ubicColor, type Cliente, type Item, type PedidoCliente } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Search, Plus, Package, CheckCircle } from 'lucide-react'

export default function PedidosPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [selectedCli, setSelectedCli] = useState<Cliente | null>(null)
  const [search, setSearch] = useState('')
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([])
  const [itemsCli, setItemsCli] = useState<Item[]>([])
  const [nuevaDesc, setNuevaDesc] = useState('')
  const [searchCli, setSearchCli] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    supabase.from('clientes').select('*').order('nombre').then(({ data }) => setClientes(data || []))
  }, [])

  const filteredCli = clientes.filter(c => c.nombre.toLowerCase().includes(searchCli.toLowerCase())).slice(0, 6)

  const selectCliente = async (cli: Cliente) => {
    setSelectedCli(cli)
    setSearchCli(cli.nombre)
    setShowDropdown(false)
    // Load pedidos and items
    const [pedRes, itemRes] = await Promise.all([
      supabase.from('pedidos_cliente').select('*').eq('cliente_id', cli.id).order('created_at', { ascending: false }),
      supabase.from('items').select('*').eq('cliente_id', cli.id).order('created_at', { ascending: false })
    ])
    setPedidos(pedRes.data || [])
    setItemsCli(itemRes.data || [])
  }

  const agregarPedido = async () => {
    if (!nuevaDesc.trim() || !selectedCli) return
    // Try to find matching item
    const match = itemsCli.find(x => x.producto.toLowerCase().includes(nuevaDesc.toLowerCase()) && x.ubicacion !== 'Vendido')
    const { data } = await supabase.from('pedidos_cliente').insert({
      cliente_id: selectedCli.id,
      descripcion: nuevaDesc.trim(),
      item_id: match?.id || null,
    }).select().single()
    if (data) setPedidos(p => [data, ...p])
    setNuevaDesc('')
    toast.success('Ítem agregado al pedido')
  }

  const toggleEntregado = async (pedido: PedidoCliente) => {
    const { data } = await supabase.from('pedidos_cliente')
      .update({ entregado: !pedido.entregado, fecha_entrega: !pedido.entregado ? new Date().toISOString() : null })
      .eq('id', pedido.id).select().single()
    if (data) setPedidos(p => p.map(x => x.id === data.id ? data : x))
  }

  const eliminarPedido = async (id: string) => {
    await supabase.from('pedidos_cliente').delete().eq('id', id)
    setPedidos(p => p.filter(x => x.id !== id))
  }

  const getItemStatus = (pedido: PedidoCliente) => {
    const item = itemsCli.find(x => x.id === pedido.item_id)
    if (!item) return null
    return item.ubicacion
  }

  const pendientes = pedidos.filter(p => !p.entregado)
  const entregados = pedidos.filter(p => p.entregado)

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Pedidos de clientes</h1>

      {/* Buscar cliente */}
      <div className="card mb-6">
        <label className="label">Seleccioná un cliente</label>
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              className="input pl-9"
              placeholder="Buscar cliente..."
              value={searchCli}
              onChange={e => { setSearchCli(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
            />
          </div>
          {showDropdown && filteredCli.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1">
              {filteredCli.map(c => (
                <div key={c.id} onClick={() => selectCliente(c)} className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0">
                  <div className="font-medium">{c.nombre}</div>
                  <div className="text-xs text-gray-400">{c.telefono} {c.provincia ? '· ' + c.provincia : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedCli && (
        <>
          {/* Cliente header */}
          <div className="card mb-4 bg-gray-900 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-lg">{selectedCli.nombre}</div>
                <div className="text-gray-400 text-sm">{selectedCli.telefono} {selectedCli.provincia ? '· ' + selectedCli.provincia : ''}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{pendientes.length}</div>
                <div className="text-gray-400 text-xs">ítems pendientes</div>
              </div>
            </div>
          </div>

          {/* Agregar ítem al pedido */}
          <div className="card mb-4">
            <div className="text-sm font-semibold mb-3">Agregar ítem al pedido</div>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Ej: Pistón motor K88 GSXR600..."
                value={nuevaDesc}
                onChange={e => setNuevaDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') agregarPedido() }}
              />
              <button onClick={agregarPedido} disabled={!nuevaDesc.trim()} className="btn btn-primary">
                <Plus size={16} /> Agregar
              </button>
            </div>
          </div>

          {/* Pedido pendiente */}
          {pendientes.length > 0 && (
            <div className="card mb-4">
              <div className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3">⏳ Pendiente de entrega ({pendientes.length})</div>
              <div className="space-y-2">
                {pendientes.map(p => {
                  const status = getItemStatus(p)
                  return (
                    <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                      <button onClick={() => toggleEntregado(p)}
                        className="w-6 h-6 rounded border-2 border-gray-300 flex items-center justify-center hover:border-green-500 flex-shrink-0 transition-all">
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.descripcion}</div>
                        {status && (
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-0.5 ${ubicColor(status)}`}>{status}</span>
                        )}
                        {!status && <span className="text-xs text-gray-400">No encontrado en inventario</span>}
                      </div>
                      <button onClick={() => eliminarPedido(p.id)} className="btn btn-sm btn-danger text-xs flex-shrink-0">✕</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Entregados */}
          {entregados.length > 0 && (
            <div className="card mb-4 opacity-70">
              <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-3">✓ Entregado ({entregados.length})</div>
              <div className="space-y-1">
                {entregados.map(p => (
                  <div key={p.id} className="flex items-center gap-3 py-1.5">
                    <button onClick={() => toggleEntregado(p)}
                      className="w-6 h-6 rounded bg-green-500 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={14} className="text-white" />
                    </button>
                    <div className="text-sm line-through text-gray-400 flex-1 truncate">{p.descripcion}</div>
                    {p.fecha_entrega && <div className="text-xs text-gray-400">{fmtDate(p.fecha_entrega.split('T')[0])}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial de compras para este cliente */}
          {itemsCli.length > 0 && (
            <div className="card">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Historial de compras ({itemsCli.length})</div>
              <div className="space-y-1">
                {itemsCli.map(x => (
                  <div key={x.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{x.producto} <span className="font-mono text-xs text-gray-400">{x.codigo}</span></div>
                      <div className="text-xs text-gray-400">{x.nro_orden ? 'Orden: ' + x.nro_orden + ' · ' : ''}{fmtDate(x.fecha_compra)}</div>
                    </div>
                    <span className={`badge ${ubicColor(x.ubicacion)} text-xs`}>{x.ubicacion}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!selectedCli && (
        <div className="text-center py-16 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <div>Buscá un cliente para ver su nota de pedido</div>
        </div>
      )}
    </div>
  )
}
