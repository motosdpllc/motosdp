'use client'
import { useState, useEffect, Suspense, useRef } from 'react'
import { supabase, type Cliente } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import BotonIA from './BotonIA'

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
    supabase.from('cotizaciones').select('*, cot