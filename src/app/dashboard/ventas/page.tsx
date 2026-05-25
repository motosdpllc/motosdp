'use client'
import { useState, useEffect } from 'react'
import { supabase, fmt, type Item } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

interface VentaItem {
  id: string
  producto: string
  oem?: string
  codigo?: string
  costoTotal: number
  precio: number
  tipo: 'inventario' | 'rapido' | 'cotizacion'
}

function VentasForm() {
  const router = useRouter()
  const [clientes, setClientes] = useState<any>([])
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
  const [itemResults, setItemResults] = useState<any>([])
  const [showItemDrop, setShowItemDrop] = useState(false)
  const [rprod, setRprod] = useState('')
  const [rcosto, setRcosto] = useState('')
  const [rprecio, setRprecio] = useState('')
  const [roem, setRoem] = useState('')
  const [saving, setSaving] = useState(false)
  const [cotizaciones, setCotizaciones] = useState<any>([])
  const [showCotDrop, setShowCotDrop] = useState(false)
  const [cotSearch, setCotSearch] = useState('')

  useEffect(() => {
    supabase.from('clientes').select('*').order('nombre').then(({ data }) => setClientes(data || []))
    supabase.from('cotizaciones').select('*, cotizacion_items(*)').order('created_at', { ascending: false }).then(({ data }) => setCotizaciones(data || []))
  }, [])

  const filtCli = clientes.filter((c: any) => cliSearch && c.nombre.toLowerCase().includes(cliSearch.toLowerCase())).slice(0, 6)
  const filtCot = cotizaciones.filter((c: any) =>
    !cotSearch || (c.nro || '').toLowerCase().includes(cotSearch.toLowerCase()) || (c.cliente_nombre || '').toLowerCase().includes(cotSearch.toLowerCase())
  ).slice(0, 6)

  const autoNro = async (dest: string) => {
    if (!dest) { setNroVenta(''); return }
    const { data } = await supabase.from('counters').select('value').eq('key', 'venta_' + dest).single()
    setNroVenta(dest + '-' + String((data?.value || 0) + 1).padStart(3, '0'))
  }

  const cargarCotizacion = (cot: any) => {
    if (cot.cliente_nombre) { setClienteNombre(cot.cliente_nombre); setCliSearch(cot.cliente_nombre); setClienteId(cot.cliente_id || '') }
    const items: VentaItem[] = (cot.cotizacion_items || []).map((it: any) => ({
      id: 'cot_' + it.id + '_' + Date.now(),
      producto: it.descripcion || '',
      codigo: it.codigo || '',
      costoTotal: it.subtotal || 0,
      precio: it.precio_venta || it.subtotal || 0,
      tipo: 'cotizacion' as const
    }))
    setVentaItems(items)
    setShowCotDrop(false)
    setCotSearch('')
    toast.success(`Cotización ${cot.nro} cargada`)
  }

  const buscarItems = async (q: string) => {
    setItemSearch(q)
    if (!q.trim()) { setItemResults([]); setShowItemDrop(false); return }
    const { data } = await supabase.from('items').select('*')
      .not('ubicacion', 'eq', 'Vendido').not('ubicacion', 'eq', 'Cancelado')
      .or(`producto.ilike.%${q}%,oem.ilike.%${q}%,codigo.ilike.%${q}%,nro_orden.ilike.%${q}%`)
      .limit(8)
    setItemResults((data || []).filter((x: any) => !ventaItems.find(v => v.id === x.id)))
    setShowItemDrop(true)
  }

  const agregarItem = (item: Item) => {
    setVentaItems(p => [...p, { id: item.id, producto: item.producto, oem: item.oem, codigo: item.codigo, costoTotal: item.costo_total || 0, precio: item.precio_venta || 0, tipo: 'inventario' }])
    setItemSearch(''); setItemResults([]); setShowItemDrop(false)
  }

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
      } else {
        await supabase.from('items').insert({
          producto: vi.producto, oem: vi.oem || null, codigo: vi.codigo || null,
          costo_total: vi.costoTotal, precio_venta: vi.precio, ganancia: vi.precio - vi.costoTotal,
          cliente_id: clienteId || null, cliente_nombre: clienteNombre || null,
          nro_venta: nro, estado_pago: estadoPago || null, fecha_venta: fecha,
          ubicacion: 'Vendido',
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

      <div className="bg-blue-50 p-6 rounded-lg mb-8">
        <h2 className="text-lg font-bold mb-4">📋 Cargar desde cotización</h2>
        <div className="relative">
          <input
            type="text"
            value={cotSearch}
            onChange={(e) => { setCotSearch(e.target.value); setShowCotDrop(true) }}
            placeholder="Buscar cotización por nro o cliente..."
            className="w-full border rounded px-3 py-2"
            onFocus={() => setShowCotDrop(true)}
          />
          {showCotDrop && filtCot.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border rounded mt-1 shadow-lg z-10 max-h-48 overflow-y-auto">
              {filtCot.map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={(e) => { e.preventDefault(); cargarCotizacion(c) }}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0"
                >
                  <p className="font-bold">{c.nro} — {c.cliente_nombre || 'Sin cliente'}</p>
                  <p className="text-sm text-gray-600">{c.cotizacion_items?.length || 0} ítems · {c.precio_final ? fmt(c.precio_final) : 'Sin precio final'}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

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
                <div className="absolute top-full left-0 right-0 bg-white border rounded mt-1 shadow-lg z-10 max-h-48 overflow-y-auto">
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

      <div className="bg-gray-50 p-6 rounded-lg mb-8">
        <h2 className="text-lg font-bold mb-4">Ítems de esta venta</h2>

        <div className="relative mb-6">
          <input
            type="text"
            value={itemSearch}
            onChange={(e) => buscarItems(e.target.value)}
            placeholder="Buscar por producto, código, OEM..."
            className="w-full border rounded px-3 py-2"
            onFocus={() => { if (itemResults.length) setShowItemDrop(true) }}
          />
          {showItemDrop && itemResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border rounded mt-1 shadow-lg z-10 max-h-48 overflow-y-auto">
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
          <p className="text-gray-500 text-center py-8">Cargá una cotización arriba o buscá ítems del inventario</p>
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
                  {x.tipo === 'cotizacion' && ' · cotización'}
                  {x.tipo === 'rapido' && ' · rápido'}
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
    <div className="min-h-screen bg-gray-50 p-6">
      <VentasForm />
    </div>
  )
}
