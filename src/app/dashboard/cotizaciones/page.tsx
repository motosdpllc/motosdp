'use client'

import { useState, useEffect } from 'react'
import { supabase, fmt, fmtDate, getNextCounter } from '@/lib/supabase'
import toast from 'react-hot-toast'

const MULTIPLICADOR = 1.11

interface CotizacionItem {
  id: string // UUID ahora
  cotizacion_id?: string
  cantidad: number
  codigo: string
  descripcion: string
  peso: number
  basoli: number
  partzilla: number
  otra: number
  precio_venta: number
  proveedor_elegido: 'basoli' | 'partzilla' | 'otra' | null
  proveedor_otro_nombre: string
  proveedor_otro_link: string
  estado?: string // Agregado el estado aquí
}

interface Cotizacion {
  id: string
  nro: string
  fecha: string
  cliente_id: string
  cliente_nombre: string
  destino: string
  vin: string
  precio_final: number
  fecha_envio_programado?: string
  hora_programada?: string
  enviar_automatico?: boolean
  mensaje_whatsapp?: string
  mostrar_links?: boolean
  mostrar_precios_individuales?: boolean
  cotizacion_items?: CotizacionItem[]
}

interface Cliente {
  id: string
  nombre: string
  telefono?: string
}

const ITEM_VACIO: CotizacionItem = {
  id: '', // Debe tener un ID, si es nuevo, se generará
  cantidad: 1,
  codigo: '',
  descripcion: '',
  peso: 0,
  basoli: 0,
  partzilla: 0,
  otra: 0,
  precio_venta: 0,
  proveedor_elegido: null,
  proveedor_otro_nombre: '',
  proveedor_otro_link: '',
  estado: 'activo' // Estado por defecto
}

