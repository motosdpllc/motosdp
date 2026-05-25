'use client'
import { useState, useEffect } from 'react'
import { supabase, fmt, fmtDate, type Cliente, type Item } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Phone, MapPin, X } from 'lucide-react'

const PROVINCIAS = ['Buenos Aires','CABA','Catamarca','Chaco','Chubut','Córdoba','Corrientes','Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán','Otro país']
const EMPTY = { nombre:'', telefono:'', direccion:'', codigo_postal:'', provincia:'', notas:'' }
type Vista = 'agenda' | 'form' | 'detalle'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any>([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<Vista>('agenda')
  const [selectedCli, setSelectedCli] = useState<Cliente | null>(null)
  const [itemsCli, setItemsCli] = useState<any>([])
  const [cotsCli, setCotsCli] = useState<any>([])
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    setClientes(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const guardar = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    try {
      if (editId) {
        await supabase.from('clientes').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editId)
        toast.success('Cliente actualizado')
      } else {
        await supabase.from('clientes').insert([form])
        toast.success('Cliente creado')
      }
      setForm(EMPTY)
      setEditId(null)
      setVista('agenda')
      load()
    } catch (err) {
      toast.error('Error al guardar')
    }
  }

  const editar = (c: Cliente) => {
    setEditId(c.id)
    setForm({
      nombre: c.nombre,
      telefono: c.telefono || '',
      direccion: c.direccion || '',
      codigo_postal: c.codigo_postal || '',
      provincia: c.provincia || '',
      notas: c.notas || ''
    })
    setVista('form')
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return
    try {
      await supabase.from('clientes').delete().eq('id', id)
      toast.success('Cliente eliminado')
      setVista('agenda')
      load()
    } catch (err) {
      toast.error('Error al eliminar')
    }
  }

  const verDetalle = async (c: Cliente) => {
    setSelectedCli(c)
    setVista('detalle')
    setLoadingDetalle(true)
    try {
      const [itemsRes, cotsRes] = await Promise.all([
        supabase.from('items').select('*').or(`cliente_id.eq.${c.id},cliente_nombre.ilike.${c.nombre}`).order('created_at', { ascending: false }),
        supabase.from('cotizaciones').select('*, cotizacion_items(*)').or(`cliente_id.eq.${c.id},cliente_nombre.ilike.${c.nombre}`).order('created_at', { ascending: false })
      ])
      setItemsCli(itemsRes.data || [])
      setCotsCli(cotsRes.data || [])
    } catch (err) {
      toast.error('Error al cargar detalles')
    }
    setLoadingDetalle(false)
  }

  const filtered = clientes.filter((c: any) =>
    !search || c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.telefono || '').includes(search) || (c.provincia || '').toLowerCase().includes(search.toLowerCase())
  )

  const agrupados: Record<string, any[]> = {}
  filtered.forEach((c: any) => {
    const letra = c.nombre[0].toUpperCase()
    if (!agrupados[letra]) agrupados[letra] = []
    agrupados[letra].push(c)
  })

  const iniciales = (n: string) => n.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()
  const colores = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500']
  const colorCli = (n: string) => colores[n.charCodeAt(0) % colores.length]

  // VISTA DETALLE
  if (vista === 'detalle' && selectedCli) {
    const vendidos = itemsCli.filter((x: any) => x.ubicacion === 'Vendido')
    const enTransito = itemsCli.filter((x: any) => (x.ubicacion || '').includes('ránsito'))

    return (
      <div className="max-w-4xl mx-auto p-6">
        <button type="button" onClick={() => setVista('agenda')} className="mb-6 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
          ← Volver
        </button>

        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-8 mb-6">
          <div className="flex items-start gap-4">
            <div className={`${colorCli(selectedCli.nombre)} w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white`}>
              {iniciales(selectedCli.nombre)}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{selectedCli.nombre}</h1>
              {selectedCli.telefono && (
                <p className="flex items-center gap-2 mt-2 text-blue-100">
                  <Phone size={16} /> {selectedCli.telefono}
                </p>
              )}
              {selectedCli.direccion && (
                <p className="flex items-center gap-2 mt-1 text-blue-100">
                  <MapPin size={16} /> {selectedCli.direccion} {selectedCli.codigo_postal ? '(' + selectedCli.codigo_postal + ')' : ''} {selectedCli.provincia ? '· ' + selectedCli.provincia : ''}
                </p>
              )}
              {selectedCli.notas && (
                <p className="mt-3 italic text-blue-100">{selectedCli.notas}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => editar(selectedCli)}
                className="px-4 py-2 bg-white/20 text-white rounded hover:bg-white/30 font-bold text-sm"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => eliminar(selectedCli.id)}
                className="px-4 py-2 bg-red-500/30 text-red-100 rounded hover:bg-red-500/40 font-bold text-sm"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{itemsCli.length}</p>
            <p className="text-gray-600 text-sm">Ítems totales</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-3xl font-bold text-orange-600">{enTransito.length}</p>
            <p className="text-gray-600 text-sm">En tránsito</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{vendidos.length}</p>
            <p className="text-gray-600 text-sm">Vendidos</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-3xl font-bold text-purple-600">{cotsCli.length}</p>
            <p className="text-gray-600 text-sm">Cotizaciones</p>
          </div>
        </div>

        {selectedCli.telefono && (
          <a
            href={`https://wa.me/${selectedCli.telefono}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-8 p-4 bg-green-50 border-2 border-green-500 text-green-700 rounded-lg font-bold text-center hover:bg-green-100"
          >
            💬 Abrir WhatsApp
          </a>
        )}

        {cotsCli.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Cotizaciones ({cotsCli.length})</h2>
            <div className="space-y-2">
              {cotsCli.map((c: any) => (
                <div key={c.id} className="border rounded p-4 flex justify-between items-center hover:bg-gray-50">
                  <div>
                    <p className="font-bold">{c.nro}</p>
                    <p className="text-sm text-gray-600">{fmtDate(c.fecha)} · {c.cotizacion_items?.length || 0} ítems</p>
                  </div>
                  <p className="font-bold text-blue-600">{c.precio_final ? fmt(c.precio_final) : 'Sin precio'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Historial de compras ({itemsCli.length})</h2>
          {loadingDetalle ? (
            <p className="text-gray-500">Cargando...</p>
          ) : itemsCli.length === 0 ? (
            <p className="text-gray-500">Sin ítems registrados</p>
          ) : (
            <div className="space-y-2">
              {itemsCli.map((x: any) => (
                <div key={x.id} className="border rounded p-4 flex justify-between items-center hover:bg-gray-50">
                  <div>
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
          )}
        </div>
      </div>
    )
  }

  // VISTA FORMULARIO
  if (vista === 'form') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <button
          type="button"
          onClick={() => { setForm(EMPTY); setEditId(null); setVista('agenda') }}
          className="mb-6 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          ← Volver
        </button>

        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">{editId ? 'Editar cliente' : 'Nuevo cliente'}</h1>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1">Nombre *</label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Teléfono</label>
              <input
                type="text"
                value={form.telefono}
                onChange={(e) => setForm(p => ({ ...p, telefono: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Dirección</label>
              <input
                type="text"
                value={form.direccion}
                onChange={(e) => setForm(p => ({ ...p, direccion: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Código postal</label>
              <input
                type="text"
                value={form.codigo_postal}
                onChange={(e) => setForm(p => ({ ...p, codigo_postal: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Provincia</label>
              <select
                value={form.provincia}
                onChange={(e) => setForm(p => ({ ...p, provincia: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">— opcional —</option>
                {PROVINCIAS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Notas</label>
              <textarea
                value={form.notas}
                onChange={(e) => setForm(p => ({ ...p, notas: e.target.value }))}
                className="w-full border rounded px-3 py-2 h-20"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={guardar}
              className="flex-1 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold"
            >
              {editId ? 'Actualizar' : 'Guardar cliente'}
            </button>
            <button
              type="button"
              onClick={() => { setForm(EMPTY); setEditId(null); setVista('agenda') }}
              className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // VISTA AGENDA
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Clientes ({clientes.length})</h1>
        <button
          type="button"
          onClick={() => { setForm(EMPTY); setEditId(null); setVista('form') }}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold"
        >
          + Nuevo cliente
        </button>
      </div>

      <div className="relative mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono o provincia..."
          className="w-full border rounded px-4 py-2 pl-4"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Cargando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-8">{search ? 'No encontrado' : 'No hay clientes aún'}</p>
      ) : search ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="space-y-1">
            {filtered.map((c: any) => (
              <button
                key={c.id}
                type="button"
                onClick={() => verDetalle(c)}
                className="w-full text-left px-6 py-4 hover:bg-gray-50 border-b last:border-b-0 flex items-center justify-between group"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className={`${colorCli(c.nombre)} w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                    {iniciales(c.nombre)}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">{c.nombre}</p>
                    <p className="text-sm text-gray-600">{c.telefono ? c.telefono + ' · ' : ''}{c.provincia || ''}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(agrupados).sort(([a], [b]) => a.localeCompare(b)).map(([letra, clis]) => (
            <div key={letra}>
              <h2 className="text-lg font-bold text-gray-700 mb-3">{letra}</h2>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="space-y-1">
                  {clis.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => verDetalle(c)}
                      className="w-full text-left px-6 py-4 hover:bg-gray-50 border-b last:border-b-0 flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`${colorCli(c.nombre)} w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                          {iniciales(c.nombre)}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold">{c.nombre}</p>
                          <p className="text-sm text-gray-600">{c.telefono || c.provincia || ''}</p>
                        </div>
                      </div>
                      {c.telefono && (
                        <a
                          href={`https://wa.me/${c.telefono}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded-full hover:bg-green-100 text-gray-400 hover:text-green-600 transition-all flex-shrink-0"
                        >
                          <Phone size={20} />
                        </a>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
