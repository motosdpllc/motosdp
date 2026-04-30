'use client'
import { useState, useEffect } from 'react'
import { supabase, type Cliente } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Users, Plus, Search } from 'lucide-react'

const PROVINCIAS = ['Buenos Aires','CABA','Catamarca','Chaco','Chubut','Córdoba','Corrientes','Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán','Otro país']

const EMPTY: Omit<Cliente,'id'|'created_at'> = { nombre:'', telefono:'', direccion:'', codigo_postal:'', provincia:'', notas:'' }

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [form, setForm] = useState<Omit<Cliente,'id'|'created_at'>>(EMPTY)
  const [editId, setEditId] = useState<string|null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

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
    setForm(EMPTY); setEditId(null); load()
  }

  const editar = (c: Cliente) => {
    setEditId(c.id)
    setForm({ nombre: c.nombre, telefono: c.telefono||'', direccion: c.direccion||'', codigo_postal: c.codigo_postal||'', provincia: c.provincia||'', notas: c.notas||'' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    toast.success('Eliminado')
    load()
  }

  const filtered = clientes.filter(c => !search || c.nombre.toLowerCase().includes(search.toLowerCase()) || (c.telefono||'').includes(search))

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Users size={24} className="text-gray-700" />
        <h1 className="text-2xl font-bold">Clientes</h1>
      </div>

      <div className="card mb-6">
        <div className="text-sm font-semibold mb-4">{editId ? 'Editar cliente' : 'Nuevo cliente'}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="md:col-span-2 lg:col-span-3">
            <label className="label">Nombre *</label>
            <input className="input" placeholder="Nombre completo" value={form.nombre} onChange={e => setForm(p => ({...p, nombre: e.target.value}))} />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input className="input" placeholder="+54 11 ..." value={form.telefono} onChange={e => setForm(p => ({...p, telefono: e.target.value}))} />
          </div>
          <div>
            <label className="label">Dirección</label>
            <input className="input" placeholder="Calle y número" value={form.direccion} onChange={e => setForm(p => ({...p, direccion: e.target.value}))} />
          </div>
          <div>
            <label className="label">Código postal</label>
            <input className="input" placeholder="1708" value={form.codigo_postal} onChange={e => setForm(p => ({...p, codigo_postal: e.target.value}))} />
          </div>
          <div>
            <label className="label">Provincia</label>
            <select className="input" value={form.provincia} onChange={e => setForm(p => ({...p, provincia: e.target.value}))}>
              <option value="">— opcional —</option>
              {PROVINCIAS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Notas</label>
            <input className="input" placeholder="Opcional" value={form.notas} onChange={e => setForm(p => ({...p, notas: e.target.value}))} />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={guardar} disabled={!form.nombre.trim()} className="btn btn-primary">
            {editId ? 'Actualizar' : 'Guardar cliente'}
          </button>
          {editId && <button onClick={() => { setForm(EMPTY); setEditId(null) }} className="btn">Cancelar</button>}
        </div>
      </div>

      {/* Lista */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input className="input pl-9" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        {loading ? <div className="text-gray-400 text-center py-8">Cargando...</div> :
        filtered.length === 0 ? <div className="text-gray-400 text-center py-8">No hay clientes aún</div> :
        filtered.map(c => {
          const iniciales = c.nombre.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()
          return (
            <div key={c.id} className="card flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">{iniciales}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{c.nombre}</div>
                <div className="text-xs text-gray-500">{c.telefono ? c.telefono + ' · ' : ''}{c.provincia || ''}{c.codigo_postal ? ' (' + c.codigo_postal + ')' : ''}</div>
                {c.notas && <div className="text-xs text-gray-400 mt-0.5">{c.notas}</div>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => editar(c)} className="btn btn-sm">Editar</button>
                <button onClick={() => eliminar(c.id)} className="btn btn-sm btn-danger">✕</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
