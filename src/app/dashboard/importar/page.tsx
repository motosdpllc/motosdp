'use client'
import { useState, useRef } from 'react'
import { supabase, type Cliente } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FileText, Upload, Table, Loader, CheckCircle, XCircle } from 'lucide-react'

interface ItemImportado {
  producto: string; oem: string; nro_orden: string; pagina: string
  importe: number; costo_envio: number; taxes: number; reembolsos: number
  costo_total: number; precio_venta: number; eta: string; tracking: string
  ubicacion: string; destino: string; estado_pago: string
  cliente_nombre: string; peso: number; plataforma: string
  seleccionado: boolean; error?: string
}

const COLUMNAS_ESPERADAS = ['producto','oem','nro_orden','pagina','importe','costo_envio','taxes','reembolsos','precio_venta','eta','tracking','ubicacion','destino','estado_pago','cliente_nombre','peso','plataforma']
const UBICACIONES = ['Proveedor','En tránsito','En tránsito a Daniel','Daniel','Pablo','Blue Mail','Tato','Tránsito a Bs As','En Mano','Vendido','Cancelado']

export default function ImportarPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const facturaRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'csv'|'factura'|'pegar'>('csv')
  const [items, setItems] = useState<ItemImportado[]>([])
  const [paso, setPaso] = useState<'upload'|'revisar'|'listo'>('upload')
  const [loading, setLoading] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [texto, setTexto] = useState('')
  const [nroOrden, setNroOrden] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [cliGlobal, setCliGlobal] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [showCliDrop, setShowCliDrop] = useState(false)
  const [resultados, setResultados] = useState<{ok:number,err:number}>({ok:0,err:0})

  const cargarClientes = async () => {
    if (clientes.length) return
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    setClientes(data || [])
  }

  // ── CSV/EXCEL ──────────────────────────────────────────
  const procesarCSV = (texto: string) => {
    const lineas = texto.trim().split('\n').filter(l => l.trim())
    if (lineas.length < 2) { toast.error('El archivo necesita al menos una fila de encabezado y una de datos'); return }

    const sep = lineas[0].includes('\t') ? '\t' : ','
    const headers = lineas[0].split(sep).map(h => h.trim().toLowerCase().replace(/[^a-z_]/g,''))

    const parsed: ItemImportado[] = []
    for (let i = 1; i < lineas.length; i++) {
      const vals = lineas[i].split(sep).map(v => v.trim().replace(/^"|"$/g,''))
      const row: any = {}
      headers.forEach((h, j) => { row[h] = vals[j] || '' })

      const imp = parseFloat(row.importe)||0
      const env = parseFloat(row.costo_envio)||0
      const tax = parseFloat(row.taxes)||0
      const ree = parseFloat(row.reembolsos)||0
      const costo = imp + env + tax - ree

      parsed.push({
        producto: row.producto || row.descripcion || row.product || '',
        oem: row.oem || row.codigo || row.part_number || '',
        nro_orden: row.nro_orden || row.orden || row.order || '',
        pagina: row.pagina || row.proveedor || row.tienda || '',
        importe: imp, costo_envio: env, taxes: tax, reembolsos: ree,
        costo_total: costo,
        precio_venta: parseFloat(row.precio_venta)||0,
        eta: row.eta || row.fecha_entrega || '',
        tracking: row.tracking || row.tracking_compra || '',
        ubicacion: UBICACIONES.includes(row.ubicacion) ? row.ubicacion : 'Proveedor',
        destino: row.destino || '',
        estado_pago: row.estado_pago || row.estado || '',
        cliente_nombre: row.cliente_nombre || row.cliente || '',
        peso: parseFloat(row.peso)||0,
        plataforma: row.plataforma || '',
        seleccionado: true,
        error: !row.producto && !row.descripcion ? 'Sin nombre de producto' : undefined
      })
    }

    if (!parsed.length) { toast.error('No se encontraron datos'); return }
    setItems(parsed)
    cargarClientes()
    setPaso('revisar')
    toast.success(`${parsed.length} filas detectadas`)
  }

  const leerArchivo = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      procesarCSV(text)
    }
    reader.readAsText(file, 'UTF-8')
  }

  // ── FACTURA CON IA ─────────────────────────────────────
  const procesarFactura = async (file: File) => {
    setLoading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const isPDF = file.type === 'application/pdf'
      const isImage = file.type.startsWith('image/')
      if (!isPDF && !isImage) { toast.error('Solo PDF e imágenes'); setLoading(false); return }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          messages: [{
            role: 'user',
            content: [
              { type: isPDF ? 'document' : 'image', source: { type: 'base64', media_type: file.type, data: base64 } },
              { type: 'text', text: `Analizá este documento de compra de repuestos de motos.
Extraé TODOS los ítems/productos que aparecen.
Respondé SOLO con este JSON sin texto adicional ni markdown:
{"nro_orden":"","proveedor":"","items":[{"producto":"","oem":"","cantidad":1,"precio":0}]}` }
            ]
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text?.trim().replace(/```json|```/g,'').trim()
      const parsed = JSON.parse(text)

      if (parsed.nro_orden) setNroOrden(parsed.nro_orden)
      if (parsed.proveedor) setProveedor(parsed.proveedor)

      const itemsIA: ItemImportado[] = (parsed.items||[]).map((x: any) => ({
        producto: x.producto||'', oem: x.oem||'',
        nro_orden: parsed.nro_orden||'', pagina: parsed.proveedor||'',
        importe: x.precio||0, costo_envio:0, taxes:0, reembolsos:0,
        costo_total: x.precio||0, precio_venta:0, eta:'', tracking:'',
        ubicacion:'Proveedor', destino:'', estado_pago:'',
        cliente_nombre:'', peso:0, plataforma:'', seleccionado:true
      }))

      setItems(itemsIA)
      await cargarClientes()
      setPaso('revisar')
      toast.success(`${itemsIA.length} ítems detectados por IA`)
    } catch (e: any) {
      toast.error('Error al procesar: ' + (e.message||'Intentá de nuevo'))
    }
    setLoading(false)
  }

  // ── PEGAR TEXTO ────────────────────────────────────────
  const procesarPegado = () => {
    if (!texto.trim()) { toast.error('Pegá datos primero'); return }
    procesarCSV(texto)
  }

  // ── GUARDAR ────────────────────────────────────────────
  const guardarTodo = async () => {
    const sel = items.filter(x => x.seleccionado && !x.error)
    if (!sel.length) { toast.error('No hay ítems válidos seleccionados'); return }
    setGuardando(true)
    let ok = 0, err = 0

    for (const item of sel) {
      const cliNombre = item.cliente_nombre || cliGlobal || null
      const { error } = await supabase.from('items').insert({
        producto: item.producto,
        oem: item.oem||null,
        nro_orden: item.nro_orden||nroOrden||null,
        pagina: item.pagina||proveedor||null,
        importe: item.importe||0,
        costo_envio: item.costo_envio||0,
        taxes: item.taxes||0,
        reembolsos: item.reembolsos||0,
        costo_total: item.costo_total||0,
        precio_venta: item.precio_venta||null,
        ganancia: item.precio_venta ? item.precio_venta - item.costo_total : null,
        eta: item.eta||null,
        tracking_compra: item.tracking||null,
        ubicacion: item.ubicacion||'Proveedor',
        destino: item.destino||null,
        estado_pago: item.estado_pago||null,
        cliente_nombre: cliNombre,
        peso: item.peso||null,
        plataforma: item.plataforma||null,
      })
      if (error) err++; else ok++
    }

    setResultados({ok,err})
    setGuardando(false)
    setPaso('listo')
  }

  const filtCli = clientes.filter(c => cliGlobal && c.nombre.toLowerCase().includes(cliGlobal.toLowerCase())).slice(0,5)

  // ── LISTO ──────────────────────────────────────────────
  if (paso === 'listo') return (
    <div className="p-6 max-w-xl text-center">
      <div className="text-6xl mb-4">{resultados.err === 0 ? '✅' : '⚠️'}</div>
      <h2 className="text-2xl font-bold mb-2">Importación completa</h2>
      <div className="flex gap-4 justify-center mb-6">
        <div className="text-center"><div className="text-3xl font-bold text-green-600">{resultados.ok}</div><div className="text-sm text-gray-500">importados</div></div>
        {resultados.err > 0 && <div className="text-center"><div className="text-3xl font-bold text-red-500">{resultados.err}</div><div className="text-sm text-gray-500">errores</div></div>}
      </div>
      <div className="flex gap-3 justify-center">
        <button onClick={() => router.push('/dashboard/inventario')} className="btn btn-primary">Ver inventario</button>
        <button onClick={() => { setPaso('upload'); setItems([]); setTexto('') }} className="btn">Importar más</button>
      </div>
    </div>
  )

  // ── REVISAR ────────────────────────────────────────────
  if (paso === 'revisar') return (
    <div className="p-6 max-w-5xl">
      <button onClick={() => { setPaso('upload'); setItems([]) }} className="btn mb-4">← Volver</button>
      <h1 className="text-2xl font-bold mb-2">Revisar {items.length} ítems</h1>
      <p className="text-gray-500 mb-4">{items.filter(x=>x.seleccionado&&!x.error).length} listos para importar · {items.filter(x=>x.error).length} con errores</p>

      {/* Datos globales */}
      <div className="card mb-4">
        <div className="text-sm font-semibold mb-3">Datos globales (se aplican a todos)</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label">Nro. de orden (global)</label>
            <input className="input" value={nroOrden} onChange={e=>setNroOrden(e.target.value)} placeholder="Ej: ORD-001" />
          </div>
          <div>
            <label className="label">Proveedor / página</label>
            <input className="input" value={proveedor} onChange={e=>setProveedor(e.target.value)} placeholder="eBay, Amazon..." />
          </div>
          <div>
            <label className="label">Cliente (para todos)</label>
            <div className="relative">
              <input className="input" placeholder="Buscar cliente..." value={cliGlobal}
                onChange={e=>{setCliGlobal(e.target.value);setShowCliDrop(true)}}
                onFocus={()=>{if(cliGlobal)setShowCliDrop(true)}} />
              {showCliDrop && filtCli.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1">
                  {filtCli.map(c=>(
                    <div key={c.id} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-0"
                      onMouseDown={e=>{e.preventDefault();setCliGlobal(c.nombre);setShowCliDrop(false)}}>
                      {c.nombre}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de ítems */}
      <div className="card mb-4 overflow-hidden">
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm font-semibold">Ítems</div>
          <div className="flex gap-2">
            <button onClick={()=>setItems(p=>p.map(x=>({...x,seleccionado:true})))} className="btn btn-sm text-xs">Seleccionar todos</button>
            <button onClick={()=>setItems(p=>p.map(x=>({...x,seleccionado:false})))} className="btn btn-sm text-xs">Deseleccionar</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 text-left w-8"></th>
                <th className="p-2 text-left">Producto</th>
                <th className="p-2 text-left">OEM</th>
                <th className="p-2 text-left">Orden</th>
                <th className="p-2 text-right">Importe</th>
                <th className="p-2 text-right">Costo total</th>
                <th className="p-2 text-left">Ubicación</th>
                <th className="p-2 text-left">Cliente</th>
                <th className="p-2 text-left w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it,i)=>(
                <tr key={i} className={`border-b border-gray-100 ${it.error?'bg-red-50':it.seleccionado?'':'opacity-40'}`}>
                  <td className="p-2">
                    <input type="checkbox" checked={it.seleccionado && !it.error} disabled={!!it.error}
                      onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,seleccionado:e.target.checked}:x))} />
                  </td>
                  <td className="p-2">
                    <input className="input text-xs py-1 w-36" value={it.producto}
                      onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,producto:e.target.value,error:!e.target.value?'Sin nombre':''}:x))} />
                  </td>
                  <td className="p-2"><input className="input text-xs py-1 w-24" value={it.oem} onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,oem:e.target.value}:x))} /></td>
                  <td className="p-2"><input className="input text-xs py-1 w-20" value={it.nro_orden} onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,nro_orden:e.target.value}:x))} /></td>
                  <td className="p-2 text-right"><input className="input text-xs py-1 w-16 text-right" type="number" value={it.importe||''} onChange={e=>{ const imp=parseFloat(e.target.value)||0; setItems(p=>p.map((x,j)=>j===i?{...x,importe:imp,costo_total:imp+x.costo_envio+x.taxes-x.reembolsos}:x)) }} /></td>
                  <td className="p-2 text-right text-gray-600 font-medium">${it.costo_total.toFixed(2)}</td>
                  <td className="p-2">
                    <select className="input text-xs py-1 w-28" value={it.ubicacion} onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,ubicacion:e.target.value}:x))}>
                      {UBICACIONES.map(u=><option key={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="p-2"><input className="input text-xs py-1 w-24" value={it.cliente_nombre} onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,cliente_nombre:e.target.value}:x))} /></td>
                  <td className="p-2">
                    {it.error
                      ? <span title={it.error}><XCircle size={14} className="text-red-500"/></span>
                      : <CheckCircle size={14} className="text-green-500"/>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={guardarTodo} disabled={guardando||!items.some(x=>x.seleccionado&&!x.error)} className="btn btn-primary px-8">
          {guardando?'Importando...':'Importar '+items.filter(x=>x.seleccionado&&!x.error).length+' ítems'}
        </button>
        <button onClick={()=>{setPaso('upload');setItems([])}} className="btn">Cancelar</button>
      </div>
    </div>
  )

  // ── UPLOAD ─────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Importar ítems</h1>
      <p className="text-gray-500 mb-6">Cargá ítems en masa desde Excel, CSV, factura o pegando datos</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          {v:'csv',l:'📊 Excel / CSV', icon:Table},
          {v:'factura',l:'📄 Factura con IA', icon:FileText},
          {v:'pegar',l:'📋 Pegar datos', icon:Upload},
        ].map(t=>(
          <button key={t.v} onClick={()=>setTab(t.v as any)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab===t.v?'bg-white shadow text-gray-900':'text-gray-500 hover:text-gray-700'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* CSV/Excel */}
      {tab==='csv' && (
        <div>
          <div onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)leerArchivo(f)}}
            onDragOver={e=>e.preventDefault()} onClick={()=>fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all mb-4">
            <Table size={48} className="mx-auto mb-4 text-gray-300"/>
            <div className="text-lg font-medium text-gray-700">Arrastrá o hacé click para subir</div>
            <div className="text-sm text-gray-400 mt-1">CSV o Excel exportado como CSV (.csv, .txt)</div>
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)leerArchivo(f)}} />
          </div>

          {/* Plantilla */}
          <div className="card">
            <div className="text-sm font-semibold mb-3">Formato esperado</div>
            <p className="text-xs text-gray-500 mb-2">La primera fila debe ser el encabezado. Columnas reconocidas:</p>
            <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-600 overflow-x-auto whitespace-nowrap">
              producto, oem, nro_orden, pagina, importe, costo_envio, taxes, reembolsos, precio_venta, eta, tracking, ubicacion, destino, estado_pago, cliente_nombre, peso, plataforma
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={()=>{
                const header = 'producto,oem,nro_orden,pagina,importe,costo_envio,taxes,reembolsos,precio_venta,eta,tracking,ubicacion,destino,estado_pago,cliente_nombre,peso,plataforma\n'
                const ejemplo = 'Carburador GSXR600,16100-01H01,ORD-001,eBay,45.00,12.00,0,0,89.00,2024-06-15,,Proveedor,Argentina,,Juan Pérez,0.8,MercadoLibre'
                const blob = new Blob([header+ejemplo], {type:'text/csv'})
                const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='plantilla_items.csv'; a.click()
              }} className="btn btn-sm text-xs">
                ⬇️ Bajar plantilla CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Factura IA */}
      {tab==='factura' && (
        <div>
          <div onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)procesarFactura(f)}}
            onDragOver={e=>e.preventDefault()} onClick={()=>facturaRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all mb-4">
            {loading
              ? <div><Loader size={48} className="mx-auto mb-4 text-blue-500 animate-spin"/><div className="font-medium text-gray-700">Analizando con IA...</div><div className="text-sm text-gray-400 mt-1">Puede tardar unos segundos</div></div>
              : <div><FileText size={48} className="mx-auto mb-4 text-gray-300"/><div className="text-lg font-medium text-gray-700">Arrastrá o hacé click para subir</div><div className="text-sm text-gray-400 mt-1">PDF, JPG, PNG — factura o foto de la orden del proveedor</div></div>
            }
            <input ref={facturaRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)procesarFactura(f)}} />
          </div>
          <div className="card text-sm text-gray-600">
            <div className="font-semibold mb-2">La IA detecta automáticamente:</div>
            <div className="grid grid-cols-2 gap-1">
              <div>✓ Nombre de cada producto</div><div>✓ Código OEM / número de parte</div>
              <div>✓ Precio por ítem</div><div>✓ Número de orden</div>
              <div>✓ Nombre del proveedor</div><div>✓ Cantidades</div>
            </div>
          </div>
        </div>
      )}

      {/* Pegar datos */}
      {tab==='pegar' && (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            Copiá filas de tu Excel y pegálas acá. Formato: columnas separadas por tab, primera fila = encabezados.
          </p>
          <textarea
            className="w-full font-mono text-xs border border-gray-300 rounded-lg p-3 h-48 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 mb-3"
            placeholder={"producto\toem\timporte\nCarburador GSXR600\t16100-01H01\t45.00\nPistón motor\t12101-04H00\t89.00"}
            value={texto} onChange={e=>setTexto(e.target.value)}
          />
          <button onClick={procesarPegado} disabled={!texto.trim()} className="btn btn-primary">
            Procesar datos pegados
          </button>
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            💡 En Excel: seleccioná las celdas incluyendo los encabezados → Copiar (Ctrl+C) → pegá acá
          </div>
        </div>
      )}
    </div>
  )
}
