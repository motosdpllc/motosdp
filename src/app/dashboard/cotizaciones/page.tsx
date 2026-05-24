'use client'

import { useState, useEffect } from 'react'
import { supabase, fmt, fmtDate, type Cliente } from '@/lib/supabase'

export default function CotizacionesPage() {
  const [vista, setVista] = useState<'lista' | 'form'>('lista')
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)

  // Estado del formulario principal
  const [f, setF] = useState({
    nro: '',
    fecha: '',
    cliente_id: '',
    cliente_nombre: '',
    destino: 'AR',
    vin: '',
    precio_final: 0
  })

  // Estado de los ítems de la cotización (Matriz Masiva de 30 líneas)
  const [cotItems, setCotItems] = useState<any[]>([])
  const [rawText, setRawText] = useState('')
  const [cliSearch, setCliSearch] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: cots } = await supabase
      .from('cotizaciones')
      .select('*, cotizacion_items(*)')
      .order('created_at', { ascending: false })
    
    const { data: clis } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre')

    if (cots) setCotizaciones(cots)
    if (clis) setClientes(clis)
    setLoading(false)
  }

  // Procesador del pegado masivo con forzado de 2 decimales
  const procesarPegadoMasivo = () => {
    if (!rawText.trim()) return
    const lineas = rawText.split('\n')
    const nuevosItems = lineas
      .map(linea => {
        const columnas = linea.split('\t')
        if (!columnas[0] && !columnas[1]) return null

        const cantidad = parseInt(columnas[0]) || 1
        const codigo = (columnas[1] || '').trim()
        const descripcion = (columnas[2] || '').trim()
        
        // Forzamos 2 decimales en la lectura inicial
        const peso = parseFloat(parseFloat(columnas[3] || '0').toFixed(2)) || 0
        const basoli = parseFloat(parseFloat(columnas[4] || '0').toFixed(2)) || 0
        const partzilla = parseFloat(parseFloat(columnas[5] || '0').toFixed(2)) || 0
        const otra = parseFloat(parseFloat(columnas[6] || '0').toFixed(2)) || 0
        const precio_venta = parseFloat(parseFloat(columnas[7] || '0').toFixed
