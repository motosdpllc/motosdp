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

  // Procesador del pegado masivo de texto
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
        const peso = parseFloat(columnas[3]) || 0
        const basoli = parseFloat(columnas[4]) || 0
        const partzilla = parseFloat(columnas[5]) || 0
        const otra = parseFloat(columnas[6]) || 0
        const precio_venta = parseFloat(columnas[7]) || 0

        let proveedor_elegido = 'basoli'
        if (partzilla > 0 && (basoli === 0 || partzilla < basoli)) proveedor_elegido = 'partzilla'
        if (otra > 0 && (otra < basoli || basoli === 0) && (otra < partzilla || partzilla === 0)) proveedor_elegido = 'otra'

        return { cantidad, codigo, descripcion, peso, basoli, partzilla, otra, precio_venta, proveedor_elegido }
      })
      .filter(Boolean)

    if (nuevosItems.length > 0) {
      // Rellena hasta 30 ítems para mantener la estructura visual de la matriz
      const matrizCompleta = [...nuevosItems]
      while (matrizCompleta.length < 30) {
        matrizCompleta.push({ cantidad: 1, codigo: '', descripcion: '', peso: 0, basoli: 0, partzilla: 0, otra: 0, precio_venta: 0, proveedor_elegido: 'basoli' })
      }
      setCotItems(matrizCompleta)
      setRawText('')
    }
  }

  const actualizarCeldaItem = (index: number, campo: string, valor: any) => {
    const copia = [...cotItems]
    copia[index] = { ...copia[index], [campo]: valor }
    setCotItems(copia)
  }

  const nuevaCot = async () => {
    setEditId(null)
    const { data: cnt } = await supabase.rpc('increment_counter', { counter_key: 'cot' })
    setF({
      nro: 'COT-' + String(cnt || 1).padStart(3, '0'),
      fecha: new Date().toISOString().split('T')[0],
      cliente_id: '', 
      cliente_nombre: '', 
      destino: 'AR', 
      vin: '',
      precio_final: 0
    })
    
    const matrizInicial = Array.from({ length: 30 }, () => ({
      cantidad: 1, codigo: '', descripcion: '', peso: 0, basoli: 0, partzilla: 0, otra: 0, precio_venta: 0, proveedor_elegido: 'basoli'
    }))
    setCotItems(matrizInicial)
    setCliSearch('')
    setVista('form')
  }

  const editarCot = (cot: any) => {
    setEditId(cot.id)
    setF({
      nro: cot.nro, 
      fecha: cot.fecha || '',
      cliente_id: cot.cliente_id || '', 
      cliente_nombre: cot.cliente_nombre || '',
      destino: cot.destino || 'AR', 
      vin: cot.vin || '',
      precio_final: cot.precio_final || 0
    })
    setCliSearch(cot.cliente_nombre || '')
    
    const itemsCargados = cot.cotizacion_items || []
    const
