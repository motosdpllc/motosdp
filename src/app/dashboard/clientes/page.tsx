'use client'
import { useState, useEffect } from 'react'
import { supabase, fmt, fmtDate, ubicColor, type Cliente, type Item } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Users, Plus, Search, Phone, MapPin, X, ChevronRight, Package, ShoppingCart } from 'lucide-react'

const PROVINCIAS = ['Buenos Aires','CABA','Catamarca','Chaco','Chubut','Córdoba','Corrientes','Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán','Otro país']
const EMPTY = { nombre:'', telefono:'', direccion:'', codigo_postal:'', provincia:'', notas:'' }

type Vista = 'agenda' | 'form' | 'detalle'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [form, setForm] = useState<typeof EMPTY>(EMPTY)
  const [editId, setEditId] = useState<string|null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<Vista>('agenda')
  const [selectedCli, setSelectedCli] = useState<Cliente|null>(null)
  const [itemsCli, setItemsCli] = useState<Item[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    setClientes(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const guardar = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    if (editId) {
      await supabase.from('clientes').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editId)
      toast.success('Cliente actualizado')
    } else {
      await supabase.from('clientes').insert(form)
      toast.success('Cliente creado')
    }
    setForm(EMPTY); setEditId(null); setVista('agenda'); load()
  }

  const editar = (c: Cliente) => {
    setEditId(c.id)
    setForm({ nombre:c.nombre, telefono:c.telefono||'', direccion:c.direccion||'', codigo_postal:c.codigo_postal||'', provincia:c.provincia||'', notas:c.notas||'' })
    setVista('form')
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    toast.success('Eliminado')
    setVista('agenda')
    load()
  }

  const verDetalle = async (c: Cliente) => {
    setSelectedCli(c)
    setVista('detalle')
    setLoadingItems(true)
    const { data } = await supabase.from('items').select('*')
      .or(`cliente_id.eq.${c.id},cliente_nombre.ilike.${c.nombre}`)
      .order('created_at', { ascending: false })
    setItemsCli(data || [])
    setLoadingItems(false)
  }

  const filtered = clientes.filter(c =>
    !search || c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.telefono||'').includes(search) || (c.provincia||'').toLowerCase().includes(search.toLowerCase())
  )

  // Agrupar por letra
  const agrupados: Record<string, Cliente[]> = {}
  filtered.forEach(c => {
    const letra = c.nombre[0].toUpperCase()
    if (!agrupados[letra]) agrupados[letra] = []
    agrupados[letra].push(c)
  })

  const iniciales = (nombre: string) => nombre.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()

  const colores = ['bg-blue-500','bg-green-500','bg-purple-500','bg-orange-500','bg-pink-500','bg-teal-500','bg-indigo-500','bg-red-500']
  const colorCli = (nombre: string) => colores[nombre.charCodeAt(0) % colores.length]

  // DETALLE
  if (vista === 'detalle' && selectedCli) {
    const vendidos = itemsCli.filter(x => x.ubicacion === 'Vendido')
    const enTransito = itemsCli.filter(x => x.ubicacion?.includes('ránsito'))
    const totalComprado = itemsCli.reduce((a,x) => a+(x.costo_total||0), 0)
    const totalVendido = vendidos.reduce((a,x) => a+(x.precio_venta||0), 0)

    return (
      <div className="p-6 max-w-3xl">
        <button onClick={() => setVista('agenda')} className="btn mb-4">← Volver a agenda</button>

        {/* Header cliente */}
        <div className="card mb-4 bg-gray-900 text-white">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-full ${colorCli(selectedCli.nombre)} flex items-center justify-center text-white text-xl font-bold flex-shrink-0`}>
              {iniciales(selectedCli.nombre)}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{selectedCli.nombre}</h2>
              {selectedCli.telefono && (
                <a href={`tel:${selectedCli.telefono}`} className="flex items-center gap-1.5 text-gray-300 text-sm mt-1 hover:text-white">
                  <Phone size={13}/> {selectedCli.telefono}
                </a>
              )}
              {selectedCli.direccion && (
                <div className="flex items-center gap-1.5 text-gray-400 text-sm mt-0.5">
                  <MapPin size={13}/> {selectedCli.direccion} {selectedCli.codigo_postal ? '('+selectedCli.codigo_postal+')' : ''} {selectedCli.provincia ? '· '+selectedCli.provincia : ''}
                </div>
              )}
              {selectedCli.notas && <div className="text-gray-400 text-xs mt-1 italic">{selectedCli.notas}</div>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => editar(selectedCli)} className="btn btn-sm bg-white/10 text-white border-white/20 hover:bg-white/20">Editar</button>
              <button onClick={() => eliminar(selectedCli.id)} className="btn btn-sm bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30">Eliminar</button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="card text-center">
            <div className="text-2xl font-bold text-gray-900">{itemsCli.length}</div>
            <div className="text-xs text-gray-500 mt-1">Ítems totales</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-amber-600">{enTransito.length}</div>
            <div className="text-xs text-gray-500 mt-1">En tránsito</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-green-600">{vendidos.length}</div>
            <div className="text-xs text-gray-500 mt-1">Vendidos</div>
          </div>
        </div>

        {/* WhatsApp rápido */}
        {selectedCli.telefono && (
          <div className="mb-4">
            <a
              href={`https://wa.me/${selectedCli.telefono.replace(/\D/g,'')}?text=Hola ${selectedCli.nombre.split(' ')[0]}!`}
              target="_blank"
              className="btn btn-success w-full justify-center"
            >
              💬 Abrir WhatsApp
            </a>
          </div>
        )}

        {/* Historial */}
        <div className="card">
          <div className="text-sm font-semibold mb-4">Historial de compras</div>
          {loadingItems ? (
            <div className="text-center py-8 text-gray-400">Cargando...</div>
          ) : itemsCli.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Package size={32} className="mx-auto mb-2 opacity-30"/>
              <div>Sin ítems registrados</div>
            </div>
          ) : (
            <div className="space-y-1">
              {itemsCli.map(x => (
                <div key={x.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{x.producto}
                      {x.codigo && <span className="font-mono text-xs text-gray-400 ml-1">{x.codigo}</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {x.nro_orden ? 'Orden: '+x.nro_orden+' · ' : ''}
                      {x.nro_venta ? 'Venta: '+x.nro_venta+' · ' : ''}
                      {fmtDate(x.fecha_compra)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-medium">{x.precio_venta ? fmt(x.precio_venta) : fmt(x.costo_total)}</div>
                    <span className={`badge text-xs ${ubicColor(x.ubicacion)}`}>{x.ubicacion}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // FORM
  if (vista === 'form') return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => { setForm(EMPTY); setEditId(null); setVista('agenda') }} className="btn mb-4">← Volver</button>
      <h1 className="text-2xl font-bold mb-6">{editId ? 'Editar cliente' : 'Nuevo cliente'}</h1>
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><label className="label">Nombre *</label><input className="input" placeholder="Nombre completo" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} /></div>
          <div><label className="label">Teléfono</label><input className="input" placeholder="+54 11 ..." value={form.telefono} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))} /></div>
          <div><label className="label">Dirección</label><input className="input" placeholder="Calle y número" value={form.direccion} onChange={e=>setForm(p=>({...p,direccion:e.target.value}))} /></div>
          <div><label className="label">Código postal</label><input className="input" placeholder="1708" value={form.codigo_postal} onChange={e=>setForm(p=>({...p,codigo_postal:e.target.value}))} /></div>
          <div><label className="label">Provincia</label>
            <select className="input" value={form.provincia} onChange={e=>setForm(p=>({...p,provincia:e.target.value}))}>
              <option value="">— opcional —</option>
              {PROVINCIAS.map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="md:col-span-2"><label className="label">Notas</label><input className="input" placeholder="Opcional" value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} /></div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={guardar} disabled={!form.nombre.trim()} className="btn btn-primary">{editId ? 'Actualizar' : 'Guardar cliente'}</button>
          <button onClick={() => { setForm(EMPTY); setEditId(null); setVista('agenda') }} className="btn">Cancelar</button>
        </div>
      </div>
    </div>
  )

  // AGENDA
  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-gray-700"/>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <span className="text-gray-400 text-sm">({clientes.length})</span>
        </div>
        <button onClick={() => { setForm(EMPTY); setEditId(null); setVista('form') }} className="btn btn-primary">
          <Plus size={16}/> Nuevo cliente
        </button>
      </div>

      {/* Búsqueda */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
        <input className="input pl-10 text-base" placeholder="Buscar por nombre, teléfono, provincia..."
          value={search} onChange={e=>setSearch(e.target.value)} autoFocus />
        {search && <button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={16}/></button>}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30"/>
          <div>{search ? 'No se encontraron clientes' : 'No hay clientes aún'}</div>
        </div>
      ) : search ? (
        // Vista búsqueda - lista simple
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="card flex items-center gap-3 cursor-pointer hover:border-gray-400 transition-all" onClick={() => verDetalle(c)}>
              <div className={`w-10 h-10 rounded-full ${colorCli(c.nombre)} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>{iniciales(c.nombre)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{c.nombre}</div>
                <div className="text-xs text-gray-500">{c.telefono?c.telefono+' · ':''}{c.provincia||''}</div>
              </div>
              <ChevronRight size={18} className="text-gray-400 flex-shrink-0"/>
            </div>
          ))}
        </div>
      ) : (
        // Vista agenda - agrupada por letra
        <div>
          {Object.entries(agrupados).sort(([a],[b])=>a.localeCompare(b)).map(([letra, clis]) => (
            <div key={letra} className="mb-4">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 py-1 mb-1 border-b border-gray-200">{letra}</div>
              <div className="space-y-1">
                {clis.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-all" onClick={() => verDetalle(c)}>
                    <div className={`w-9 h-9 rounded-full ${colorCli(c.nombre)} flex items-center justify-center text-white font-semibold text-xs flex-shrink-0`}>{iniciales(c.nombre)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{c.nombre}</div>
                      <div className="text-xs text-gray-400">{c.telefono || (c.provincia || '')}</div>
                    </div>
                    {c.telefono && (
                      <a href={`tel:${c.telefono}`} onClick={e=>e.stopPropagation()} className="p-1.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-green-600 transition-all flex-shrink-0">
                        <Phone size={15}/>
                      </a>
                    )}
                    <ChevronRight size={16} className="text-gray-300 flex-shrink-0"/>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
