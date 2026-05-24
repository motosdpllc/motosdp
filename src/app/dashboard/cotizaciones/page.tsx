'use client'

import { useState, useEffect } from 'react'
import { supabase, fmtDate, type Cliente } from '@/lib/supabase'

const MULTIPLICADOR = 1.11

export default function CotizacionesPage() {
  const [vista, setVista] = useState<'lista' | 'form'>('lista')
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [imprConfig, setImprConfig] = useState({ cliente: true, basoli: true, partzilla: true, otras: true })

  const [f, setF] = useState({
    nro: '', fecha: '', cliente_id: '', cliente_nombre: '', destino: 'AR', vin: ''
  })

  const [cotItems, setCotItems] = useState<any[]>([])
  const [rawText, setRawText] = useState('')
  const [cliSearch, setCliSearch] = useState('')
  const [itemActivoIndex, setItemActivoIndex] = useState<number | null>(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: cots } = await supabase.from('cotizaciones').select('*, cotizacion_items(*)').order('created_at', { ascending: false })
    const { data: clis } = await supabase.from('clientes').select('*').order('nombre')
    if (cots) setCotizaciones(cots)
    if (clis) setClientes(clis)
    setLoading(false)
  }

  const procesarPegadoMasivo = () => {
    if (!rawText.trim()) return
    const nuevosItems = rawText.split('\n').map(linea => {
      const col = linea.split('\t')
      return { 
        cantidad: parseInt(col[0]) || 1, codigo: col[1] || '', descripcion: col[2] || '', 
        peso: parseFloat(col[3]) || 0, basoli: parseFloat(col[4]) || 0, 
        partzilla: parseFloat(col[5]) || 0, otra: parseFloat(col[6]) || 0, 
        precio_venta: parseFloat(col[7]) || 0, proveedor_elegido: 'basoli' 
      }
    })
    setCotItems([...nuevosItems, ...Array(30 - nuevosItems.length).fill({ cantidad: 1, codigo: '', descripcion: '', peso: 0, basoli: 0, partzilla: 0, otra: 0, precio_venta: 0, proveedor_elegido: 'basoli' })])
    setRawText('')
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const items = cotItems.filter(i => i.codigo || i.descripcion)
      if (editId) {
        await supabase.from('cotizaciones').update(f).eq('id', editId)
        await supabase.from('cotizacion_items').delete().eq('cotizacion_id', editId)
        await supabase.from('cotizacion_items').insert(items.map(i => ({ ...i, cotizacion_id: editId })))
      } else {
        const { data: nueva } = await supabase.from('cotizaciones').insert([f]).select().single()
        if (nueva) await supabase.from('cotizacion_items').insert(items.map(i => ({ ...i, cotizacion_id: nueva.id })))
      }
      setVista('lista')
      fetchData()
    } catch (err) { alert("Error al guardar: " + err) }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Estilos e interfaz igual a lo anterior... (omitido para brevedad, mantené los tuyos) */}
      
      {/* SELECTOR DE IMPRESIÓN */}
      <div className="bg-white p-4 rounded-xl shadow mb-6 no-print flex gap-4">
        <label><input type="checkbox" checked={imprConfig.cliente} onChange={e => setImprConfig({...imprConfig, cliente: e.target.checked})} /> Cliente</label>
        <label><input type="checkbox" checked={imprConfig.basoli} onChange={e => setImprConfig({...imprConfig, basoli: e.target.checked})} /> Básoli</label>
        <button onClick={() => window.print()} className="bg-black text-white px-4 py-1 rounded">🖨️ Imprimir Selección</button>
      </div>

      {/* REPARACIÓN DEL INPUT CLIENTE */}
      <input 
        value={cliSearch} 
        onChange={e => { setCliSearch(e.target.value); setF({...f, cliente_nombre: e.target.value}); }}
        onBlur={() => setTimeout(() => setCliSearch(f.cliente_nombre), 200)} // Cierra la caja al perder foco
      />
      {cliSearch && clientes.filter(c => c.nombre.includes(cliSearch)).map(c => (
        <div onClick={() => { setF({...f, cliente_id: c.id, cliente_nombre: c.nombre}); setCliSearch(c.nombre); }}>{c.nombre}</div>
      ))}
      
      {/* ... resto de tu tabla ... */}
    </div>
  )
}
