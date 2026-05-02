'use client'
import { useState, useRef } from 'react'
import { supabase, type Cliente } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FileText, Loader } from 'lucide-react'

interface ItemImportado {
  producto: string; oem?: string; cantidad?: number; precio?: number
  seleccionado: boolean; cliente_id?: string; cliente_nombre?: string
}

export default function ImportarPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [paso, setPaso] = useState<'upload'|'revisar'|'listo'>('upload')
  const [items, setItems] = useState<ItemImportado[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [nroOrden, setNroOrden] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [cliGlobal, setCliGlobal] = useState('')
  const [cliGlobalId, setCliGlobalId] = useState('')
  const [showCliDrop, setShowCliDrop] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const cargarClientes = async () => {
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    setClientes(data || [])
  }

  const procesarArchivo = async (file: File) => {
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
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: [
              { type: isPDF ? 'document' : 'image', source: { type: 'base64', media_type: file.type, data: base64 } },
              { type: 'text', text: `Analizá este documento de compra de repuestos de motos. Extraé todos los ítems.
Devolvé SOLO este JSON sin texto adicional:
{"nro_orden":"","proveedor":"","items":[{"producto":"","oem":"","cantidad":1,"precio":0}]}` }
            ]
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text?.trim()
      if (!text) throw new Error('Sin respuesta')
      const parsed = JSON.parse(text.replace(/```json|```/g,'').trim())
      if (parsed.nro_orden) setNroOrden(parsed.nro_orden)
      if (parsed.proveedor) setProveedor(parsed.proveedor)
      setItems((parsed.items||[]).map((x: any) => ({ producto:x.producto||'', oem:x.oem||'', cantidad:x.cantidad||1, precio:x.precio||0, seleccionado:true, cliente_id:'', cliente_nombre:'' })))
      await cargarClientes()
      setPaso('revisar')
    } catch (e: any) {
      toast.error('Error: ' + (e.message || 'Intentá de nuevo'))
    }
    setLoading(false)
  }

  const filtCli = clientes.filter(c => cliGlobal && c.nombre.toLowerCase().includes(cliGlobal.toLowerCase())).slice(0,6)

  const guardarTodo = async () => {
    const sel = items.filter(x=>x.seleccionado)
    if (!sel.length) { toast.error('Seleccioná al menos un ítem'); return }
    setGuardando(true)
    for (const item of sel) {
      await supabase.from('items').insert({ producto:item.producto, oem:item.oem||null, importe:item.precio||0, costo_total:item.precio||0, nro_orden:nroOrden||null, pagina:proveedor||null, cliente_id:item.cliente_id||null, cliente_nombre:item.cliente_nombre||null, ubicacion:'Proveedor' })
    }
    toast.success(`✓ ${sel.length} ítem${sel.length>1?'s':''} importados`)
    setGuardando(false); setPaso('listo')
  }

  if (paso === 'listo') return (
    <div className="p-6 max-w-xl text-center">
      <div className="text-6xl mb-4">✅</div>
      <h2 className="text-2xl font-bold mb-2">Importación completa</h2>
      <p className="text-gray-500 mb-6">{items.filter(x=>x.seleccionado).length} ítems agregados</p>
      <div className="flex gap-3 justify-center">
        <button onClick={()=>router.push('/dashboard/inventario')} className="btn btn-primary">Ver inventario</button>
        <button onClick={()=>{setPaso('upload');setItems([])}} className="btn">Importar otro</button>
      </div>
    </div>
  )

  if (paso === 'revisar') return (
    <div className="p-6 max-w-3xl">
      <button onClick={()=>setPaso('upload')} className="btn mb-4">← Volver</button>
      <h1 className="text-2xl font-bold mb-6">Revisar {items.length} ítems detectados</h1>
      <div className="card mb-4">
        <div className="text-sm font-semibold mb-3">Datos de la orden</div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Nro. de orden</label><input className="input" value={nroOrden} onChange={e=>setNroOrden(e.target.value)} /></div>
          <div><label className="label">Proveedor</label><input className="input" value={proveedor} onChange={e=>setProveedor(e.target.value)} /></div>
        </div>
      </div>
      <div className="card mb-4">
        <div className="text-sm font-semibold mb-3">Asignar cliente a todos</div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input className="input" placeholder="Buscar cliente..." value={cliGlobal}
              onChange={e=>{setCliGlobal(e.target.value);setShowCliDrop(true)}} onFocus={()=>{if(cliGlobal)setShowCliDrop(true)}} />
            {showCliDrop && filtCli.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1">
                {filtCli.map(c=>(
                  <div key={c.id} className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                    onMouseDown={e=>{e.preventDefault();setCliGlobal(c.nombre);setCliGlobalId(c.id);setShowCliDrop(false)}}>
                    <div className="font-medium text-sm">{c.nombre}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={()=>{setItems(p=>p.map(x=>({...x,cliente_id:cliGlobalId,cliente_nombre:cliGlobal})));toast.success('Asignado')}} disabled={!cliGlobal} className="btn btn-primary flex-shrink-0">Asignar a todos</button>
        </div>
      </div>
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm font-semibold">Ítems ({items.filter(x=>x.seleccionado).length} seleccionados)</div>
          <button onClick={()=>setItems(p=>p.map(x=>({...x,seleccionado:!items.every(y=>y.seleccionado)})))} className="btn btn-sm text-xs">
            {items.every(x=>x.seleccionado)?'Deseleccionar todos':'Seleccionar todos'}
          </button>
        </div>
        <div className="space-y-2">
          {items.map((it,i)=>(
            <div key={i} className={`border rounded-lg p-3 ${it.seleccionado?'border-blue-200 bg-blue-50':'border-gray-200 opacity-50'}`}>
              <div className="flex gap-3">
                <input type="checkbox" checked={it.seleccionado} onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,seleccionado:e.target.checked}:x))} className="mt-1 flex-shrink-0" />
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="col-span-2 md:col-span-4"><input className="input text-sm" value={it.producto} onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,producto:e.target.value}:x))} placeholder="Producto" /></div>
                  <div><input className="input text-xs" value={it.oem||''} onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,oem:e.target.value}:x))} placeholder="OEM" /></div>
                  <div><input className="input text-xs" type="number" step="0.01" value={it.precio||''} onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,precio:parseFloat(e.target.value)||0}:x))} placeholder="Precio USD" /></div>
                  <div className="col-span-2"><input className="input text-xs" value={it.cliente_nombre||''} onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,cliente_nombre:e.target.value}:x))} placeholder="Cliente (opcional)" /></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={guardarTodo} disabled={guardando||!items.some(x=>x.seleccionado)} className="btn btn-primary px-8">
          {guardando?'Importando...':'Importar '+items.filter(x=>x.seleccionado).length+' ítem'+(items.filter(x=>x.seleccionado).length!==1?'s':'')}
        </button>
        <button onClick={()=>setPaso('upload')} className="btn">Cancelar</button>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={()=>router.push('/dashboard/nuevo')} className="btn mb-4">← Volver</button>
      <h1 className="text-2xl font-bold mb-2">Importar factura de compra</h1>
      <p className="text-gray-500 mb-6">Subí la factura del proveedor — la IA extrae los ítems automáticamente</p>
      <div onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)procesarArchivo(f)}} onDragOver={e=>e.preventDefault()}
        onClick={()=>fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-16 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
        {loading
          ? <div><Loader size={48} className="mx-auto mb-4 text-blue-500 animate-spin"/><div className="font-medium text-gray-700">Analizando con IA...</div></div>
          : <div><FileText size={48} className="mx-auto mb-4 text-gray-300"/><div className="text-lg font-medium text-gray-700">Arrastrá o hacé click para subir</div><div className="text-sm text-gray-400 mt-1">PDF, JPG, PNG — factura o foto de la orden</div></div>
        }
        <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)procesarArchivo(f)}} />
      </div>
      <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <div className="font-semibold mb-2">La IA detecta automáticamente:</div>
        <div>✓ Nombre y descripción de cada producto</div>
        <div>✓ Código OEM / número de parte</div>
        <div>✓ Precio por ítem · ✓ Nro. de orden · ✓ Proveedor</div>
      </div>
    </div>
  )
}
