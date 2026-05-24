'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const MULTIPLICADOR = 1.11

export default function CotizacionesPage() {
  const [vista, setVista] = useState<'lista' | 'form'>('lista')
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [cotItems, setCotItems] = useState<any[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [f, setF] = useState({ nro: '', fecha: '', cliente_nombre: '', vin: '' })
  const [rawText, setRawText] = useState('')
  const [itemActivoIndex, setItemActivoIndex] = useState<number | null>(null)
  const [imprConfig, setImprConfig] = useState({ cliente: true, basoli: true, partzilla: true, otras: true })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data } = await supabase.from('cotizaciones').select('*, cotizacion_items(*)').order('created_at', { ascending: false })
    if (data) setCotizaciones(data)
  }

  const procesarPegadoMasivo = () => {
    const filas = rawText.split('\n').map(linea => {
      const col = linea.split('\t')
      return {
        cantidad: parseInt(col[0]) || 1,
        codigo: col[1] || '',
        descripcion: col[2] || '',
        basoli: parseFloat(col[4]) || 0,
        partzilla: parseFloat(col[5]) || 0,
        otra: parseFloat(col[6]) || 0,
        precio_venta: parseFloat(col[7]) || 0,
        proveedor_elegido: 'basoli'
      }
    })
    const vacias = Array.from({ length: Math.max(0, 30 - filas.length) }, () => ({
      cantidad: 1, codigo: '', descripcion: '', basoli: 0, partzilla: 0, otra: 0, precio_venta: 0, proveedor_elegido: 'basoli'
    }))
    setCotItems([...filas, ...vacias])
  }

  const actualizarCelda = (idx: number, campo: string, valor: any) => {
    const nuevo = [...cotItems]
    nuevo[idx] = { ...nuevo[idx], [campo]: valor }
    setCotItems(nuevo)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editId) {
        await supabase.from('cotizaciones').update(f).eq('id', editId)
        await supabase.from('cotizacion_items').delete().eq('cotizacion_id', editId)
        await supabase.from('cotizacion_items').insert(cotItems.filter(i => i.codigo).map(i => ({ ...i, cotizacion_id: editId })))
      } else {
        const { data: nueva } = await supabase.from('cotizaciones').insert([f]).select().single()
        if (nueva) await supabase.from('cotizacion_items').insert(cotItems.filter(i => i.codigo).map(i => ({ ...i, cotizacion_id: nueva.id })))
      }
      setVista('lista')
      fetchData()
    } catch (err: any) { alert("Error al guardar: " + err.message) }
  }

  return (
    <div className="p-6">
      {vista === 'lista' ? (
        <div className="space-y-4">
          <button onClick={() => { setVista('form'); setCotItems(Array(30).fill({ cantidad: 1, codigo: '', descripcion: '', basoli: 0, partzilla: 0, otra: 0, precio_venta: 0, proveedor_elegido: 'basoli' })); setEditId(null); }} className="bg-blue-600 text-white px-4 py-2 rounded">Nueva Cotización</button>
          {cotizaciones.map(c => (
            <div key={c.id} className="p-4 border rounded shadow flex justify-between">
              <span>{c.nro} - {c.cliente_nombre}</span>
              <button onClick={async () => { await supabase.from('cotizacion_items').delete().eq('cotizacion_id', c.id); await supabase.from('cotizaciones').delete().eq('id', c.id); fetchData(); }} className="text-red-500 font-bold">Borrar</button>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={guardar} className="space-y-4">
          <div className="flex gap-4 p-4 bg-gray-100 rounded">
            <input className="border p-2" placeholder="Cliente" onChange={e => setF({...f, cliente_nombre: e.target.value})} />
            <textarea className="border p-2 w-full" placeholder="Pegar desde Excel" onChange={e => setRawText(e.target.value)} />
            <button type="button" onClick={procesarPegadoMasivo} className="bg-gray-800 text-white p-2">Procesar</button>
          </div>
          
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-gray-200"><th>Cant</th><th>Código</th><th>Venta</th><th>Costo</th><th>Acción</th></tr></thead>
            <tbody>
              {cotItems.map((item, i) => {
                const costoConRecargo = (item.basoli || item.partzilla || item.otra) * MULTIPLICADOR
                const alerta = item.precio_venta > 0 && item.precio_venta < costoConRecargo
                return (
                  <tr key={i} className={alerta ? 'bg-red-200' : 'hover:bg-gray-50'}>
                    <td className="border p-1"><input className="w-12" type="number" value={item.cantidad} onChange={e => actualizarCelda(i, 'cantidad', e.target.value)} /></td>
                    <td className="border p-1"><input className="w-full" value={item.codigo} onChange={e => actualizarCelda(i, 'codigo', e.target.value)} /></td>
                    <td className="border p-1"><input className="w-20" type="number" value={item.precio_venta} onChange={e => actualizarCelda(i, 'precio_venta', parseFloat(e.target.value))} /></td>
                    <td className="border p-1 text-[10px]">$ {costoConRecargo.toFixed(2)}</td>
                    <td className="border p-1"><button type="button" onClick={() => setItemActivoIndex(i)} className="text-blue-600">Detalle</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded">Guardar Cambios</button>
        </form>
      )}
    </div>
  )
}
