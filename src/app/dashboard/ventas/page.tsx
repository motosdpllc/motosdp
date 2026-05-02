'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase, fmt, type Item, type Cliente } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Search, Plus, X } from 'lucide-react'

interface VentaItem {
  id: string; producto: string; oem?: string; codigo?: string
  costoTotal: number; precio: number; tipo: 'inventario' | 'rapido'
}

export default function VentasPage() {
  const router = useRouter()
  const cliDropRef = useRef<HTMLDivElement>(null)
  const itemDropRef = useRef<HTMLDivElement>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
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
  const [itemResults, setItemResults] = useState<Item[]>([])
  const [showItemDrop, setShowItemDrop] = useState(false)
  const [rprod, setRprod] = useState(''); const [rcosto, setRcosto] = useState('')
  const [rprecio, setRprecio] = useState(''); const [roem, setRoem] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('clientes').select('*').order('nombre').then(({ data }) => setClientes(data || []))
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (cliDropRef.current && !cliDropRef.current.contains(e.target as Node)) setShowCliDrop(false)
      if (itemDropRef.current && !itemDropRef.current.contains(e.target as Node)) setShowItemDrop(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtCli = clientes.filter(c => cliSearch && c.nombre.toLowerCase().includes(cliSearch.toLowerCase())).slice(0, 6)

  const autoNro = async (dest: string) => {
    if (!dest) { setNroVenta(''); return }
    const { data } = await supabase.from('counters').select('value').eq('key', 'venta_' + dest).single()
    setNroVenta(dest + '-' + String((data?.value||0)+1).padStart(3,'0'))
  }

  const buscarItems = async (q: string) => {
    setItemSearch(q)
    if (!q.trim()) { setItemResults([]); setShowItemDrop(false); return }
    const { data } = await supabase.from('items').select('*')
      .not('ubicacion','eq','Vendido').not('ubicacion','eq','Cancelado')
      .or(`producto.ilike.%${q}%,oem.ilike.%${q}%,codigo.ilike.%${q}%,nro_orden.ilike.%${q}%`)
      .limit(8)
    setItemResults((data||[]).filter(x => !ventaItems.find(v => v.id === x.id)))
    setShowItemDrop(true)
  }

  const agregarItem = (item: Item) => {
    setVentaItems(p => [...p, { id: item.id, producto: item.producto, oem: item.oem, codigo: item.codigo, costoTotal: item.costo_total||0, precio: item.precio_venta||0, tipo: 'inventario' }])
    setItemSearch(''); setItemResults([]); setShowItemDrop(false)
  }

  const agregarRapido = () => {
    if (!rprod.trim()) { toast.error('Ingresá el nombre del producto'); return }
    setVentaItems(p => [...p, { id: 'rapido_'+Date.now(), producto: rprod, oem: roem, costoTotal: parseFloat(rcosto)||0, precio: parseFloat(rprecio)||0, tipo: 'rapido' }])
    setRprod(''); setRcosto(''); setRprecio(''); setRoem('')
  }

  const total = ventaItems.reduce((a,x) => a+x.precio, 0)
  const costo = ventaItems.reduce((a,x) => a+x.costoTotal, 0)

  const confirmar = async () => {
    if (!ventaItems.length) { toast.error('Agregá al menos un ítem'); return }
    if (!destino) { toast.error('Seleccioná el destino'); return }
    setSaving(true)
    const { data: cnt } = await supabase.rpc('increment_counter', { counter_key: 'venta_'+destino })
    const nro = destino+'-'+String(cnt||1).padStart(3,'0')
    for (const vi of ventaItems) {
      if (vi.tipo === 'inventario') {
        await supabase.from('items').update({ ubicacion:'Vendido', precio_venta:vi.precio, ganancia:vi.precio-vi.costoTotal, cliente_id:clienteId||null, cliente_nombre:clienteNombre||null, nro_venta:nro, estado_pago:estadoPago||null, fecha_venta:fecha, updated_at:new Date().toISOString() }).eq('id', vi.id)
      } else {
        await supabase.from('items').insert({ producto:vi.producto, oem:vi.oem||null, costo_total:vi.costoTotal, precio_venta:vi.precio, ganancia:vi.precio-vi.costoTotal, cliente_id:clienteId||null, cliente_nombre:clienteNombre||null, nro_venta:nro, estado_pago:estadoPago||null, fecha_venta:fecha, ubicacion:'Vendido' })
      }
    }
    toast.success('✓ Venta '+nro+' registrada!')
    setSaving(false)
    router.push('/dashboard')
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Nueva venta</h1>

      <div className="card mb-4">
        <div className="text-sm font-semibold mb-4">Datos de la venta</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="label">Cliente</label>
            <div className="relative" ref={cliDropRef}>
              <input className="input" placeholder="Escribí para buscar cliente..." value={cliSearch}
                onChange={e => { setCliSearch(e.target.value); setShowCliDrop(true); if(!e.target.value){setClienteId('');setClienteNombre('')} }}
                onFocus={() => { if(cliSearch) setShowCliDrop(true) }} />
              {showCliDrop && filtCli.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1">
                  {filtCli.map(c => (
                    <div key={c.id} className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                      onMouseDown={e => { e.preventDefault(); setClienteId(c.id); setClienteNombre(c.nombre); setCliSearch(c.nombre); setShowCliDrop(false) }}>
                      <div className="font-medium text-sm">{c.nombre}</div>
                      <div className="text-xs text-gray-400">{c.telefono} {c.provincia?'· '+c.provincia:''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div><label className="label">Fecha</label><input className="input" type="date" value={fecha} onChange={e=>setFecha(e.target.value)} /></div>
          <div>
            <label className="label">Destino</label>
            <select className="input" value={destino} onChange={e => { setDestino(e.target.value); autoNro(e.target.value) }}>
              <option value="">— seleccionar —</option>
              <option value="AR">Argentina (AR-###)</option>
              <option value="EB">eBay (EB-###)</option>
              <option value="US">EEUU (US-###)</option>
              <option value="INT">Internacional (INT-###)</option>
            </select>
          </div>
          <div><label className="label">Nro. venta <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-1">auto</span></label><input className="input-readonly" readOnly value={nroVenta} placeholder="Se genera según destino" /></div>
          <div><label className="label">Estado $</label>
            <select className="input" value={estadoPago} onChange={e=>setEstadoPago(e.target.value)}>
              <option value="">—</option><option>Saldado</option><option>Debe</option><option>Debemos</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="text-sm font-semibold mb-3">Ítems de esta venta</div>
        <div className="relative mb-4" ref={itemDropRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input className="input pl-9" placeholder="Buscar ítem disponible por nombre, OEM, código, orden..."
            value={itemSearch} onChange={e => buscarItems(e.target.value)}
            onFocus={() => { if(itemResults.length) setShowItemDrop(true) }} />
          {showItemDrop && itemResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1 max-h-56 overflow-y-auto">
              {itemResults.map(x => (
                <div key={x.id} className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                  onMouseDown={e => { e.preventDefault(); agregarItem(x) }}>
                  <div className="font-medium text-sm">{x.producto} <span className="font-mono text-xs text-gray-400">{x.codigo}</span></div>
                  <div className="text-xs text-gray-400">{x.oem?'OEM: '+x.oem+' · ':''}Costo: {fmt(x.costo_total)} · {x.ubicacion}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {ventaItems.length === 0
          ? <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">Buscá ítems arriba para agregarlos a la venta</div>
          : ventaItems.map(x => (
            <div key={x.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-2 border border-gray-100">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{x.producto}
                  {x.codigo && <span className="font-mono text-xs text-gray-400 ml-1">{x.codigo}</span>}
                  {x.tipo==='rapido' && <span className="text-xs bg-gray-200 text-gray-500 px-1 rounded ml-1">rápido</span>}
                </div>
                <div className="text-xs text-gray-400">{x.oem?'OEM: '+x.oem+' · ':''}Costo: {fmt(x.costoTotal)}</div>
              </div>
              <div className="w-32 flex-shrink-0">
                <input type="number" step="0.01" placeholder="Precio USD" className="input text-sm"
                  value={x.precio||''} onChange={e => setVentaItems(p => p.map(v => v.id===x.id?{...v,precio:parseFloat(e.target.value)||0}:v))} />
              </div>
              <button onClick={() => setVentaItems(p=>p.filter(v=>v.id!==x.id))} className="btn btn-sm btn-danger flex-shrink-0"><X size={14}/></button>
            </div>
          ))
        }
      </div>

      <div className="card mb-4">
        <div className="text-sm font-semibold mb-3">Ítem rápido (no está en el inventario)</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2 md:col-span-4"><label className="label">Producto</label><input className="input" placeholder="Nombre del repuesto" value={rprod} onChange={e=>setRprod(e.target.value)} /></div>
          <div><label className="label">Costo (USD)</label><input className="input" type="number" step="0.01" placeholder="0.00" value={rcosto} onChange={e=>setRcosto(e.target.value)} /></div>
          <div><label className="label">Precio venta (USD)</label><input className="input" type="number" step="0.01" placeholder="0.00" value={rprecio} onChange={e=>setRprecio(e.target.value)} /></div>
          <div><label className="label">OEM</label><input className="input" placeholder="Opcional" value={roem} onChange={e=>setRoem(e.target.value)} /></div>
          <div className="flex items-end"><button onClick={agregarRapido} disabled={!rprod.trim()} className="btn btn-primary w-full justify-center"><Plus size={14}/> Agregar</button></div>
        </div>
      </div>

      <div className="bg-gray-900 text-white rounded-xl p-4 flex justify-between items-center mb-4">
        <div>
          <div className="text-gray-400 text-sm">Total venta</div>
          <div className={`text-sm mt-0.5 ${total-costo>=0?'text-green-400':'text-red-400'}`}>
            Ganancia: {total-costo>=0?'+':''}{fmt(total-costo)}
          </div>
        </div>
        <div className="text-3xl font-bold">{fmt(total)}</div>
      </div>

      <div className="flex gap-3">
        <button onClick={confirmar} disabled={saving||!ventaItems.length||!destino} className="btn btn-primary px-8">
          {saving ? 'Guardando...' : 'Confirmar venta'}
        </button>
        <button onClick={() => router.push('/dashboard')} className="btn">Cancelar</button>
      </div>
    </div>
  )
}
