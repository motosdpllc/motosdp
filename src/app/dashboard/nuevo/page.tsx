'use client'
import { useState, useEffect, Suspense, useRef } from 'react'
import { supabase, type Cliente } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

const MARCAS = [{ v: 'K', l: 'Kawasaki (K)' }, { v: 'Y', l: 'Yamaha (Y)' }, { v: 'S', l: 'Suzuki (S)' }, { v: 'H', l: 'Honda (H)' }, { v: 'HD', l: 'Harley-Davidson (HD)' }, { v: 'OTHER', l: 'Otra...' }]
const SUBCODIGOS = [{ v: 'M', l: 'M – Motor' }, { v: 'C', l: 'C – Carbureción' }, { v: 'E', l: 'E – Electricidad' }, { v: 'T', l: 'T – Transmisión' }, { v: 'F', l: 'F – Frenos' }, { v: 'S', l: 'S – Suspensión/Chasis' }, { v: 'X', l: 'X – Carrocería' }, { v: 'I', l: 'I – Iluminación' }]
const UBICACIONES = ['Proveedor', 'En tránsito', 'En tránsito a Daniel', 'Daniel', 'Pablo', 'Blue Mail', 'Tato', 'Tránsito a Bs As', 'En Mano', 'Vendido', 'Cancelado']
const DESTINOS = ['Argentina', 'Stock EEUU', 'Uso propio', 'Stock Argentina', 'Stock Internacional']
const PLATAFORMAS = ['MercadoLibre', 'eBay', 'Facebook Marketplace', 'OLX', 'Instagram', 'WhatsApp', 'Otra']

function NuevoForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const cliDropRef = useRef<HTMLDivElement>(null)
  const cotDropRef = useRef<HTMLDivElement>(null)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [cliSearch, setCliSearch] = useState('')
  const [showCliDrop, setShowCliDrop] = useState(false)
  const [cotSearch, setCotSearch] = useState('')
  const [showCotDrop, setShowCotDrop] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingIA, setLoadingIA] = useState(false)
  const [codigoDisplay, setCodigoDisplay] = useState('—')

  const [f, setF] = useState({
    pagina: '', fecha_compra: new Date().toISOString().split('T')[0], producto: '',
    marca: '', marca_custom: '', anio: '', modelo: '', subcodigo: '', oem: '',
    nro_orden: '', tracking_compra: '', link_tracking_compra: '', eta: '', link_producto: '',
    importe: '', peso: '', tipo_envio: 'aereo', largo: '', ancho: '', alto: '',
    costo_envio: '', taxes: '', reembolsos: '', precio_venta: '',
    cliente_id: '', cliente_nombre: '',
    ubicacion: 'Proveedor', destino: '', estado_pago: '',
    plataforma: '', plataforma_custom: '', link_publicacion: '',
  })
  const [calc, setCalc] = useState({ costo_total: 0, ganancia: 0, taxes11: 0 })

  useEffect(() => {
    supabase.from('clientes').select('id, nombre, telefono, provincia').order('nombre').then(({ data }) => setClientes(data || []))
    supabase.from('cotizaciones').select('*, cotizacion_items(*)').order('created_at', { ascending: false }).limit(20).then(({ data }) => setCotizaciones(data || []))
    if (editId) loadEdit(editId)

    const h = (e: MouseEvent) => {
      if (cliDropRef.current && !cliDropRef.current.contains(e.target as Node)) setShowCliDrop(false)
      if (cotDropRef.current && !cotDropRef.current.contains(e.target as Node)) setShowCotDrop(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [editId])

  const loadEdit = async (id: string) => {
    const { data } = await supabase.from('items').select('*').eq('id', id).single()
    if (!data) return
    setF({
      pagina: data.pagina || '', fecha_compra: data.fecha_compra || '', producto: data.producto || '',
      marca: data.marca || '', marca_custom: '', anio: data.anio || '', modelo: data.modelo || '',
      subcodigo: data.subcodigo || '', oem: data.oem || '', nro_orden: data.nro_orden || '',
      tracking_compra: data.tracking_compra || '', link_tracking_compra: data.link_tracking_compra || '',
      eta: data.eta || '', link_producto: data.link_producto || '',
      importe: data.importe?.toString() || '', peso: data.peso?.toString() || '',
      tipo_envio: data.tipo_envio || 'aereo', largo: data.largo?.toString() || '',
      ancho: data.ancho?.toString() || '', alto: data.alto?.toString() || '',
      costo_envio: data.costo_envio?.toString() || '', taxes: data.taxes?.toString() || '',
      reembolsos: data.reembolsos?.toString() || '', precio_venta: data.precio_venta?.toString() || '',
      cliente_id: data.cliente_id || '', cliente_nombre: data.cliente_nombre || '',
      ubicacion: data.ubicacion || 'Proveedor', destino: data.destino || '',
      estado_pago: data.estado_pago || '', plataforma: data.plataforma || '',
      plataforma_custom: '', link_publicacion: data.link_publicacion || '',
    })
    setCodigoDisplay(data.codigo || '—')
    setCliSearch(data.cliente_nombre || '')
  }

  // Auto calcular totales
  useEffect(() => {
    const imp = parseFloat(f.importe) || 0
    const env = parseFloat(f.costo_envio) || 0
    const tax = parseFloat(f.taxes) || 0
    const ree = parseFloat(f.reembolsos) || 0
    const ven = parseFloat(f.precio_venta) || 0
    const taxes11 = imp * 0.11
    const costo = imp + taxes11 + env + tax - ree
    setCalc({ costo_total: costo, ganancia: ven - costo, taxes11 })
  }, [f.importe, f.costo_envio, f.taxes, f.reembolsos, f.precio_venta])

  // Auto envío
  useEffect(() => {
    if (f.tipo_envio === 'aereo') {
      const peso = parseFloat(f.peso) || 0
      if (peso > 0) setF(p => ({ ...p, costo_envio: (peso * 50).toFixed(2) }))
    } else {
      const l = parseFloat(f.largo) || 0, a = parseFloat(f.ancho) || 0, h = parseFloat(f.alto) || 0
      if (l && a && h) setF(p => ({ ...p, costo_envio: (((l * a * h) / 1000000) * 3000).toFixed(2) }))
    }
  }, [f.peso, f.largo, f.ancho, f.alto, f.tipo_envio])

  // Auto ubicación
  useEffect(() => {
    if (!editId) {
      const t = f.tracking_compra.trim(), p = parseFloat(f.peso) || 0
      setF(prev => ({ ...prev, ubicacion: !t ? 'Proveedor' : p > 0 ? 'En Mano' : 'En tránsito a Daniel' }))
    }
  }, [f.tracking_compra, f.peso, editId])

  // Auto código
  useEffect(() => {
    if (f.oem) { setCodigoDisplay(f.oem); return }
    const mc = f.marca === 'OTHER' ? f.marca_custom.toUpperCase() : f.marca
    const anio = (f.anio || '').toString().slice(-2)
    const modelo = (f.modelo || '').toUpperCase().replace(/\s/g, '')
    if (!mc || !anio || !modelo || !f.subcodigo) { setCodigoDisplay('—'); return }
    setCodigoDisplay(`${mc}${anio}-${modelo}-${f.subcodigo}###`)
  }, [f.oem, f.marca, f.marca_custom, f.anio, f.modelo, f.subcodigo])

  const filtCli = clientes.filter(c => cliSearch && c.nombre.toLowerCase().includes(cliSearch.toLowerCase())).slice(0, 8)
  const filtCot = cotizaciones.filter(c => !cotSearch || (c.nro || '').toLowerCase().includes(cotSearch.toLowerCase()) || (c.cliente_nombre || '').toLowerCase().includes(cotSearch.toLowerCase())).slice(0, 6)

  const cargarDesdeCot = (cot: any) => {
    const items = cot.cotizacion_items || []
    if (!items.length) { toast.error('Esta cotización no tiene ítems'); return }
    const it = items[0]
    setF(p => ({
      ...p,
      producto: it.descripcion || p.producto,
      link_producto: it.link || p.link_producto,
      pagina: it.ubicacion_producto || p.pagina,
      importe: it.costo?.toString() || p.importe,
      peso: it.peso_estimado?.toString() || p.peso,
      costo_envio: it.costo_envio?.toString() || p.costo_envio,
      cliente_id: cot.cliente_id || p.cliente_id,
      cliente_nombre: cot.cliente_nombre || p.cliente_nombre,
    }))
    if (cot.cliente_nombre) setCliSearch(cot.cliente_nombre)
    setShowCotDrop(false)
    setCotSearch('')
    if (items.length > 1) toast.success(`Cargado ítem 1 de ${items.length}. Para los otros, volvé a buscar la cotización.`)
    else toast.success('Datos de cotización cargados ✓')
  }

  const guardar = async () => {
    if (!f.producto.trim()) { toast.error('El producto es obligatorio'); return }
    setSaving(true)

    let codigo = f.oem || undefined
    if (!codigo && f.marca && f.anio && f.modelo && f.subcodigo) {
      const mc = f.marca === 'OTHER' ? f.marca_custom.toUpperCase() : f.marca
      const key = `${mc}${f.anio.slice(-2)}-${f.modelo.toUpperCase().replace(/\s/g, '')}-${f.subcodigo}`
      const { data: cnt } = await supabase.rpc('increment_counter', { counter_key: key })
      codigo = `${key}${String(cnt || 1).padStart(3, '0')}`
    }

    const plat = f.plataforma === 'Otra' ? f.plataforma_custom : f.plataforma
    const payload: any = {
      pagina: f.pagina || null, fecha_compra: f.fecha_compra || null, producto: f.producto,
      marca: f.marca || null, anio: f.anio || null, modelo: f.modelo || null,
      subcodigo: f.subcodigo || null, oem: f.oem || null, nro_orden: f.nro_orden || null,
      tracking_compra: f.tracking_compra || null, link_tracking_compra: f.link_tracking_compra || null,
      eta: f.eta || null, link_producto: f.link_producto || null,
      importe: parseFloat(f.importe) || 0, peso: parseFloat(f.peso) || 0,
      tipo_envio: f.tipo_envio,
      largo: parseFloat(f.largo) || null, ancho: parseFloat(f.ancho) || null, alto: parseFloat(f.alto) || null,
      costo_envio: parseFloat(f.costo_envio) || 0, taxes: parseFloat(f.taxes) || 0,
      reembol