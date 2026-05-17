'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase, fmt, fmtDate, type Cliente, type Cotizacion, type CotizacionItem } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { FileText, Plus, X, Eye, Send, Clock, CheckSquare, Square, CheckCircle, Circle } from 'lucide-react'

const EMPTY_PROVEEDOR = { proveedor_nombre: '', link: '', costo: 0, seleccionado: false }
const EMPTY_ITEM: any = {
  descripcion: '', link: '', img_url: '', ubicacion_producto: '', costo: 0,
  taxes_impo: 0, peso_estimado: 0, costo_envio: 0, taxes_11: 0, subtotal: 0, orden: 0,
  ganancia_deseada: 0, precio_venta: 0,
  proveedores: [{ ...EMPTY_PROVEEDOR }] // Mínimo arranca con uno
}
const COSTO_ENVIO_KG = 50 

export default function CotizacionesPage() {
  const [vista, setVista] = useState<'lista' | 'form' | 'pdf'>('lista')
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [currentCot, setCurrentCot] = useState<any>(null)
  const [cliSearch, setCliSearch] = useState('')
  const [showCliDrop, setShowCliDrop] = useState(false)
  const [cotItems, setCotItems] = useState<any[]>([{ ...EMPTY_ITEM }])
  const [saving, setSaving] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [estimandoPeso, setEstimandoPeso] = useState<number | null>(null)
  const cliDropRef = useRef<HTMLDivElement>(null)

  const [visibilidad, setVisibilidad] = useState({
    mostrarLink: false,
    mostrarImagen: true,
    mostrarPrecioUnitario: true,
    mostrarPeso: false
  })

  const [showModalProgramar, setShowModalProgramar] = useState(false)
  const [fechaEnvio, setFechaEnvio] = useState('')
  const [horaEnvio, setHoraEnvio] = useState('')
  const [mensajePersonalizado, setMensajePersonalizado] = useState('')

  const [f, setF] = useState({
    nro: '', fecha: new Date().toISOString().split('T')[0],
    cliente_id: '', cliente_nombre: '', destino: '', vin: '',
    precio_final: 0, suma_adicional: 0,
  })

  useEffect(() => {
    loadAll()
    supabase.from('config').select('value').eq('key', 'logo_url').single().then(({ data }) => {
      if (data?.value) setLogoUrl(data.value)
    })
    const h = (e: MouseEvent) => {
      if (cliDropRef.current && !cliDropRef.current.contains(e.target as Node)) setShowCliDrop(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const loadAll = async () => {
    const [cotRes, cliRes] = await Promise.all([
      supabase.from('cotizaciones').select('*, cotizacion_items(*, cotizacion_item_proveedores(*))').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nombre')
    ])
    setCotizaciones(cotRes.data || [])
    setClientes(cliRes.data || [])
  }

  const filtCli = clientes.filter(c => cliSearch && c.nombre.toLowerCase().includes(cliSearch.toLowerCase())).slice(0, 6)
  const sinTaxes = ['ES', 'US'].includes(f.destino)

  const recalcItems = (items: any[], destino?: string) => {
    const st = destino !== undefined ? ['ES', 'US'].includes(destino) : sinTaxes
    return items.map(it => {
      const taxes11 = (it.costo || 0) * 0.11
      const taxesImpo = st ? 0 : (it.taxes_impo || 0)
      const costoEnvio = it.peso_estimado ? it.peso_estimado * COSTO_ENVIO_KG : (it.costo_envio || 0)
      const subtotal = (it.costo || 0) + taxes11 + taxesImpo + costoEnvio
      return { ...it, taxes_11: taxes11, costo_envio: costoEnvio, subtotal }
    })
  }

  const updateItem = (i: number, field: string, val: any) => {
    const updated = [...cotItems]
    updated[i] = { ...updated[i], [field]: val }
    setCotItems(recalcItems(updated))
  }

  // Manejo específico de la lista de proveedores dentro de un ítem
  const addProveedorFila = (itemIdx: number) => {
    const updated = [...cotItems]
    if (!updated[itemIdx].proveedores) updated[itemIdx].proveedores = []
    updated[itemIdx].proveedores.push({ ...EMPTY_PROVEEDOR })
    setCotItems(updated)
  }

  const removeProveedorFila = (itemIdx: number, provIdx: number) => {
    const updated = [...cotItems]
    updated[itemIdx].proveedores = updated[itemIdx].proveedores.filter((_: any, j: number) => j !== provIdx)
    setCotItems(recalcItems(updated))
  }

  const updateProveedorField = (itemIdx: number, provIdx: number, field: string, val: any) => {