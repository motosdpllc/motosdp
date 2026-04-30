'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { supabase, fmt, fmtDate, ubicColor, type Item } from '@/lib/supabase'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const UBICACIONES = ['Proveedor','En tránsito','En tránsito a Daniel','Daniel','Pablo','Blue Mail','Tato','Tránsito a Bs As','En Mano','Vendido','Cancelado']
const DESTINOS = ['Argentina','Stock EEUU','Uso propio','Stock Argentina','Stock Internacional']

function InventarioTable() {
  const [items, setItems] = useState<Item[]>([])
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
    let query = supabase.from('items').select('*').order('created_at', { ascending: false })
    if (ubic) query = query.eq('ubicacion', ubic)
    if (dest) query = query.eq('destino', dest)
    const { data } = await query.limit(500)
    let filtered = data || []
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(x =>
        (x.producto || '').toLowerCase().includes(q) ||
        (x.oem || '').toLowerCase().includes(q) ||
        (x.codigo || '').toLowerCase().includes(q) ||
        (x.nro_orden || '').toLowerCase().includes(q) ||
        (x.cliente_nombre || '').toLowerCase().includes(q) ||
        (x.tracking_compra || '').toLowerCase().includes(q)
      )
    }
    if (pub === 'si') filtered = filtered.filter(x => x.plataforma)
    if (pub === 'no') filtered = filtered.filter(x => !x.plataforma)
    setItems(filtered)
    setLoading(false)
  }, [search, ubic, dest, pub])

  useEffect(() => { load() }, [load])

  const openTrackCompra = (id: string) => {
    const item = items.find(x => x.id === id)
    if (!item) return
    const tracking = prompt('Tracking de compra:', item.tracking_compra || '')
    if (tracking === null) return
    const eta = prompt('ETA (YYYY-MM-DD):', item.eta || '')
    const linkTracking = prompt('Link de tracking:', item.link_tracking_compra || '')
    supabase.from('items').update({
      tracking_compra: tracking,
      eta: eta || null,
      link_tracking_compra: linkTracking || null,
      ubicacion: tracking ? (item.peso && item.peso > 0 ? 'En Mano' : 'En tránsito a Daniel') : 'Proveedor',
      updated_at: new Date().toISOString()
    }).eq('id', id).then(() => load())
  }

  const openTrackVenta = (id: string) => {
    const item = items.find(x => x.id === id)
    if (!item) return
    const tracking = prompt('Tracking de envío:', item.tracking_venta || '')
    if (tracking === null) return
    supabase.from('items').update({
      tracking_venta: tracking,
      updated_at: new Date().toISOString()
    }).eq('id', id).then(() => load())
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Inventario</h1>
        <Link href="/dashboard/nuevo" className="btn btn-primary">+ Nuevo ítem</Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap mb-4">
        <input className="input flex-1 min-w-48" placeholder="Buscar producto, OEM, código, orden, cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-auto" value={ubic} onChange={e => setUbic(e.target.value)}>
          <option value="">Todas las ubicaciones</option>
          {UBICACIONES.map(u => <option key={u}>{u}</option>)}
        </select>
        <select className="input w-auto" value={dest} onChange={e => setDest(e.target.value)}>
          <option value="">Todos los destinos</option>
          {DESTINOS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="input w-auto" value={pub} onChange={e => setPub(e.target.value)}>
          <option value="">Toda publicación</option>
          <option value="si">Publicados</option>
          <option value="no">No publicados</option>
        </select>
      </div>

      <div className="text-xs text-gray-400 mb-2">{items.length} ítem{items.length !== 1 ? 's' : ''}</div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Código</th>
                <th className="table-header">Producto</th>
                <th className="table-header">OEM</th>
                <th className="table-header">Orden</th>
                <th className="table-header">T.Compra</th>
                <th className="table-header">ETA</th>
                <th className="table-header">T.Envío</th>
                <th className="table-header">Publicado</th>
                <th className="table-header">Costo</th>
                <th className="table-header">Venta</th>
                <th className="table-header">Gan.</th>
                <th className="table-header">Ubicación</th>
                <th className="table-header">Destino</th>
                <th className="table-header">Estado$</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={16} className="text-center py-8 text-gray-400">Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={16} className="text-center py-8 text-gray-400">No hay ítems que coincidan</td></tr>
              ) : items.map(x => {
                const gan = x.ganancia || 0
                return (
                  <tr key={x.id} className="hover:bg-gray-50">
                    <td className="table-cell font-mono text-xs">{x.codigo || '—'}</td>
                    <td className="table-cell max-w-32 truncate font-medium" title={x.producto}>{x.producto}</td>
                    <td className="table-cell text-xs">{x.oem || '—'}</td>
                    <td className="table-cell text-xs">{x.nro_orden || '—'}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${x.tracking_compra ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                        <span className="text-xs truncate max-w-20">{x.tracking_compra ? x.tracking_compra.substring(0,10)+'…' : '—'}</span>
                        <button onClick={() => openTrackCompra(x.id)} className="btn btn-sm text-xs px-1.5 py-0.5">📦</button>
                      </div>
                    </td>
                    <td className="table-cell text-xs">{fmtDate(x.eta)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${x.tracking_venta ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                        <span className="text-xs">{x.tracking_venta ? x.tracking_venta.substring(0,8)+'…' : '—'}</span>
                        <button onClick={() => openTrackVenta(x.id)} className="btn btn-sm text-xs px-1.5 py-0.5">🚚</button>
                      </div>
                    </td>
                    <td className="table-cell">
                      {x.plataforma ? (
                        <span className="badge bg-blue-100 text-blue-700 text-xs">{x.plataforma}</span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="table-cell text-xs">{fmt(x.costo_total)}</td>
                    <td className="table-cell text-xs">{x.precio_venta ? fmt(x.precio_venta) : '—'}</td>
                    <td className={`table-cell text-xs font-semibold ${gan >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {x.precio_venta ? (gan >= 0 ? '+' : '') + fmt(gan) : '—'}
                    </td>
                    <td className="table-cell">
                      <span className={`badge text-xs ${ubicColor(x.ubicacion)}`}>{x.ubicacion || '—'}</span>
                    </td>
                    <td className="table-cell text-xs">{x.destino || '—'}</td>
                    <td className="table-cell text-xs">{x.estado_pago || '—'}</td>
                    <td className="table-cell text-xs max-w-24 truncate">{x.cliente_nombre || '—'}</td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <Link href={`/dashboard/nuevo?edit=${x.id}`} className="btn btn-sm text-xs">✏️</Link>
                      </div>
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
    <Suspense fallback={<div className="p-6 text-gray-400">Cargando...</div>}>
      <InventarioTable />
    </Suspense>
  )
}
