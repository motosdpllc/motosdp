'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { supabase, fmt, fmtDate, type Item } from '@/lib/supabase'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

// --- UBICACIONES ---
// Las ubicaciones que representan Stock físico en el inventario para el filtro
const UBICACIONES_FILTRO = ['Proveedor','En tránsito','En tránsito a Daniel','Daniel','Pablo','Blue Mail','Tato','Tránsito a Bs As','En Mano','Stock EEUU', 'Stock España', 'Stock Argentina', 'Vendido', 'Cancelado', 'Entregado']

const DESTINOS = ['Stock EEUU', 'Stock España', 'Stock Argentina', 'Venta Argentina', 'Venta Internacional', 'Uso Propio', 'Stock Internacional'] // Usar los mismos destinos que en el form de NuevoItem

function InventarioTable() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [ubic, setUbic] = useState('')
  const [dest, setDest] = useState('')
  const [pub, setPub] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    const u = searchParams.get('ubicacion')
    if (u) setUbic(u)
  }, [searchParams])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Incluir pendiente_compra en el select
      let query = supabase.from('items').select('*, pendiente_compra').order('created_at', { ascending: false })
      if (ubic) query = query.eq('ubicacion', ubic)
      if (dest) query = query.eq('destino', dest)
      const { data } = await query.limit(500)
      let filtered = data || []
      if (search) {
        const q = search.toLowerCase()
        filtered = filtered.filter((x: any) =>
          (x.producto || '').toLowerCase().includes(q) ||
          (x.oem || '').toLowerCase().includes(q) ||
          (x.codigo || '').toLowerCase().includes(q) ||
          (x.nro_orden || '').toLowerCase().includes(q) ||
          (x.cliente_nombre || '').toLowerCase().includes(q) ||
          (x.tracking_compra || '').toLowerCase().includes(q)
        )
      }
      if (pub === 'si') filtered = filtered.filter((x: any) => x.plataforma)
      if (pub === 'no') filtered = filtered.filter((x: any) => !x.plataforma)
      setItems(filtered)
    } catch (err) {
      toast.error('Error al cargar inventario')
    }
    setLoading(false)
  }, [search, ubic, dest, pub])

  useEffect(() => { load() }, [load])

  const eliminarProducto = async (id: string) => {
    if (!confirm('¿Seguro que querés eliminar este producto? Esta acción no se puede deshacer.')) return
    try {
      const { error } = await supabase.from('items').delete().eq('id', id)
      if (error) throw error
      toast.success('Producto eliminado')
      load()
    } catch (error) {
      toast.error('No se pudo eliminar')
    }
  }

  const openTrackCompra = (id: string) => {
    const item = items.find((x: any) => x.id === id)
    if (!item) return
    const tracking = prompt('Tracking de compra:', item.tracking_compra || '')
    if (tracking === null) return
    const eta = prompt('ETA (YYYY-MM-DD):', item.eta || '')
    const linkTracking = prompt('Link de tracking:', item.link_tracking_compra || '')
    supabase.from('items').update({
      tracking_compra: tracking,
      eta: eta || null,
      link_tracking_compra: linkTracking || null,
      updated_at: new Date().toISOString()
    }).eq('id', id).then(() => load())
  }

  const openTrackVenta = (id: string) => {
    const item = items.find((x: any) => x.id === id)
    if (!item) return
    const tracking = prompt('Tracking de envío:', item.tracking_venta || '')
    if (tracking === null) return
    supabase.from('items').update({
      tracking_venta: tracking,
      updated_at: new Date().toISOString()
    }).eq('id', id).then(() => load())
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Inventario</h1>
          <a href="/dashboard/nuevo" className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold">
            + Nuevo ítem
          </a>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6 grid grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <select value={ubic} onChange={(e) => setUbic(e.target.value)} className="w-full border rounded px-3 py-2">
            <option value="">Todas las ubicaciones</option>
            {UBICACIONES_FILTRO.map(u => (<option key={u} value={u}>{u}</option>))}
          </select>
          <select value={dest} onChange={(e) => setDest(e.target.value)} className="w-full border rounded px-3 py-2">
            <option value="">Todos los destinos</option>
            {DESTINOS.map(d => (<option key={d} value={d}>{d}</option>))}
          </select>
          <select value={pub} onChange={(e) => setPub(e.target.value)} className="w-full border rounded px-3 py-2">
            <option value="">Toda publicación</option>
            <option value="si">Publicados</option>
            <option value="no">No publicados</option>
          </select>
        </div>

        <p className="text-sm text-gray-600 mb-4">{items.length} ítem{items.length !== 1 ? 's' : ''}</p>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="px-3 py-2 text-left font-bold">Código</th>
                <th className="px-3 py-2 text-left font-bold">Producto</th>
                <th className="px-3 py-2 text-left font-bold">OEM</th>
                <th className="px-3 py-2 text-left font-bold">Orden</th>
                <th className="px-3 py-2 text-left font-bold">T.Compra</th>
                <th className="px-3 py-2 text-left font-bold">ETA</th>
                <th className="px-3 py-2 text-left font-bold">T.Envío</th>
                <th className="px-3 py-2 text-left font-bold">Pub</th>
                <th className="px-3 py-2 text-center font-bold">Costo</th>
                <th className="px-3 py-2 text-center font-bold">Venta</th>
                <th className="px-3 py-2 text-center font-bold">Gan.</th>
                <th className="px-3 py-2 text-left font-bold">Ubicación</th>
                <th className="px-3 py-2 text-left font-bold">Destino</th>
                <th className="px-3 py-2 text-left font-bold">Estado$</th>
                <th className="px-3 py-2 text-left font-bold">Cliente</th>
                <th className="px-3 py-2 text-center font-bold">Pendiente</th>
                <th className="px-3 py-2 text-center font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={17} className="px-6 py-4 text-center text-gray-500">Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={17} className="px-6 py-4 text-center text-gray-500">No hay ítems que coincidan</td></tr>
              ) : items.map((x: any) => {
                const costo = x.costo_total || 0
                const venta = x.precio_venta || 0
                const gan = venta - costo
                return (
                  <tr key={x.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono font-bold text-blue-600">{x.codigo || '—'}</td>
                    <td className="px-3 py-2">{x.producto}</td>
                    <td className="px-3 py-2 text-xs">{x.oem || '—'}</td>
                    <td className="px-3 py-2 text-xs">{x.nro_orden || '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      {x.tracking_compra ? x.tracking_compra.substring(0, 10) + '…' : '—'}
                      <a href={x.link_tracking_compra} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-500 hover:text-blue-700 text-xs">
                        📦
                      </a>
                    </td>
                    <td className="px-3 py-2 text-xs">{fmtDate(x.eta)}</td>
                    <td className="px-3 py-2 text-xs">
                      {x.tracking_venta ? x.tracking_venta.substring(0, 8) + '…' : '—'}
                      <button type="button" onClick={() => openTrackVenta(x.id)} className="ml-1 text-green-500 hover:text-green-700 text-xs">
                        🚚
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs">{x.plataforma ? x.plataforma : '—'}</td>
                    <td className="px-3 py-2 text-center font-bold">{costo > 0 ? fmt(costo) : '—'}</td>
                    <td className="px-3 py-2 text-center font-bold">{venta > 0 ? fmt(venta) : '—'}</td>
                    <td className={`px-3 py-2 text-center font-bold ${gan > 0 ? 'text-green-600' : gan < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {venta > 0 ? (gan >= 0 ? '+' : '') + fmt(gan) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">{x.ubicacion || '—'}</td>
                    <td className="px-3 py-2 text-xs">{x.destino || '—'}</td>
                    <td className="px-3 py-2 text-xs">{x.estado_pago || '—'}</td>
                    <td className="px-3 py-2 text-xs">{x.cliente_nombre || '—'}</td>
                    <td className="px-3 py-2 text-center font-bold">
                      {x.pendiente_compra ? '⏳' : '—'}
                    </td>
                    <td className="px-3 py-2 text-center space-x-1">
                      <a href={`/dashboard/nuevo?edit=${x.id}`} className="text-blue-500 hover:text-blue-700 text-xs">
                        ✏️
                      </a>
                      <button
                        type="button"
                        onClick={() => eliminarProducto(x.id)}
                        className="text-red-500 hover:text-red-700 text-xs ml-1"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function InventarioPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Cargando...</div>}>
      <InventarioTable />
    </Suspense>
  )
}