export default function CotizacionesPage() {
  const [vista, setVista] = useState<'lista' | 'editar'>('lista')
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [nro, setNro] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [clienteId, setClienteId] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [destino, setDestino] = useState('AR')
  const [vin, setVin] = useState('')
  const [precioFinal, setPrecioFinal] = useState(0)
  const [fechaEnvioProgramado, setFechaEnvioProgramado] = useState('')
  const [horaEnvioProgramado, setHoraEnvioProgramado] = useState('')
  const [enviarAutomatico, setEnviarAutomatico] = useState(false)
  const [mensajeWhatsapp, setMensajeWhatsapp] = useState('')
  const [mostrarLinks, setMostrarLinks] = useState(false)
  const [mostrarPreciosIndividuales, setMostrarPreciosIndividuales] = useState(true)

  const [items, setItems] = useState<CotizacionItem[]>(Array(30).fill(null).map(() => ({ ...ITEM_VACIO })))
  const [rawText, setRawText] = useState('')
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([])
  const [mostrarListaClientes, setMostrarListaClientes] = useState(false) // Corregido: Ahora se usa aquí
  const [itemActivoIndex, setItemActivoIndex] = useState<number | null>(null)
  const [mostrarModalProveedores, setMostrarModalProveedores] = useState(false)
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState({
    basoli: false,
    partzilla: false,
    otra: false
  })
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false)

  // Calculo el subtotal de todos los items (SOLO ACTIVOS)
  const subtotalItems = items.filter(item => item.estado !== 'cancelado').reduce((sum, item) => sum + (item.cantidad * item.precio_venta), 0)

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true)
        const { data: cots } = await supabase
          .from('cotizaciones')
          .select('*, cotizacion_items(*)')
          .order('created_at', { ascending: false })

        const { data: clis } = await supabase
          .from('clientes')
          .select('*')
          .order('nombre')

        if (cots) setCotizaciones(cots as Cotizacion[])
        if (clis) setClientes(clis as Cliente[])
      } catch (error) {
        toast.error('Error al cargar datos')
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const handleBusquedaCliente = (valor: string) => {
    setBusquedaCliente(valor)
    if (valor.trim()) {
      const filtrados = clientes.filter(c =>
        c.nombre.toLowerCase().includes(valor.toLowerCase())
      )
      setClientesFiltrados(filtrados)
      setMostrarListaClientes(true)
    } else {
      setClientesFiltrados([])
      setMostrarListaClientes(false)
    }
  }

  const seleccionarCliente = (cli: Cliente) => {
    setClienteId(cli.id)
    setClienteNombre(cli.nombre)
    setBusquedaCliente(cli.nombre)
    setMostrarListaClientes(false) // Corregido: ahora usa setMostrarListaClientes
  }

  const procesarPegadoMasivo = () => {
    if (!rawText.trim()) {
      toast.error('Pegá datos primero')
      return
    }

    try {
      const lines = rawText.split('\n').filter(l => l.trim())
      const nuevosItems: CotizacionItem[] = []

      lines.forEach(line => {
        const cols = line.split('\t')
        if (cols.length < 8) return

        const nuevoItem: CotizacionItem = {
          id: crypto.randomUUID(), // Generar un ID para el nuevo ítem
          cantidad: parseInt(cols[0]) || 1,
          codigo: cols[1]?.trim() || '',
          descripcion: cols[2]?.trim() || '',
          peso: parseFloat(cols[3]) || 0,
          basoli: parseFloat(cols[4]) || 0,
          partzilla: parseFloat(cols[5]) || 0,
          otra: parseFloat(cols[6]) || 0,
          precio_venta: parseFloat(cols[7]) || 0,
          proveedor_elegido: null,
          proveedor_otro_nombre: '',
          proveedor_otro_link: '',
          estado: 'activo' // Estado por defecto
        }

        nuevoItem.proveedor_elegido = elegirMejorProveedor(nuevoItem)
        nuevosItems.push(nuevoItem)
      })

      while (nuevosItems.length < 30) {
        nuevosItems.push({ ...ITEM_VACIO, id: crypto.randomUUID() }) // Asegurar ID único
      }

      setItems(nuevosItems.slice(0, 30))
      setRawText('')
      toast.success(`✅ Se procesaron ${lines.length} filas`)
    } catch (err) {
      toast.error('Error al procesar')
    }
  }

  const actualizarItem = (index: number, campo: keyof CotizacionItem, valor: any) => {
    const nuevoItems = [...items]
    if (['peso', 'basoli', 'partzilla', 'otra', 'precio_venta', 'cantidad'].includes(campo)) {
      nuevoItems[index] = { ...nuevoItems[index], [campo]: parseFloat(valor) || 0 }
    } else {
      nuevoItems[index] = { ...nuevoItems[index], [campo]: valor }
    }
    setItems(nuevoItems)
  }

  const calcularCostoConRecargo = (item: CotizacionItem): number => {
    let costo = 0
    if (item.proveedor_elegido === 'basoli') costo = item.basoli
    else if (item.proveedor_elegido === 'partzilla') costo = item.partzilla
    else if (item.proveedor_elegido === 'otra') costo = item.otra
    return parseFloat((costo * MULTIPLICADOR).toFixed(2))
  }

  const esVentaMenor = (item: CotizacionItem): boolean => {
    if (!item.proveedor_elegido || item.cantidad === 0) return false
    const costoConRecargo = calcularCostoConRecargo(item)
    return item.precio_venta > 0 && item.precio_venta < costoConRecargo
  }

  const itemsOrdenados = () => {
    // Solo consideramos items activos para los pedidos a proveedor y cálculo de PDF de cliente
    const activos = items.filter(i => (i.codigo.trim() !== '' || i.descripcion.trim() !== '') && i.cantidad > 0 && i.estado === 'activo')
    const pendientes = items.filter(i => (i.codigo.trim() !== '' || i.descripcion.trim() !== '') && i.cantidad === 0 && i.estado === 'activo')
    const cancelados = items.filter(i => i.estado === 'cancelado')

    return {
      basoli: activos.filter(i => i.proveedor_elegido === 'basoli'),
      partzilla: activos.filter(i => i.proveedor_elegido === 'partzilla'),
      otra: activos.filter(i => i.proveedor_elegido === 'otra'),
      pendientes,
      cancelados
    }
  }

  const nuevaCotizacion = async () => {
    try {
      const contador = await getNextCounter('cot')
      setNro('COT-' + String(contador).padStart(3, '0'))
      setFecha(new Date().toISOString().split('T')[0])
      setClienteId('')
      setClienteNombre('')
      setBusquedaCliente('')
      setDestino('AR')
      setVin('')
      setPrecioFinal(0)
      setFechaEnvioProgramado('')
      setHoraEnvioProgramado('')
      setEnviarAutomatico(false)
      setMensajeWhatsapp('')
      setMostrarLinks(false)
      setMostrarPreciosIndividuales(true)
      setItems(Array(30).fill(null).map(() => ({ ...ITEM_VACIO, id: crypto.randomUUID() }))) // Asegurar ID único
      setItemActivoIndex(null)
      setEditId(null)
      setVista('editar')
    } catch (err) {
      toast.error('Error')
    }
  }

  const editarCotizacion = (cot: Cotizacion) => {
    setEditId(cot.id)
    setNro(cot.nro)
    setFecha(cot.fecha)
    setClienteId(cot.cliente_id || '') // Asegurar string
    setClienteNombre(cot.cliente_nombre || '') // Asegurar string
    setBusquedaCliente(cot.cliente_nombre || '')
    setDestino(cot.destino || 'AR') // Asegurar string
    setVin(cot.vin || '') // Asegurar string
    setPrecioFinal(cot.precio_final || 0)
    setFechaEnvioProgramado(cot.fecha_envio_programado || '')
    setHoraEnvioProgramado(cot.hora_programada || '')
    setEnviarAutomatico(cot.enviar_automatico || false)
    setMensajeWhatsapp(cot.mensaje_whatsapp || '')
    setMostrarLinks(cot.mostrar_links || false)
    setMostrarPreciosIndividuales(cot.mostrar_precios_individuales !== false)

    const itemsCargados = (cot.cotizacion_items || []).map(i => ({
      ...i,
      id: i.id || crypto.randomUUID(), // Asegurar que tenga un ID
      cantidad: i.cantidad || 1,
      codigo: i.codigo || '',
      descripcion: i.descripcion || '',
      peso: i.peso || 0,
      basoli: i.basoli || 0,
      partzilla: i.partzilla || 0,
      otra: i.otra || 0,
      precio_venta: i.precio_venta || 0,
      proveedor_elegido: i.proveedor_elegido || null,
      proveedor_otro_nombre: i.proveedor_otro_nombre || '',
      proveedor_otro_link: i.proveedor_otro_link || '',
      estado: i.estado || 'activo' // Cargar el estado
    })) as CotizacionItem[]

    while (itemsCargados.length < 30) {
      itemsCargados.push({ ...ITEM_VACIO, id: crypto.randomUUID() }) // Asegurar ID único
    }

    setItems(itemsCargados)
    setItemActivoIndex(null)
    setVista('editar')
  }

  const guardarCotizacion = async (e: React.FormEvent, enviarWhatsapp: boolean = false) => {
    e.preventDefault()

    if (!nro || !clienteNombre) {
      toast.error('⚠️ Número y cliente son requeridos')
      return
    }

    if (enviarWhatsapp) {
      const clienteData = clientes.find(c => c.id === clienteId)
      if (!clienteData?.telefono) {
        toast.error('⚠️ El cliente no tiene teléfono')
        return
      }
    }

    try {
      setGuardando(true)

      const datos = {
        nro, fecha, cliente_id: clienteId, cliente_nombre: clienteNombre,
        destino, vin, precio_final: precioFinal,
        fecha_envio_programado: fechaEnvioProgramado || null,
        hora_programada: horaEnvioProgramado || null,
        enviar_automatico: enviarAutomatico,
        mensaje_whatsapp: mensajeWhatsapp || null,
        mostrar_links: mostrarLinks,
        mostrar_precios_individuales: mostrarPreciosIndividuales
      }

      let cotizacionId = editId

      if (editId) {
        const { error } = await supabase.from('cotizaciones').update(datos).eq('id', editId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('cotizaciones').insert([datos]).select().single()
        if (error) throw error
        cotizacionId = data.id
      }

      if (cotizacionId) {
        // Filtramos items vacíos antes de borrar/insertar
        const itemsToProcess = items.filter(i => i.codigo.trim() !== '' || i.descripcion.trim() !== '');

        // Borramos los items anteriores
        await supabase.from('cotizacion_items').delete().eq('cotizacion_id', cotizacionId);

        // Insertamos los nuevos items (con sus IDs)
        if (itemsToProcess.length > 0) {
            const itemsWithCorrectCotId = itemsToProcess.map(i => ({
                ...i,
                cotizacion_id: cotizacionId,
                id: i.id || crypto.randomUUID() // Asegurar que cada ítem tenga un ID
            }));
            const { error } = await supabase.from('cotizacion_items').insert(itemsWithCorrectCotId);
            if (error) throw error;
        }
      }

      toast.success('✅ Guardada')

      if (enviarWhatsapp) {
        setEnviandoWhatsapp(true)
        const clienteData = clientes.find(c => c.id === clienteId)
        if (clienteData?.telefono) {
          const mensaje = encodeURIComponent(mensajeWhatsapp || `Hola ${clienteNombre}, cotización ${nro}`)
          window.open(`https://wa.me/${clienteData.telefono}?text=${mensaje}`, '_blank')
        }
        const { data: cots } = await supabase
          .from('cotizaciones').select('*, cotizacion_items(*)').order('created_at', { ascending: false })
        if (cots) setCotizaciones(cots as Cotizacion[])
        setEnviandoWhatsapp(false)
      } else {
        const { data: cots } = await supabase
          .from('cotizaciones').select('*, cotizacion_items(*)').order('created_at', { ascending: false })
        if (cots) setCotizaciones(cots as Cotizacion[])
      }

      setVista('lista')
      setEditId(null)
    } catch (err: any) {
      toast.error('❌ Error al guardar cotización: ' + err.message)
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  const eliminarCotizacion = async (id: string) => {
    if (!confirm('¿Eliminar?')) return
    try {
      setLoading(true)
      await supabase.from('cotizacion_items').delete().eq('cotizacion_id', id)
      await supabase.from('cotizaciones').delete().eq('id', id)
      toast.success('✅ Eliminada')
      const { data: cots } = await supabase.from('cotizaciones').select('*, cotizacion_items(*)').order('created_at', { ascending: false })
      if (cots) setCotizaciones(cots as Cotizacion[])
    } catch (err: any) {
      toast.error('❌ Error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const generarPDFCliente = () => {
    const { basoli, partzilla, otra, pendientes, cancelados } = itemsOrdenados() // Incluimos cancelados
    const todosActivos = [...basoli, ...partzilla, ...otra]

    let filas = '', totalVenta = 0
    todosActivos.forEach(item => {
      const totalItem = item.cantidad * item.precio_venta
      totalVenta += totalItem

      const linkHTML = mostrarLinks && item.proveedor_otro_link ? `<br/><a href="${item.proveedor_otro_link}" style="color: #0066cc; font-size: 11px;">🔗 Ver producto</a>` : ''
      const precioUnitarioHTML = mostrarPreciosIndividuales ? `$${item.precio_venta.toFixed(2)}` : 'Incluido'
      const subtotalItemHTML = mostrarPreciosIndividuales ? `$${totalItem.toFixed(2)}` : 'Incluido'

      filas += `
        <tr>
          <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: center;">${item.cantidad}</td>
          <td style="border: 1px solid #e0e0e0; padding: 10px; font-family: 'Courier New', Courier, monospace;">${item.codigo}</td>
          <td style="border: 1px solid #e0e0e0; padding: 10px;">
            ${item.descripcion}
            ${linkHTML}
          </td>
          <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: right;">${precioUnitarioHTML}</td>
          <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: right;">${subtotalItemHTML}</td>
        </tr>
      `
    })

    // Filas para ítems cancelados (opcional, se pueden mostrar abajo o no mostrar)
    let filasCancelados = '';
    if (cancelados.length > 0) {
      filasCancelados += `
        <tr><td colspan="5" style="border: 1px solid #e0e0e0; padding: 10px; background-color: #fcebeb; font-weight: bold; text-align: center;">Ítems Cancelados/No disponibles</td></tr>
      `;
      cancelados.forEach(item => {
        filasCancelados += `
          <tr>
            <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: center;">${item.cantidad}</td>
            <td style="border: 1px solid #e0e0e0; padding: 10px; font-family: 'Courier New', Courier, monospace; text-decoration: line-through;">${item.codigo}</td>
            <td style="border: 1px solid #e0e0e0; padding: 10px; text-decoration: line-through;">${item.descripcion}</td>
            <td colspan="2" style="border: 1px solid #e0e0e0; padding: 10px; text-align: center; color: #cc0000;">CANCELADO</td>
          </tr>
        `;
      });
    }


    const encabezadoTabla = mostrarPreciosIndividuales
      ? '<th>Precio Unit.</th><th>Subtotal</th>'
      : '<th colspan="2">Valor</th>'

    const LOGO_URL = 'https://your-logo-url.com/logo.png'; // Reemplaza con la URL de tu logo

    const printWindow = window.open('', '', 'height=800,width=1000')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Cotización ${nro} - ${clienteNombre}</title>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Roboto', sans-serif; padding: 30px; color: #333; line-height: 1.6; }
              .header { text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #0066cc; }
              .header img { max-height: 80px; margin-bottom: 10px; }
              .header h1 { margin: 0; color: #0066cc; font-size: 32px; font-weight: 700; }
              .header p { margin: 5px 0; font-size: 14px; color: #555; }
              .info-box { background-color: #f0f8ff; border: 1px solid #b0e0e6; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
              .info-box p { margin: 5px 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 25px; border: 1px solid #e0e0e0; }
              th, td { border: 1px solid #e0e0e0; padding: 12px; text-align: left; }
              th { background-color: #e6f7ff; color: #0066cc; font-weight: 700; text-transform: uppercase; font-size: 13px; }
              .total-row td { background-color: #f0f0f0; font-weight: bold; font-size: 15px; }
              .final-price-box { background-color: #0066cc; color: white; font-size: 24px; font-weight: 700; padding: 20px; text-align: right; margin-top: 30px; border-radius: 8px; }
              .pendientes { margin-top: 25px; padding: 15px; background-color: #fff8e1; border-left: 5px solid #ffc107; color: #8d6e63; }
              .pendientes p { margin: 0; font-size: 13px; }
              .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 11px; color: #999; text-align: center; }
              @media print { body { margin: 0; padding: 0; } }
            </style>
          </head>
          <body>
            <div class="header">
              ${LOGO_URL !== 'https://your-logo-url.com/logo.png' ? `<img src="${LOGO_URL}" alt="Logo de la empresa" />` : ''}
              <h1>COTIZACIÓN ${nro}</h1>
              <p>Fecha: ${new Date(fecha).toLocaleDateString('es-AR')}</p>
            </div>

            <div class="info-box">
              <p><strong>Cliente:</strong> ${clienteNombre}</p>
              ${vin ? `<p><strong>VIN:</strong> ${vin}</p>` : ''}
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 50px; text-align: center;">Cant</th>
                  <th style="width: 100px;">Código</th>
                  <th>Descripción</th>
                  ${encabezadoTabla}
                </tr>
              </thead>
              <tbody>
                ${filas}
                <tr class="total-row">
                  <td colspan="3" style="text-align: right;">SUBTOTAL DE ÍTEMS:</td>
                  <td colspan="2" style="text-align: right;">$${totalVenta.toFixed(2)}</td>
                </tr>
                ${filasCancelados}
              </tbody>
            </table>

            ${pendientes.length > 0 ? `
              <div class="pendientes">
                <p><strong>⏳ Pendiente de cotizar:</strong> ${pendientes.map(p => p.codigo).join(', ')}</p>
              </div>
            ` : ''}

            ${precioFinal > 0 ? `
              <div class="final-price-box">
                PRECIO FINAL: $${precioFinal.toFixed(2)}
              </div>
            ` : ''}

            <div class="footer">
              <p>Cotización generada el ${new Date().toLocaleDateString('es-AR')} a las ${new Date().toLocaleTimeString('es-AR')}</p>
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
      setTimeout(() => printWindow.print(), 250)
    }
  }

  const generarPDFProveedor = (proveedor: 'basoli' | 'partzilla' | 'otra') => {
    const { basoli, partzilla, otra } = itemsOrdenados() // Llamar aquí
    const items = proveedor === 'basoli' ? basoli : proveedor === 'partzilla' ? partzilla : otra

    if (items.length === 0) {
      toast.error('No hay items para este proveedor')
      return
    }

    const nombreProveedor = proveedor === 'basoli' ? 'BÁSOLI' : proveedor === 'partzilla' ? 'PARTZILLA' : 'OTROS PROVEEDORES'
    const LOGO_URL = 'https://your-logo-url.com/logo.png'; // Reemplaza con la URL de tu logo

    let filas = '', totalCosto = 0
    items.forEach(item => {
      const costo = (proveedor === 'basoli' ? item.basoli : proveedor === 'partzilla' ? item.partzilla : item.otra) * MULTIPLICADOR
      const total = costo * item.cantidad
      totalCosto += total
      filas += `
        <tr>
          <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: center;">${item.cantidad}</td>
          <td style="border: 1px solid #e0e0e0; padding: 10px; font-family: 'Courier New', Courier, monospace;">${item.codigo}</td>
          <td style="border: 1px solid #e0e0e0; padding: 10px;">${item.descripcion}</td>
          <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: right;">$${costo.toFixed(2)}</td>
          <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: right;">$${total.toFixed(2)}</td>
        </tr>
      `
    })

    const printWindow = window.open('', '', 'height=800,width=1000')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Pedido ${nombreProveedor} - ${nro}</title>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Roboto', sans-serif; padding: 30px; color: #333; line-height: 1.6; }
              .header { text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #ff6b00; }
              .header img { max-height: 80px; margin-bottom: 10px; }
              .header h1 { margin: 0; color: #ff6b00; font-size: 32px; font-weight: 700; }
              .header p { margin: 5px 0; font-size: 14px; color: #555; }
              .info-box { background-color: #fff0e0; border: 1px solid #ffcc99; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
              .info-box p { margin: 5px 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 25px; border: 1px solid #e0e0e0; }
              th, td { border: 1px solid #e0e0e0; padding: 12px; text-align: left; }
              th { background-color: #ffe6cc; color: #ff6b00; font-weight: 700; text-transform: uppercase; font-size: 13px; }
              .total-row td { background-color: #f0f0f0; font-weight: bold; font-size: 15px; }
              .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 11px; color: #999; text-align: center; }
              @media print { body { margin: 0; padding: 0; } }
            </style>
          </head>
          <body>
            <div class="header">
              ${LOGO_URL !== 'https://your-logo-url.com/logo.png' ? `<img src="${LOGO_URL}" alt="Logo de la empresa" />` : ''}
              <h1>PEDIDO A ${nombreProveedor}</h1>
              <p>Cotización: ${nro} | Cliente: ${clienteNombre}</p>
              <p>Fecha: ${new Date(fecha).toLocaleDateString('es-AR')}</p>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 50px; text-align: center;">Cant</th>
                  <th style="width: 100px;">Código</th>
                  <th>Descripción</th>
                  <th>Costo Unit. x ${MULTIPLICADOR}</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${filas}
                <tr class="total-row">
                  <td colspan="4" style="text-align: right;">TOTAL COSTO:</td>
                  <td style="text-align: right;">$${totalCosto.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <div class="footer">
              <p>Pedido generado el ${new Date().toLocaleDateString('es-AR')} a las ${new Date().toLocaleTimeString('es-AR')}</p>
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
      setTimeout(() => printWindow.print(), 250)
    }
  }

  const abrirWhatsapp = (cot: Cotizacion) => {
    const cliente = clientes.find(c => c.id === cot.cliente_id)
    if (!cliente?.telefono) {
      toast.error('El cliente no tiene teléfono registrado')
      return
    }

    const mensaje = encodeURIComponent(
      cot.mensaje_whatsapp || `Hola ${clienteNombre}, te envío la cotización ${nro}`
    )
    window.open(`https://wa.me/${cliente.telefono}?text=${mensaje}`, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-500 text-lg">Cargando...</p>
      </div>
    )
  }

  if (vista === 'lista') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Cotizaciones</h1>
            <button
              onClick={nuevaCotizacion}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-semibold"
            >
              + Nueva Cotización
            </button>
          </div>

          {cotizaciones.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 text-lg">No hay cotizaciones aún</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="px-6 py-3 text-left text-sm font-bold">Nro</th>
                    <th className="px-6 py-3 text-left text-sm font-bold">Cliente</th>
                    <th className="px-6 py-3 text-left text-sm font-bold">VIN</th>
                    <th className="px-6 py-3 text-left text-sm font-bold">Fecha</th>
                    <th className="px-6 py-3 text-left text-sm font-bold">Items</th>
                    <th className="px-6 py-3 text-center text-sm font-bold">Envío</th>
                    <th className="px-6 py-3 text-right text-sm font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cotizaciones.map(cot => {
                    const ahora = new Date()
                    const fechaEnvio = cot.fecha_envio_programado ? new Date(cot.fecha_envio_programado) : null
                    const debioEnviar = cot.enviar_automatico && fechaEnvio && fechaEnvio <= ahora

                    return (
                      <tr key={cot.id} className={`border-b hover:bg-gray-50 ${debioEnviar ? 'bg-yellow-50' : ''}`}>
                        <td className="px-6 py-3 font-semibold">{cot.nro}</td>
                        <td className="px-6 py-3">{cot.cliente_nombre}</td>
                        <td className="px-6 py-3 text-sm font-mono">{cot.vin || '—'}</td>
                        <td className="px-6 py-3 text-sm">{fmtDate(cot.fecha)}</td>
                        <td className="px-6 py-3 text-sm">{cot.cotizacion_items?.length || 0}</td>
                        <td className="px-6 py-3 text-center text-xs">
                          {cot.enviar_automatico && cot.fecha_envio_programado && (
                            <span className={debioEnviar ? 'bg-yellow-200 text-yellow-800 px-2 py-1 rounded' : 'bg-blue-200 text-blue-800 px-2 py-1 rounded'}>
                              {fmtDate(cot.fecha_envio_programado)} {cot.hora_programada}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right space-x-2">
                          <button
                            onClick={() => editarCotizacion(cot)}
                            className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => abrirWhatsapp(cot)}
                            className="text-green-600 hover:text-green-800 font-semibold text-sm"
                          >
                            💬 WA
                          </button>
                          <button
                            onClick={() => eliminarCotizacion(cot.id)}
                            className="text-red-600 hover:text-red-800 font-semibold text-sm"
                          >
                            Borrar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  const ordenados = itemsOrdenados()

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">
            {editId ? 'Editar Cotización' : 'Nueva Cotización'}
          </h1>
          <button
            onClick={() => setVista('lista')}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            ← Volver
          </button>
        </div>

        <form onSubmit={(e) => guardarCotizacion(e, false)}>
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-bold mb-1">Nro Cotización</label>
                <input
                  type="text"
                  value={nro}
                  disabled
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Fecha</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Destino</label>
                <select
                  value={destino}
                  onChange={e => setDestino(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="AR">Argentina</option>
                  <option value="EEUU">Estados Unidos</option>
                  <option value="INT">Internacional</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">VIN</label>
                <input
                  type="text"
                  value={vin}
                  onChange={e => setVin(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Ej: JH2RC5004LM200001"
                />
              </div>
            </div>

            <div className="mt-4 relative">
              <label className="block text-sm font-bold mb-1">Cliente</label>
              <input
                type="text"
                value={busquedaCliente}
                onChange={e => handleBusquedaCliente(e.target.value)}
                onFocus={() => busquedaCliente && setMostrarListaClientes(true)}
                className="w-full border rounded px-3 py-2"
                placeholder="Escribí el nombre del cliente..."
              />

              {mostrarListaClientes && clientesFiltrados.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border rounded mt-1 shadow-lg z-10 max-h-48 overflow-y-auto">
                  {clientesFiltrados.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => seleccionarCliente(c)}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0"
                    >
                      {c.nombre}
                      {c.telefono && <span className="text-xs text-gray-500 ml-2">({c.telefono})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Opciones de PDF */}
            <div className="mt-4 p-4 bg-purple-50 rounded border border-purple-200">
              <h3 className="font-bold text-sm mb-3">🎨 Opciones de PDF para Cliente</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={mostrarLinks}
                    onChange={e => setMostrarLinks(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Mostrar links de productos</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={mostrarPreciosIndividuales}
                    onChange={e => setMostrarPreciosIndividuales(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Mostrar precios individuales (si no: muestra "Incluido")</span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-lg font-bold mb-3">📋 Pegado Masivo (TSV)</h2>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="Cantidad	Código	Descripción	Peso	Basoli	Partzilla	Otra	Precio Venta
1	BRC-001	Frenos	0.5	100	120	110	150
2	MGN-002	Magneto	1.2	300	350	320	450"
              className="w-full h-24 border rounded px-3 py-2 font-mono text-xs mb-3"
            />
            <button
              type="button"
              onClick={procesarPegadoMasivo}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold"
            >
              Procesar Excel
            </button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-x-auto mb-6">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="text-lg font-bold">Items Activos (Ordenados por Proveedor)</h2>
            </div>

            {ordenados.basoli.length > 0 && (
              <div className="p-4 border-b">
                <h3 className="font-bold text-blue-600 mb-3">🏭 BÁSOLI ({ordenados.basoli.length})</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-2 py-2 text-left font-bold">Cant</th>
                      <th className="px-2 py-2 text-left font-bold">Código</th>
                      <th className="px-2 py-2 text-left font-bold">Descripción</th>
                      <th className="px-2 py-2 text-center font-bold">Costo x 1.11</th>
                      <th className="px-2 py-2 text-center font-bold">Venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenados.basoli.map((item, idx) => (
                      <tr key={idx} className={esVentaMenor(item) ? 'bg-red-200' : ''}>
                        <td className="px-2 py-1">{item.cantidad}</td>
                        <td className="px-2 py-1 font-mono">{item.codigo}</td>
                        <td className="px-2 py-1">{item.descripcion}</td>
                        <td className="px-2 py-1 text-center font-bold">${(item.basoli * MULTIPLICADOR).toFixed(2)}</td>
                        <td className="px-2 py-1 text-center font-bold text-green-700">${item.precio_venta.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {ordenados.partzilla.length > 0 && (
              <div className="p-4 border-b">
                <h3 className="font-bold text-orange-600 mb-3">🔧 PARTZILLA ({ordenados.partzilla.length})</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-2 py-2 text-left font-bold">Cant</th>
                      <th className="px-2 py-2 text-left font-bold">Código</th>
                      <th className="px-2 py-2 text-left font-bold">Descripción</th>
                      <th className="px-2 py-2 text-center font-bold">Costo x 1.11</th>
                      <th className="px-2 py-2 text-center font-bold">Venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenados.partzilla.map((item, idx) => (
                      <tr key={idx} className={esVentaMenor(item) ? 'bg-red-200' : ''}>
                        <td className="px-2 py-1">{item.cantidad}</td>
                        <td className="px-2 py-1 font-mono">{item.codigo}</td>
                        <td className="px-2 py-1">{item.descripcion}</td>
                        <td className="px-2 py-1 text-center font-bold">${(item.partzilla * MULTIPLICADOR).toFixed(2)}</td>
                        <td className="px-2 py-1 text-center font-bold text-green-700">${item.precio_venta.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {ordenados.otra.length > 0 && (
              <div className="p-4 border-b">
                <h3 className="font-bold text-purple-600 mb-3">🌐 OTROS PROVEEDORES ({ordenados.otra.length})</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-2 py-2 text-left font-bold">Cant</th>
                      <th className="px-2 py-2 text-left font-bold">Código</th>
                      <th className="px-2 py-2 text-left font-bold">Descripción</th>
                      <th className="px-2 py-2 text-left font-bold">Proveedor</th>
                      <th className="px-2 py-2 text-center font-bold">Costo x 1.11</th>
                      <th className="px-2 py-2 text-center font-bold">Venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenados.otra.map((item, idx) => (
                      <tr key={idx} className={esVentaMenor(item) ? 'bg-red-200' : ''}>
                        <td className="px-2 py-1">{item.cantidad}</td>
                        <td className="px-2 py-1 font-mono">{item.codigo}</td>
                        <td className="px-2 py-1">{item.descripcion}</td>
                        <td className="px-2 py-1 text-sm">
                          {item.proveedor_otro_link ? (
                            <a href={item.proveedor_otro_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {item.proveedor_otro_nombre} 🔗
                            </a>
                          ) : (
                            item.proveedor_otro_nombre || '—'
                          )}
                        </td>
                        <td className="px-2 py-1 text-center font-bold">${(item.otra * MULTIPLICADOR).toFixed(2)}</td>
                        <td className="px-2 py-1 text-center font-bold text-green-700">${item.precio_venta.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {ordenados.pendientes.length > 0 && (
              <div className="p-4 bg-yellow-50">
                <p className="font-bold text-yellow-800">
                  ⏳ Pendiente de cotización: {ordenados.pendientes.map(p => p.codigo).join(', ')}
                </p>
              </div>
            )}
            {ordenados.cancelados.length > 0 && (
              <div className="p-4 bg-red-50">
                <p className="font-bold text-red-800">
                  🚫 Ítems cancelados: {ordenados.cancelados.map(p => p.codigo).join(', ')}
                </p>
              </div>
            )}
          </div>

          {/* TABLA DE EDICIÓN INDIVIDUAL */}
          <div className="bg-white rounded-lg shadow overflow-x-auto mb-6">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="text-lg font-bold">Editar Items (Todos los detalles)</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-2 py-2 text-left font-bold">Cant</th>
                  <th className="px-2 py-2 text-left font-bold">Código</th>
                  <th className="px-2 py-2 text-left font-bold">Descripción</th>
                  <th className="px-2 py-2 text-center font-bold">Peso</th>
                  <th className="px-2 py-2 text-center font-bold">Basoli</th>
                  <th className="px-2 py-2 text-center font-bold">Partzilla</th>
                  <th className="px-2 py-2 text-center font-bold">Otra</th>
                  <th className="px-2 py-2 text-center font-bold">Prov</th>
                  <th className="px-2 py-2 text-center font-bold">Costo x 1.11</th>
                  <th className="px-2 py-2 text-center font-bold">Venta</th>
                  <th className="px-2 py-2 text-center font-bold">Estado</th> {/* Nueva columna */}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const costoConRecargo = calcularCostoConRecargo(item)
                  const esAlerta = esVentaMenor(item)
                  const rowClass = esAlerta ? 'bg-red-200' : item.estado === 'cancelado' ? 'bg-gray-100 text-gray-500 line-through' : ''

                  return (
                    <tr key={idx} className={`border-b ${rowClass}`}>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          value={item.cantidad || ''}
                          onChange={e => actualizarItem(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                          className="w-12 border rounded px-1 py-0.5 text-center text-sm"
                          disabled={item.estado === 'cancelado'}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={item.codigo}
                          onChange={e => actualizarItem(idx, 'codigo', e.target.value)}
                          className="w-16 border rounded px-1 py-0.5 text-sm font-mono"
                          disabled={item.estado === 'cancelado'}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={item.descripcion}
                          onChange={e => actualizarItem(idx, 'descripcion', e.target.value)}
                          onClick={() => setItemActivoIndex(idx)}
                          className="w-32 border rounded px-1 py-0.5 text-sm cursor-pointer hover:bg-gray-100"
                          placeholder="Click para detalles..."
                          disabled={item.estado === 'cancelado'}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          step="0.1"
                          value={item.peso || ''}
                          onChange={e => actualizarItem(idx, 'peso', parseFloat(e.target.value) || 0)}
                          className="w-14 border rounded px-1 py-0.5 text-center text-sm"
                          disabled={item.estado === 'cancelado'}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          step="0.01"
                          value={item.basoli || ''}
                          onChange={e => actualizarItem(idx, 'basoli', parseFloat(e.target.value) || 0)}
                          className="w-14 border rounded px-1 py-0.5 text-center text-sm bg-gray-50"
                          disabled={item.estado === 'cancelado'}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          step="0.01"
                          value={item.partzilla || ''}
                          onChange={e => actualizarItem(idx, 'partzilla', parseFloat(e.target.value) || 0)}
                          className="w-14 border rounded px-1 py-0.5 text-center text-sm bg-gray-50"
                          disabled={item.estado === 'cancelado'}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          step="0.01"
                          value={item.otra || ''}
                          onChange={e => actualizarItem(idx, 'otra', parseFloat(e.target.value) || 0)}
                          onClick={() => setItemActivoIndex(idx)}
                          className="w-14 border rounded px-1 py-0.5 text-center text-sm bg-purple-50 cursor-pointer hover:bg-purple-100 font-semibold text-purple-800"
                          disabled={item.estado === 'cancelado'}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={item.proveedor_elegido || ''}
                          onChange={e => actualizarItem(idx, 'proveedor_elegido', e.target.value || null)}
                          className="w-16 border rounded px-1 py-0.5 text-center text-sm bg-blue-50 font-bold"
                          disabled={item.estado === 'cancelado'}
                        >
                          <option value="">—</option>
                          <option value="basoli">Basoli</option>
                          <option value="partzilla">Partzilla</option>
                          <option value="otra">Otra</option>
                        </select>
                      </td>
                      <td className="px-2 py-1 text-center text-sm font-bold">
                        {costoConRecargo > 0 ? `$${costoConRecargo.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          step="0.01"
                          value={item.precio_venta || ''}
                          onChange={e => actualizarItem(idx, 'precio_venta', parseFloat(e.target.value) || 0)}
                          className={`w-16 border rounded px-1 py-0.5 text-center text-sm font-bold ${
                            esAlerta ? 'bg-red-600 text-white border-red-700' : 'bg-green-50 text-green-700'
                          }`}
                          disabled={item.estado === 'cancelado'}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={item.estado || 'activo'}
                          onChange={e => actualizarItem(idx, 'estado', e.target.value)}
                          className={`w-20 border rounded px-1 py-0.5 text-center text-sm ${item.estado === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-gray-50'}`}
                        >
                          <option value="activo">Activo</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* SECCIÓN FINAL DE COTIZACIÓN */}
          <div className="bg-blue-50 p-6 rounded-lg shadow mb-6">
            <h2 className="text-lg font-bold mb-3">💲 Resumen y Cierre</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-1">Subtotal de Ítems</label>
                <p className="w-full border rounded px-3 py-2 bg-gray-100 font-bold text-lg">
                  {fmt(subtotalItems)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Precio Final (opcional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={precioFinal}
                  onChange={e => setPrecioFinal(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-3 py-2 font-bold text-lg"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-bold mb-1">Mensaje WhatsApp (opcional)</label>
              <textarea
                value={mensajeWhatsapp}
                onChange={e => setMensajeWhatsapp(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm h-20"
                placeholder="Hola [Cliente], aquí está tu cotización [Nro]..."
              />
            </div>
          </div>

          {/* Envío Programado */}
          <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
              <label className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={enviarAutomatico}
                  onChange={e => setEnviarAutomatico(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="font-bold">📅 Programar envío automático de WhatsApp</span>
              </label>

              {enviarAutomatico && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Fecha de envío</label>
                    <input
                      type="date"
                      value={fechaEnvioProgramado}
                      onChange={e => setFechaEnvioProgramado(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Hora de envío</label>
                    <input
                      type="time"
                      value={horaEnvioProgramado}
                      onChange={e => setHoraEnvioProgramado(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>
              )}
            </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="flex gap-3 justify-end mb-6 flex-wrap">
            <button
              type="button"
              onClick={() => setVista('lista')}
              className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 font-semibold"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={generarPDFCliente}
              className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-semibold"
            >
              📄 PDF Cliente
            </button>

            <button
              type="button"
              onClick={() => setMostrarModalProveedores(true)}
              className="px-6 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 font-semibold"
            >
              📋 PDF Proveedores
            </button>

            <button
              type="submit"
              disabled={guardando || enviandoWhatsapp}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : '✅ Guardar'}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                guardarCotizacion(e, true)
              }}
              disabled={guardando || enviandoWhatsapp}
              className="px-6 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-semibold disabled:opacity-50"
            >
              {enviandoWhatsapp ? '📤 Enviando...' : '💬 Guardar y Enviar WA'}
            </button>
          </div>
        </form>

        {mostrarModalProveedores && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-lg font-bold mb-4">Generar PDF para Proveedores</h2>

              <div className="space-y-3 mb-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={proveedoresSeleccionados.basoli}
                    onChange={e => setProveedoresSeleccionados({ ...proveedoresSeleccionados, basoli: e.target.checked })}
                    className="w-4 h-4"
                    disabled={ordenados.basoli.length === 0}
                  />
                  <span className="font-semibold">BÁSOLI ({ordenados.basoli.length} items)</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={proveedoresSeleccionados.partzilla}
                    onChange={e => setProveedoresSeleccionados({ ...proveedoresSeleccionados, partzilla: e.target.checked })}
                    className="w-4 h-4"
                    disabled={ordenados.partzilla.length === 0}
                  />
                  <span className="font-semibold">PARTZILLA ({ordenados.partzilla.length} items)</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={proveedoresSeleccionados.otra}
                    onChange={e => setProveedoresSeleccionados({ ...proveedoresSeleccionados, otra: e.target.checked })}
                    className="w-4 h-4"
                    disabled={ordenados.otra.length === 0}
                  />
                  <span className="font-semibold">OTROS PROVEEDORES ({ordenados.otra.length} items)</span>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMostrarModalProveedores(false)}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (proveedoresSeleccionados.basoli) generarPDFProveedor('basoli')
                    if (proveedoresSeleccionados.partzilla) generarPDFProveedor('partzilla')
                    if (proveedoresSeleccionados.otra) generarPDFProveedor('otra')
                    setMostrarModalProveedores(false)
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
                >
                  Descargar
                </button>
              </div>
            </div>
          </div>
        )}

        {itemActivoIndex !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
            <div className="bg-white w-full md:w-96 h-screen md:h-auto md:rounded-lg p-6 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">
                  ⚙️ Detalles Línea #{itemActivoIndex + 1}
                </h2>
                <button
                  type="button"
                  onClick={() => setItemActivoIndex(null)}
                  className="text-gray-500 hover:text-gray-700 font-bold text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Código</label>
                  <input
                    type="text"
                    value={items[itemActivoIndex]?.codigo || ''}
                    onChange={e => actualizarItem(itemActivoIndex, 'codigo', e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1">Descripción</label>
                  <input
                    type="text"
                    value={items[itemActivoIndex]?.descripcion || ''}
                    onChange={e => actualizarItem(itemActivoIndex, 'descripcion', e.target.value)}
                    // Aquí se usa itemActivoIndex, no idx
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={items[itemActivoIndex]?.peso || ''}
                    onChange={e => actualizarItem(itemActivoIndex, 'peso', parseFloat(e.target.value) || 0)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-bold text-sm mb-3">Proveedor Externo</h3>

                  <div className="mb-3">
                    <label className="block text-xs font-bold mb-1">Nombre (Ej: CMSNL, Ebay)</label>
                    <input
                      type="text"
                      value={items[itemActivoIndex]?.proveedor_otro_nombre || ''}
                      onChange={e => actualizarItem(itemActivoIndex, 'proveedor_otro_nombre', e.target.value)}
                      className="w-full border rounded px-3 py-1 text-xs uppercase"
                      placeholder="Nombre del proveedor..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1">Link Web</label>
                    <input
                      type="text"
                      value={items[itemActivoIndex]?.proveedor_otro_link || ''}
                      onChange={e => actualizarItem(itemActivoIndex, 'proveedor_otro_link', e.target.value)}
                      className="w-full border rounded px-3 py-1 text-xs font-mono text-blue-600"
                      placeholder="https://..."
                    />
                  </div>

                  {items[itemActivoIndex]?.proveedor_otro_link && (
                    <a
                      href={items[itemActivoIndex]?.proveedor_otro_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs mt-2 block font-semibold"
                    >
                      🌐 Abrir en la web
                    </a>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setItemActivoIndex(null)}
                className="w-full mt-6 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

---

## **6. `src/app/dashboard/inventario/page.tsx`**

1.  Abre tu GitHub.
2.  Ve a `src/app/dashboard/inventario/page.tsx`.
3.  **SELECCIONA TODO el contenido actual del archivo (Ctrl+A o Cmd+A) y BÓRRALO POR COMPLETO.**
4.  **PEGA TODO este código:**

```typescript
'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { supabase, fmt, fmtDate, type Item } from '@/lib/supabase'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { CheckCircle } from 'lucide-react' // Importa CheckCircle

// --- UBICACIONES ---
// Las ubicaciones que representan Stock físico en el inventario para el filtro
const UBICACIONES_FILTRO = ['Proveedor','En tránsito','En tránsito a Daniel','Daniel','Pablo','Blue Mail','Tato','Tránsito a Bs As','En Mano','Stock EEUU', 'Stock España', 'Stock Argentina', 'Vendido', 'Cancelado', 'Entregado']

const DESTINOS = ['Stock EEUU', 'Stock España', 'Stock Argentina', 'Venta Argentina', 'Venta Internacional', 'Uso Propio', 'Stock Internacional']

function InventarioTable() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [ubic, setUbic] = useState('')
  const [dest, setDest] = useState('')
  const [pub, setPub] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    const u = searchParams.get('ubicacion')
    if (u) setUbic(u)
  }, [searchParams])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Incluir pendiente_compra y fecha_entregado en el select
      let query = supabase.from('items').select('*, pendiente_compra, fecha_entregado').order('created_at', { ascending: false })
      if (ubic) query = query.eq('ubicacion', ubic)
      if (dest) query = query.eq('destino', dest)
      const { data } = await query.limit(500)
      let filtered = data || []
      if (search) {
        const q = search.toLowerCase()
        filtered = filtered.filter((x: any) =>
          (x.producto || '').toLowerCase().includes(q) ||
          (x.oem || '').toLowerCase().includes(q) ||
          (x.codigo || '').toLowerCase().includes(q) ||
          (x.nro_orden || '').toLowerCase().includes(q) ||
          (x.cliente_nombre || '').toLowerCase().includes(q) ||
          (x.tracking_compra || '').toLowerCase().includes(q)
        )
      }
      if (pub === 'si') filtered = filtered.filter((x: any) => x.plataforma)
      if (pub === 'no') filtered = filtered.filter((x: any) => !x.plataforma)
      setItems(filtered)
    } catch (err) {
      toast.error('Error al cargar inventario')
    }
    setLoading(false)
  }, [search, ubic, dest, pub])

  useEffect(() => { load() }, [load])

  const eliminarProducto = async (id: string) => {
    if (!confirm('¿Seguro que querés eliminar este producto? Esta acción no se puede deshacer.')) return
    try {
      const { error } = await supabase.from('items').delete().eq('id', id)
      if (error) throw error
      toast.success('Producto eliminado')
      load()
    } catch (error) {
      toast.error('No se pudo eliminar')
    }
  }

  const openTrackCompra = (id: string) => {
    const item = items.find((x: any) => x.id === id)
    if (!item) return
    const tracking = prompt('Tracking de compra:', item.tracking_compra || '')
    if (tracking === null) return
    const eta = prompt('ETA (YYYY-MM-DD):', item.eta || '')
    const linkTracking = prompt('Link de tracking:', item.link_tracking_compra || '')
    supabase.from('items').update({
      tracking_compra: tracking,
      eta: eta || null,
      link_tracking_compra: linkTracking || null,
      updated_at: new Date().toISOString()
    }).eq('id', id).then(() => load())
  }

  const openTrackVenta = (id: string) => {
    const item = items.find((x: any) => x.id === id)
    if (!item) return
    const tracking = prompt('Tracking de envío:', item.tracking_venta || '')
    if (tracking === null) return
    supabase.from('items').update({
      tracking_venta: tracking,
      updated_at: new Date().toISOString()
    }).eq('id', id).then(() => load())
  }

  // --- NUEVA FUNCIÓN: Marcar como entregado ---
  const marcarEntregado = async (id: string) => {
    if (!confirm('¿Marcar este producto como ENTREGADO al cliente?')) return
    try {
      const { error } = await supabase.from('items').update({
        ubicacion: 'Entregado', // Cambia la ubicación a Entregado
        destino: 'Vendido', // Asegura que el destino sea Vendido
        fecha_entregado: new Date().toISOString().split('T')[0], // Guarda la fecha de hoy
        updated_at: new Date().toISOString()
      }).eq('id', id)
      if (error) throw error
      toast.success('Producto marcado como entregado ✓')
      load()
    } catch (error) {
      toast.error('Error al marcar como entregado')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Inventario</h1>
          <a href="/dashboard/nuevo" className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold">
            + Nuevo ítem
          </a>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6 grid grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <select value={ubic} onChange={(e) => setUbic(e.target.value)} className="w-full border rounded px-3 py-2">
            <option value="">Todas las ubicaciones</option>
            {UBICACIONES_FILTRO.map(u => (<option key={u} value={u}>{u}</option>))}
          </select>
          <select value={dest} onChange={(e) => setDest(e.target.value)} className="w-full border rounded px-3 py-2">
            <option value="">Todos los destinos</option>
            {DESTINOS.map(d => (<option key={d} value={d}>{d}</option>))}
          </select>
          <select value={pub} onChange={(e) => setPub(e.target.value)} className="w-full border rounded px-3 py-2">
            <option value="">Toda publicación</option>
            <option value="si">Publicados</option>
            <option value="no">No publicados</option>
          </select>
        </div>

        <p className="text-sm text-gray-600 mb-4">{items.length} ítem{items.length !== 1 ? 's' : ''}</p>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="px-3 py-2 text-left font-bold">Código</th>
                <th className="px-3 py-2 text-left font-bold">Producto</th>
                <th className="px-3 py-2 text-left font-bold">OEM</th>
                <th className="px-3 py-2 text-left font-bold">Orden</th>
                <th className="px-3 py-2 text-left font-bold">T.Compra</th>
                <th className="px-3 py-2 text-left font-bold">ETA</th>
                <th className="px-3 py-2 text-left font-bold">T.Envío</th>
                <th className="px-3 py-2 text-left font-bold">Pub</th>
                <th className="px-3 py-2 text-center font-bold">Costo</th>
                <th className="px-3 py-2 text-center font-bold">Venta</th>
                <th className="px-3 py-2 text-center font-bold">Gan.</th>
                <th className="px-3 py-2 text-left font-bold">Ubicación</th>
                <th className="px-3 py-2 text-left font-bold">Destino</th>
                <th className="px-3 py-2 text-left font-bold">Estado$</th>
                <th className="px-3 py-2 text-left font-bold">Cliente</th>
                <th className="px-3 py-2 text-center font-bold">Pendiente</th>
                <th className="px-3 py-2 text-center font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={17} className="px-6 py-4 text-center text-gray-500">Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={17} className="px-6 py-4 text-center text-gray-500">No hay ítems que coincidan</td></tr>
              ) : items.map((x: any) => {
                const costo = x.costo_total || 0
                const venta = x.precio_venta || 0
                const gan = venta - costo
                const isEntregado = x.ubicacion === 'Entregado'
                return (
                  <tr key={x.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono font-bold text-blue-600">{x.codigo || '—'}</td>
                    <td className="px-3 py-2">{x.producto}</td>
                    <td className="px-3 py-2 text-xs">{x.oem || '—'}</td>
                    <td className="px-3 py-2 text-xs">{x.nro_orden || '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      {x.tracking_compra ? x.tracking_compra.substring(0, 10) + '…' : '—'}
                      {x.link_tracking_compra && x.link_tracking_compra !== '#' && (
                        <a href={x.link_tracking_compra} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-500 hover:text-blue-700 text-xs">
                          📦
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{fmtDate(x.eta)}</td>
                    <td className="px-3 py-2 text-xs">
                      {x.tracking_venta ? x.tracking_venta.substring(0, 8) + '…' : '—'}
                      <button type="button" onClick={() => openTrackVenta(x.id)} className="ml-1 text-green-500 hover:text-green-700 text-xs">
                        🚚
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs">{x.plataforma ? x.plataforma : '—'}</td>
                    <td className="px-3 py-2 text-center font-bold">{costo > 0 ? fmt(costo) : '—'}</td>
                    <td className="px-3 py-2 text-center font-bold">{venta > 0 ? fmt(venta) : '—'}</td>
                    <td className={`px-3 py-2 text-center font-bold ${gan > 0 ? 'text-green-600' : gan < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {venta > 0 ? (gan >= 0 ? '+' : '') + fmt(gan) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">{x.ubicacion || '—'}</td>
                    <td className="px-3 py-2 text-xs">{x.destino || '—'}</td>
                    <td className="px-3 py-2 text-xs">{x.estado_pago || '—'}</td>
                    <td className="px-3 py-2 text-xs">{x.cliente_nombre || '—'}</td>
                    <td className="px-3 py-2 text-center font-bold">
                      {x.pendiente_compra ? '⏳' : '—'}
                    </td>
                    <td className="px-3 py-2 text-center space-x-1">
                      {!isEntregado && x.destino === 'Vendido' && ( // Solo si es una venta y no está entregado
                        <button
                          type="button"
                          onClick={() => marcarEntregado(x.id)}
                          className="text-blue-500 hover:text-blue-700 text-xs"
                          title="Marcar como entregado"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      <a href={`/dashboard/nuevo?edit=${x.id}`} className="text-blue-500 hover:text-blue-700 text-xs">
                        ✏️
                      </a>
                      <button
                        type="button"
                        onClick={() => eliminarProducto(x.id)}
                        className="text-red-500 hover:text-red-700 text-xs ml-1"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function InventarioPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Cargando...</div>}>
      <InventarioTable />
    </Suspense>
  )
}
