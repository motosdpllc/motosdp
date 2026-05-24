'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export default function CotizacionesPage() {
  const [vista, setVista] = useState<'lista' | 'form'>('lista')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  
  // Estado del formulario
  const [form, setForm] = useState({ nro: '', fecha: '', cliente_nombre: '', vin: '' })
  const [items, setItems] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: cots, error } = await supabase
      .from('cotizaciones')
      .select('*, cotizacion_items(*)')
      .order('created_at', { ascending: false })
    
    if (error) console.error('Error:', error)
    else setData(cots || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const crearFilaVacia = () => ({
    cantidad: 1, codigo: '', descripcion: '', peso: 0, 
    basoli: 0, partzilla: 0, otra: 0, precio_venta: 0, proveedor_elegido: 'basoli'
  })

  const iniciarNueva = () => {
    setForm({ nro: 'COT-' + Date.now().toString().slice(-4), fecha: new Date().toISOString().split('T')[0], cliente_nombre: '', vin: '' })
    setItems(Array.from({ length: 30 }, crearFilaVacia))
    setEditId(null)
    setVista('form')
  }

  const borrarCotizacion = async (id: string) => {
    if (!confirm('¿Seguro?')) return
    await supabase.from('cotizacion_items').delete().eq('cotizacion_id', id)
    await supabase.from('cotizaciones').delete().eq('id', id)
    fetchData()
  }

  const guardarTodo = async () => {
    try {
      const itemsFiltrados = items.filter(i => i.codigo || i.descripcion)
      
      if (editId) {
        await supabase.from('cotizaciones').update(form).eq('id', editId)
        await supabase.from('cotizacion_items').delete().eq('cotizacion_id', editId)
        await supabase.from('cotizacion_items').insert(itemsFiltrados.map(i => ({ ...i, cotizacion_id: editId })))
      } else {
        const { data: nueva } = await supabase.from('cotizaciones').insert([form]).select().single()
        await supabase.from('cotizacion_items').insert(itemsFiltrados.map(i => ({ ...i, cotizacion_id: nueva.id })))
      }
      setVista('lista')
      fetchData()
    } catch (e: any) {
      alert('Error crítico: ' + e.message)
    }
  }

  if (loading) return <div className="p-10 text-center">Cargando...</div>

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      {vista === 'lista' ? (
        <>
          <div className="flex justify-between mb-6">
            <h1 className="text-2xl font-bold">Cotizaciones</h1>
            <button onClick={iniciarNueva} className="bg-blue-600 text-white px-4 py-2 rounded">Nueva</button>
          </div>
          <div className="space-y-2">
            {data.map(cot => (
              <div key={cot.id} className="bg-white p-4 flex justify-between items-center shadow-sm border">
                <div>{cot.nro} - {cot.cliente_nombre}</div>
                <button onClick={() => borrarCotizacion(cot.id)} className="text-red-600">Borrar</button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white p-6 shadow">
          <h2 className="text-xl mb-4 font-bold">Editor de Cotización</h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <input placeholder="Nro" value={form.nro} onChange={e => setForm({...form, nro: e.target.value})} className="border p-2"/>
            <input placeholder="Cliente" value={form.cliente_nombre} onChange={e => setForm({...form, cliente_nombre: e.target.value})} className="border p-2"/>
            <input placeholder="VIN" value={form.vin} onChange={e => setForm({...form, vin: e.target.value})} className="border p-2"/>
          </div>
          
          <table className="w-full border text-sm mb-6">
            <thead className="bg-gray-100"><tr><th className="p-2">Cant</th><th className="p-2">Código</th><th className="p-2">Precio</th></tr></thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b">
                  <td className="p-1"><input type="number" value={item.cantidad} onChange={e => { const n = [...items]; n[idx].cantidad = e.target.value; setItems(n); }} className="w-full"/></td>
                  <td className="p-1"><input value={item.codigo} onChange={e => { const n = [...items]; n[idx].codigo = e.target.value; setItems(n); }} className="w-full"/></td>
                  <td className="p-1"><input type="number" value={item.precio_venta} onChange={e => { const n = [...items]; n[idx].precio_venta = e.target.value; setItems(n); }} className="w-full"/></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex gap-4">
            <button onClick={() => setVista('lista')} className="bg-gray-400 text-white px-4 py-2 rounded">Cancelar</button>
            <button onClick={guardarTodo} className="bg-green-600 text-white px-4 py-2 rounded">Guardar</button>
          </div>
        </div>
      )}
    </div>
  )
}
