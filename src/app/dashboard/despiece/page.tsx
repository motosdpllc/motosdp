'use client'
import { useState, useRef } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Wrench, Loader, Search, DollarSign } from 'lucide-react'

interface Pieza {
  descripcion: string; oem: string; subcodigo: string
  pesoEst: number; costoRef: number; fuente: string; linkFuente: string
  seleccionada: boolean; precioVenta: number
}

const SUBCODIGOS: Record<string,string> = { M:'Motor', C:'Carbureción', E:'Electricidad', T:'Transmisión', F:'Frenos', S:'Suspensión/Chasis', X:'Carrocería', I:'Iluminación' }

export default function DespiecessPage() {
  const router = useRouter()
  const [paso, setPaso] = useState<'datos'|'piezas'|'precios'|'listo'>('datos')
  const [loading, setLoading] = useState(false)
  const [loadingPrecios, setLoadingPrecios] = useState<number|null>(null)
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [anio, setAnio] = useState('')
  const [costoMoto, setCostoMoto] = useState('')
  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [guardando, setGuardando] = useState(false)

  const identificarPiezas = async () => {
    if (!marca||!modelo||!anio) { toast.error('Completá marca, modelo y año'); return }
    setLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          messages: [{
            role: 'user',
            content: `Soy un vendedor de repuestos de motos. Tengo una ${marca} ${modelo} año ${anio} para desarmar y vender las piezas.

Generá una lista de las piezas principales que se pueden vender de esta moto, con sus códigos OEM aproximados.

Respondé SOLO con este JSON sin texto adicional:
{
  "piezas": [
    {
      "descripcion": "nombre de la pieza",
      "oem": "código OEM aproximado",
      "subcodigo": "M|C|E|T|F|S|X|I",
      "peso_estimado": 0.5
    }
  ]
}

Subcódigos: M=Motor, C=Carbureción, E=Electricidad, T=Transmisión, F=Frenos, S=Suspensión/Chasis, X=Carrocería, I=Iluminación

Incluí al menos 15-20 piezas vendibles. Sé específico con los OEM para esta moto.`
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text?.trim().replace(/```json|```/g,'').trim()
      const parsed = JSON.parse(text)
      setPiezas((parsed.piezas||[]).map((p: any) => ({
        descripcion: p.descripcion||'', oem: p.oem||'', subcodigo: p.subcodigo||'X',
        pesoEst: p.peso_estimado||0, costoRef: 0, fuente: '', linkFuente: '', seleccionada: true, precioVenta: 0
      })))
      setPaso('piezas')
    } catch (e) {
      toast.error('Error al identificar piezas. Intentá de nuevo.')
    }
    setLoading(false)
  }

  const buscarPrecio = async (i: number) => {
    const pieza = piezas[i]
    setLoadingPrecios(i)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{
            role: 'user',
            content: `Buscá el precio de venta promedio en USD de: "${pieza.descripcion}" para ${marca} ${modelo} ${anio} ${pieza.oem ? '(OEM: '+pieza.oem+')' : ''}.
Buscá en eBay o Partzilla.
Respondé SOLO con este JSON: {"precio": 0.00, "fuente": "eBay|Partzilla|otro", "link": "url"}`
          }]
        })
      })
      const data = await res.json()
      // Find text response
      const textBlock = data.content?.find((c: any) => c.type === 'text')
      if (textBlock) {
        const parsed = JSON.parse(textBlock.text.replace(/```json|```/g,'').trim())
        setPiezas(p => p.map((x,j) => j===i ? {...x, costoRef:parsed.precio||0, fuente:parsed.fuente||'', linkFuente:parsed.link||''} : x))
        toast.success(`Precio encontrado: ${fmt(parsed.precio)}`)
      }
    } catch (e) {
      toast.error('No se encontró precio. Ingresalo manualmente.')
    }
    setLoadingPrecios(null)
  }

  const buscarTodosLosPrecios = async () => {
    const sel = piezas.filter(x=>x.seleccionada)
    for (let i=0; i<piezas.length; i++) {
      if (piezas[i].seleccionada && !piezas[i].costoRef) {
        await buscarPrecio(i)
        await new Promise(r => setTimeout(r, 1000))
      }
    }
    toast.success('Búsqueda de precios completa')
  }

  const repartirCosto = () => {
    const costo = parseFloat(costoMoto) || 0
    if (!costo) return
    const sel = piezas.filter(x=>x.seleccionada)
    if (!sel.length) return
    const totalRef = sel.reduce((a,x)=>a+(x.costoRef||1),0) || sel.length
    setPiezas(p => p.map(x => {
      if (!x.seleccionada) return x
      const proporcion = (x.costoRef||1) / totalRef
      return { ...x, precioVenta: parseFloat(((x.costoRef||0) * 1.3).toFixed(2)) }
    }))
    toast.success('Precio de venta sugerido = precio de referencia × 1.3')
  }

  const guardarTodo = async () => {
    const sel = piezas.filter(x=>x.seleccionada)
    if (!sel.length) { toast.error('Seleccioná al menos una pieza'); return }
    const costo = parseFloat(costoMoto)||0
    const totalRef = sel.reduce((a,x)=>a+(x.costoRef||0),0)||sel.length
    setGuardando(true)
    const mc = marca.charAt(0).toUpperCase()
    const anio2 = anio.slice(-2)
    const modeloClean = modelo.toUpperCase().replace(/\s/g,'')

    for (const pieza of sel) {
      const key = `${mc}${anio2}-${modeloClean}-${pieza.subcodigo}`
      const { data: cnt } = await supabase.rpc('increment_counter', { counter_key: key })
      const codigo = `${key}${String(cnt||1).padStart(3,'0')}`
      // Costo proporcional al precio de referencia
      const proporcion = totalRef > 0 ? (pieza.costoRef||0)/totalRef : 1/sel.length
      const costoItem = costo * proporcion

      await supabase.from('items').insert({
        codigo, producto: pieza.descripcion, oem: pieza.oem||null,
        marca: mc, marca_code: mc, anio: anio, modelo: modelo, subcodigo: pieza.subcodigo,
        pagina: `Despiece ${marca} ${modelo} ${anio}`,
        costo_total: costoItem, precio_venta: pieza.precioVenta||null,
        ganancia: pieza.precioVenta ? pieza.precioVenta - costoItem : null,
        peso: pieza.pesoEst||null, ubicacion: 'En Mano',
      })
    }
    toast.success(`✓ ${sel.length} piezas agregadas al inventario`)
    setGuardando(false)
    setPaso('listo')
  }

  if (paso === 'listo') return (
    <div className="p-6 max-w-xl text-center">
      <div className="text-6xl mb-4">🏍️</div>
      <h2 className="text-2xl font-bold mb-2">Despiece completado</h2>
      <p className="text-gray-500 mb-6">{piezas.filter(x=>x.seleccionada).length} piezas agregadas al inventario</p>
      <div className="flex gap-3 justify-center">
        <button onClick={()=>router.push('/dashboard/inventario')} className="btn btn-primary">Ver inventario</button>
        <button onClick={()=>{setPaso('datos');setPiezas([]);setCostoMoto('')}} className="btn">Nuevo despiece</button>
      </div>
    </div>
  )

  if (paso === 'piezas' || paso === 'precios') return (
    <div className="p-6 max-w-4xl">
      <button onClick={()=>setPaso('datos')} className="btn mb-4">← Volver</button>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Piezas — {marca} {modelo} {anio}</h1>
        <div className="text-sm text-gray-500">{piezas.filter(x=>x.seleccionada).length} seleccionadas</div>
      </div>

      {/* Costo de la moto */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="label">Costo de compra de la moto (USD)</label>
            <input className="input" type="number" step="0.01" placeholder="0.00" value={costoMoto} onChange={e=>setCostoMoto(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Se reparte proporcionalmente entre las piezas</p>
          </div>
          <button onClick={repartirCosto} disabled={!costoMoto} className="btn btn-primary">
            Calcular precio venta sugerido
          </button>
          <button onClick={buscarTodosLosPrecios} className="btn btn-warning gap-2">
            <Search size={14}/> Buscar todos los precios IA
          </button>
        </div>
      </div>

      {/* Lista piezas */}
      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm font-semibold">{piezas.length} piezas identificadas</div>
          <button onClick={()=>setPiezas(p=>p.map(x=>({...x,seleccionada:!piezas.every(y=>y.seleccionada)})))} className="btn btn-sm text-xs">
            {piezas.every(x=>x.seleccionada)?'Deseleccionar todas':'Seleccionar todas'}
          </button>
        </div>
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {piezas.map((p,i)=>(
            <div key={i} className={`border rounded-lg p-3 transition-all ${p.seleccionada?'border-blue-200 bg-blue-50':'border-gray-100 opacity-50'}`}>
              <div className="flex gap-3">
                <input type="checkbox" checked={p.seleccionada} onChange={e=>setPiezas(prev=>prev.map((x,j)=>j===i?{...x,seleccionada:e.target.checked}:x))} className="mt-1 flex-shrink-0" />
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <input className="input text-sm" value={p.descripcion} onChange={e=>setPiezas(prev=>prev.map((x,j)=>j===i?{...x,descripcion:e.target.value}:x))} placeholder="Descripción" />
                  </div>
                  <div>
                    <input className="input text-xs" value={p.oem} onChange={e=>setPiezas(prev=>prev.map((x,j)=>j===i?{...x,oem:e.target.value}:x))} placeholder="OEM" />
                  </div>
                  <div>
                    <select className="input text-xs" value={p.subcodigo} onChange={e=>setPiezas(prev=>prev.map((x,j)=>j===i?{...x,subcodigo:e.target.value}:x))}>
                      {Object.entries(SUBCODIGOS).map(([v,l])=><option key={v} value={v}>{v} – {l}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-1">
                    <input className="input text-xs flex-1" type="number" step="0.01" placeholder="Precio ref. USD" value={p.costoRef||''} onChange={e=>setPiezas(prev=>prev.map((x,j)=>j===i?{...x,costoRef:parseFloat(e.target.value)||0}:x))} />
                    <button onClick={()=>buscarPrecio(i)} disabled={loadingPrecios===i} className="btn btn-sm flex-shrink-0" title="Buscar precio con IA">
                      {loadingPrecios===i ? <Loader size={12} className="animate-spin"/> : <Search size={12}/>}
                    </button>
                  </div>
                  <div>
                    <input className="input text-xs" type="number" step="0.01" placeholder="Precio venta USD" value={p.precioVenta||''} onChange={e=>setPiezas(prev=>prev.map((x,j)=>j===i?{...x,precioVenta:parseFloat(e.target.value)||0}:x))} />
                  </div>
                  <div>
                    <input className="input text-xs" type="number" step="0.01" placeholder="Peso kg" value={p.pesoEst||''} onChange={e=>setPiezas(prev=>prev.map((x,j)=>j===i?{...x,pesoEst:parseFloat(e.target.value)||0}:x))} />
                  </div>
                  {p.fuente && (
                    <div className="col-span-2 text-xs text-blue-600">
                      Fuente: {p.fuente} {p.linkFuente && <a href={p.linkFuente} target="_blank" className="underline ml-1">Ver</a>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button onClick={guardarTodo} disabled={guardando||!piezas.some(x=>x.seleccionada)} className="btn btn-primary px-8">
          {guardando?'Guardando...':'Agregar '+piezas.filter(x=>x.seleccionada).length+' piezas al inventario'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Wrench size={24} className="text-gray-700"/>
        <h1 className="text-2xl font-bold">Despiece de moto</h1>
      </div>
      <p className="text-gray-500 mb-6">Ingresá los datos de la moto — la IA identifica las piezas con sus OEM y busca precios de referencia</p>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="label">Marca *</label>
            <select className="input" value={marca} onChange={e=>setMarca(e.target.value)}>
              <option value="">—</option>
              <option>Kawasaki</option><option>Yamaha</option><option>Suzuki</option>
              <option>Honda</option><option>Harley-Davidson</option><option>Ducati</option>
              <option>BMW</option><option>KTM</option><option>Otra</option>
            </select>
          </div>
          <div>
            <label className="label">Modelo *</label>
            <input className="input" placeholder="ej: GSXR600, CBR600RR..." value={modelo} onChange={e=>setModelo(e.target.value)} />
          </div>
          <div>
            <label className="label">Año *</label>
            <input className="input" type="number" placeholder="ej: 2003" value={anio} onChange={e=>setAnio(e.target.value)} min="1970" max="2025" />
          </div>
        </div>
        <button onClick={identificarPiezas} disabled={loading||!marca||!modelo||!anio} className="btn btn-primary w-full justify-center py-3 text-base">
          {loading ? <><Loader size={18} className="animate-spin mr-2"/> Identificando piezas con IA...</> : '🤖 Identificar piezas con IA'}
        </button>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-xl">
        <div className="font-semibold text-sm mb-3">¿Cómo funciona?</div>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex gap-2"><span className="text-blue-500 font-bold flex-shrink-0">1.</span> Ingresás marca, modelo y año</div>
          <div className="flex gap-2"><span className="text-blue-500 font-bold flex-shrink-0">2.</span> La IA identifica las piezas principales con sus códigos OEM</div>
          <div className="flex gap-2"><span className="text-blue-500 font-bold flex-shrink-0">3.</span> Buscás precios de referencia en eBay / Partzilla</div>
          <div className="flex gap-2"><span className="text-blue-500 font-bold flex-shrink-0">4.</span> El costo de la moto se reparte proporcionalmente entre las piezas</div>
          <div className="flex gap-2"><span className="text-blue-500 font-bold flex-shrink-0">5.</span> Todo entra al inventario listo para vender</div>
        </div>
      </div>
    </div>
  )
}
