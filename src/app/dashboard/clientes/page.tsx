'use client'
import { useState, useEffect } from 'react'
import { supabase, fmt, fmtDate, type Cliente, type Item } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Phone, MapPin, X } from 'lucide-react'

const PROVINCIAS = ['Buenos Aires','CABA','Catamarca','Chaco','Chubut','Córdoba','Corrientes','Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán','Otro país']
const EMPTY = { nombre:'', telefono:'', direccion:'', codigo_postal:'', provincia:'', notas:'' }

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<'agenda' | 'form' | 'detalle'>('agenda')
  const [selectedCli, setSelectedCli] = useState<Cliente | null>(null)
  const [itemsCli, setItemsCli] = useState<any[]>([])
  const [cotsCli, setCotsCli] = useState<any[]>([])
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  const load = async () => {
    try {
      const { data } = await supabase.from('clientes').select('*').order('nombre')
      setClientes(data || [])
    } catch (error) {
      toast.error('Error al cargar clientes.')
      console.error(error)
    } finally {
      setLoading(false)
    }
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
      setForm(EMPTY); setEditId(null); setVista('agenda'); await load()
    } catch (err) { toast.error('Error al guardar') }
  }

  const editar = (c: Cliente) => {
    setEditId(c.id)
    setForm({ nombre: c.nombre, telefono: c.telefono || '', direccion: c.direccion || '', codigo_postal: c.codigo_postal || '', provincia: c.provincia || '', notas: c.notas || '' })
    setVista('form')
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return
    try {
      const { data, error } = await supabase.from('clientes').delete().eq('id', id);

      if (error) {
        throw error;
      }

      console.log('Cliente eliminado de Supabase:', data);
      toast.success('Cliente eliminado');
      setSelectedCli(null);
      setVista('agenda');
      await load(); // Recarga la lista después de eliminar
    } catch (err: any) {
      console.error('ERROR AL ELIMINAR:', err);
      toast.error('Error al eliminar: ' + (err.message || 'Error desconocido'));
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
    !search || c.nombre.toLowerCase().includes(search.toLowerCase()) || (c.telefono || '').includes(search) || (c.provincia || '').toLowerCase().includes(search.toLowerCase())
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

  if (vista === 'detalle' && selectedCli) {
    const vendidos = itemsCli.filter((x: any) => x.ubicacion === 'Vendido')
    const enTransito = itemsCli.filter((x: any) => (x.ubicacion || '').includes('ránsito'))

    return (
      <div className="max-w-4xl mx-auto p-6">
        <button type="button" onClick={() => setVista('agenda')} className="mb-6 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">← Volver</button>
        
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-8 mb-6">
          <div className="flex items-start gap-4">
            <div className={`${colorCli(selectedCli.nombre)} w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold`}>{iniciales(selectedCli.nombre)}</div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{selectedCli.nombre}</h1>
              {selectedCli.telefono && <p className="flex items-center gap-2 mt-2 text-blue-100"><Phone size={16} /> {selectedCli.telefono}</p>}
              {selectedCli.direccion && <p className="flex items-center gap-2 mt-1 text-blue-100"><MapPin size={16} /> {selectedCli.direccion} {selectedCli.codigo_postal ? '(' + selectedCli.codigo_postal + ')' : ''} {selectedCli.provincia ? '· ' + selectedCli.provincia : ''}</p>}
              {selectedCli.notas && <p className="mt-3 italic text-blue-100">{selectedCli.notas}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => editar(selectedCli)} className="px-4 py-2 bg-white/20 text-white rounded hover:bg-white/30 font-bold text-sm">Editar</button>
              <button type="button" onClick={() => eliminar(selectedCli.id)} className="px-4 py-2 bg-red-500/30 text-red-100 rounded hover:bg-red-500/40 font-bold text-sm">Eliminar</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 text-center"><p className="text-3xl font-bold text-blue-600">{itemsCli.length}</p><p className="text-gray-600 text-sm">Ítems totales</p></div>
          <div className="bg-white rounded-lg shadow p-4 text-center"><p className="text-3xl font-bold text-orange-600">{enTransito.length}</p><p className="text-gray-600 text-sm">En tránsito</p></div>
          <div className="bg-white rounded-lg shadow p-4 text-center"><p className="text-3xl font-bold text-green-600">{vendidos.length}</p><p className="text-gray-600 text-sm">Vendidos</p></div>
          <div className="bg-white rounded-lg shadow p-4 text-center"><p className="text-3xl font-bold text-purple-600">{cotsCli.length}</p><p className="text-gray-600 text-sm">Cotizaciones</p></div>
        </div>

        {selectedCli.telefono && <a href={`https://wa.me/${selectedCli.telefono}`} target="_blank" rel="noopener noreferrer" className="block mb-8 p-4 bg-green-50 border-2 border-green-500 text-green-700 rounded-lg font-bold text-center hover:bg-green-100">💬 Abrir WhatsApp</a>}

        {cotsCli.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
