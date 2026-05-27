'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase, type Cliente, fmt } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FileText, Loader, CheckCircle, X, ClipboardList, Truck } from 'lucide-react'

// --- UBICACIONES Y DESTINOS DESDE EL FORMULARIO NUEVO ---
const UBICACIONES_FISICAS_IMPORTAR = ['Proveedor','En tránsito','En tránsito a Daniel','Daniel','Pablo','Blue Mail','Tato','Tránsito a Bs As','Stock EEUU', 'Stock España', 'Stock Argentina', 'En Mano', 'Entregado']
const DESTINOS_FINALES_IMPORTAR = ['Stock EEUU', 'Stock España', 'Stock Argentina', 'Venta Argentina', 'Venta Internacional', 'Uso Propio', 'Stock Internacional']


interface ItemImportado {
  producto: string;
  oem?: string;
  cantidad: number;
  importe_unitario: number; // Costo por unidad del producto
  costo_envio_unitario: number; // Costo de envío por unidad
  taxes_unitario: number; // Taxes por unidad
  reembolsos_unitario: number; // Reembolsos por unidad
  costo_total_unitario: number; // Calculado
  fecha_compra?: string; // Nuevo: de Excel
  nro_orden?: string; // Nuevo: de Excel
  pagina?: string; // Nuevo: de Excel
  link_producto?: string; // Nuevo: de Excel
  peso?: number; // Nuevo: de Excel
  eta?: string; // Nuevo: de Excel
  tracking_compra?: string; // Nuevo: de Excel
  ubicacion?: string; // Nuevo: de Excel
  destino?: string; // Nuevo: de Excel
  cliente_id?: string;
  cliente_nombre?: string;
  seleccionado: boolean;
  _proveedor?: string; // Para el proveedor general si la IA lo detecta
}

export default function ImportarPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [paso, setPaso] = useState<'upload' | 'revisar' | 'listo'>('upload')
  const [items, setItems] = useState<ItemImportado[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  
  // Conceptos globales que la IA puede detectar, o se aplican a todo el lote
  const [nroOrdenGlobal, setNroOrdenGlobal] = useState('')
  const [proveedorGlobal, setProveedorGlobal] = useState('')

  const [cliGlobal, setCliGlobal] = useState('')
  const [cliGlobalId, setCliGlobalId] = useState('')
  const [showCliDrop, setShowCliDrop] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [modoEntrada, setModoEntrada] = useState<'ia' | 'paste'>('ia')
  const [rawPastedText, setRawPastedText] = useState('')

  // Clientes para el dropdown global
  const [clientesForm, setClientesForm] = useState<Cliente[]>([])
  const [cliSearchGlobal, setCliSearchGlobal] = useState('')
  const [showCliDropGlobal, setShowCliDropGlobal] = useState(false)


  useEffect(() => {
    cargarClientes()
  }, [])

  const cargarClientes = async () => {
    const { data } = await supabase.from('clientes').select('id, nombre').order('nombre')
    setClientesForm(data || [])
  }

  const generarParcelsAppLink = (tracking: string | undefined | null) => {
    return tracking ? `https://parcelsapp.com/es/tracking/${tracking}` : '#';
  };

  const procesarArchivo = async (file: File) => {
    setLoading(true)
    const tid = toast.loading('Analizando documento con IA...')
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const isPDF = file.type === 'application/pdf'
      const isImage = file.type.startsWith('image/')
      if (!isPDF && !isImage) { toast.error('Solo PDF e imágenes'); setLoading(false); toast.dismiss(tid); return }

      const res = await fetch('/api/parse-invoice', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64,
          media_type: file.type,
          file_name: file.name
        })
      })

      const apiResponse = await res.json()
      if (!res.ok) {
        throw new Error(apiResponse.error || 'Error en la API de análisis.')
      }

      const parsed = apiResponse.data
      if (!parsed || !parsed.items || parsed.items.length === 0) {
        throw new Error('La IA no pudo extraer los ítems o la estructura es inválida.')
      }
      
      setNroOrdenGlobal(parsed.nro_orden || '')
      setProveedorGlobal(parsed.proveedor || '')
      
      const itemsProcesados: ItemImportado[] = (parsed.items || []).map((x: any) => ({
        producto: x.producto || '',
        oem: x.oem || '',
        cantidad: x.cantidad || 1,
        importe_unitario: x.importe_unitario || 0,
        costo_envio_unitario: x.costo_envio_unitario || 0,
        taxes_unitario: x.taxes_unitario || 0,
        reembolsos_unitario: x.reembolsos_unitario || 0,
        costo_total_unitario: (x.importe_unitario || 0) + (x.costo_envio_unitario || 0) + (x.taxes_unitario || 0) - (x.reembolsos_unitario || 0),
        fecha_compra: x.fecha_compra || new Date().toISOString().split('T')[0], // Si la IA lo extrae
        nro_orden: x.nro_orden || '', // Si la IA lo extrae
        pagina: x.pagina || '', // Si la IA lo extrae
        link_producto: x.link_producto || '', // Si la IA lo extrae
        peso: x.peso || 0, // Si la IA lo extrae
        eta: x.eta || '', // Si la IA lo extrae
        tracking_compra: x.tracking_compra || '', // Si la IA lo extrae
        ubicacion: x.ubicacion || 'Proveedor', // Si la IA lo extrae
        destino: x.destino || 'Stock EEUU', // Si la IA lo extrae
        seleccionado: true,
        cliente_id: '',
        cliente_nombre: ''
      }))
      setItems(itemsProcesados)
      setPaso('revisar')
      toast.success('Documento analizado ✓', { id: tid })

    } catch (e: any) {
      toast.error('Error: ' + (e.message || 'Intentá de nuevo'), { id: tid })
      console.error("Error al procesar archivo:", e)
    } finally {
      setLoading(false)
    }
  }

  const procesarPegadoMasivo = () => {
    if (!rawPastedText.trim()) {
      toast.error('Pegá datos primero');
      return;
    }
    setLoading(true);
    const tid = toast.loading('Procesando datos pegados...');
    try {
      const lines = rawPastedText.trim().split('\n');
      const itemsProcesados: ItemImportado[] = [];
      const headers = ["fecha_compra","Producto","OEM","Cantidad","Importe Unitario","nro_orden","pagina_de_compra","link_producto","peso","Costo Envío Unitario","costo_total","eta","tracking_compra","ubicacion","destino","Taxes Unitario","Reembolsos Unitario"];
  
      lines.forEach(line => {
        const cols = line.split('\t').map(col => col.trim());
        // Ajusta los índices según las columnas de tu Excel
        // fecha_compra | Producto | OEM | Cantidad | Importe Unitario | nro_orden | pagina_de_compra | link_producto | peso | Costo Envío Unitario | costo_total | eta | tracking_compra | ubicacion | destino | Taxes Unitario | Reembolsos Unitario
        if (cols.length < headers.length) { // Debe tener al menos todas las columnas
          console.warn('Línea ignorada por formato incorrecto:', line);
          return; 
        }
        
        const importe_unitario = parseFloat(cols[4]) || 0;
        const costo_envio_unitario = parseFloat(cols[9]) || 0;
        const taxes_unitario = parseFloat(cols[15]) || 0;
        const reembolsos_unitario = parseFloat(cols[16]) || 0;
        const costo_total_item = parseFloat(cols[10]) || (importe_unitario + costo_envio_unitario + taxes_unitario - reembolsos_unitario); // Usar el del excel o calcular

        itemsProcesados.push({
          fecha_compra: cols[0] || new Date().toISOString().split('T')[0],
          producto: cols[1] || '',
          oem: cols[2] || '',
          cantidad: parseInt(cols[3]) || 1,
          importe_unitario: importe_unitario,
          nro_orden: cols[5] || '',
          pagina: cols[6] || '',
          link_producto: cols[7] || '',
          peso: parseFloat(cols[8]) || 0,
          costo_envio_unitario: costo_envio_unitario,
          costo_total_unitario: costo_total_item,
          eta: cols[11] || '',
          tracking_compra: cols[12] || '',
          ubicacion: cols[13] || 'Proveedor',
          destino: cols[14] || 'Stock EEUU',
          taxes_unitario: taxes_unitario,
          reembolsos_unitario: reembolsos_unitario,
          seleccionado: true,
          cliente_id: '',
          cliente_nombre: ''
        });
      });
  
      if (itemsProcesados.length === 0) {
        throw new Error('No se pudieron procesar los ítems desde los datos pegados. Verifica el formato.');
      }
      
      setItems(itemsProcesados);
      setPaso('revisar');
      toast.success(`Se procesaron ${itemsProcesados.length} ítems.`, { id: tid });
    } catch (e: any) {
      toast.error('Error al procesar los datos: ' + (e.message || 'Verifica el formato del Excel.'), { id: tid });
      console.error("Error al procesar pegado masivo:", e);
    } finally {
      setLoading(false);
      setRawPastedText('');
    }
  };
  

  const asignarCliGlobal = () => {
    if (!cliGlobal || !cliGlobalId) { toast.error('Seleccioná un cliente'); return }
    setItems(prevItems =>
      prevItems.map(item =>
        item.seleccionado ? { ...item, cliente_id: cliGlobalId, cliente_nombre: cliGlobal } : item
      )
    )
    toast.success('Cliente asignado a ítems seleccionados ✓')
  }

  // Filtro de clientes para el dropdown (GLOBAL)
  const filtCliGlobal = clientesForm.filter(c => cliSearchGlobal && c.nombre.toLowerCase().includes(cliSearchGlobal.toLowerCase())).slice(0,6)

  const guardarTodo = async () => {
    const seleccionados = items.filter(x => x.seleccionado)
    if (!seleccionados.length) { toast.error('Seleccioná al menos un ítem para importar'); return }
    setGuardando(true)
    const tid = toast.loading(`Importando ${seleccionados.length} ítems...`)

    try {
      for (const item of seleccionados) {
        // Lógica de pendiente_compra (desde NuevoItem)
        const isPendienteCompra = (item.destino && item.destino.startsWith('Venta')) && (!item.fecha_compra || item.fecha_compra.trim() === '');

        await supabase.from('items').insert({
          producto: item.producto,
          oem: item.oem || null,
          importe: item.importe_unitario,
          costo_envio: item.costo_envio_unitario,
          taxes: item.taxes_unitario,
          reembolsos: item.reembolsos_unitario,
          costo_total: item.costo_total_unitario,
          cantidad: item.cantidad,
          nro_orden: item.nro_orden || null,
          pagina: item.pagina || null,
          cliente_id: item.cliente_id || null, // Puede venir por item o asignado globalmente
          cliente_nombre: item.cliente_nombre || null, // Puede venir por item o asignado globalmente
          ubicacion: item.ubicacion || 'Proveedor', // Desde Excel
          destino: item.destino || 'Stock EEUU', // Desde Excel
          fecha_compra: item.fecha_compra || new Date().toISOString().split('T')[0], // Desde Excel
          tracking_compra: item.tracking_compra || null, // Desde Excel
          link_tracking_compra: generarParcelsAppLink(item.tracking_compra), // Generar link de tracking
          eta: item.eta || null, // Desde Excel
          pendiente_compra: isPendienteCompra // Lógica de pendiente de compra para importación
        })
      }
      toast.success(`✓ ${seleccionados.length} ítem${seleccionados.length > 1 ? 's' : ''} importados`, { id: tid })
      setGuardando(false); setPaso('listo')
    } catch (e: any) {
      toast.error('Error al importar: ' + (e.message || 'Intentá de nuevo'), { id: tid })
      console.error("Error al guardar todo:", e)
    } finally {
      setGuardando(false)
    }
  }

  // --- JSX de los pasos ---

  if (paso ===
