'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase, fmt, fmtDate, type Cliente, type Cotizacion, type CotizacionItem } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { FileText, Plus, X, Eye } from 'lucide-react'

const EMPTY_ITEM: CotizacionItem = { descripcion:'', link:'', ubicacion_producto:'', costo:0, taxes_impo:0, peso_estimado:0, costo_envio:0, taxes_11:0, subtotal:0, orden:0 }

export default function CotizacionesPage() {
  const [vista, setVista] = useState<'lista'|'form'|'pdf'>('lista')
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [editId, setEditId] = useState<string|null>(null)
  const [currentCot, setCurrentCot] = useState<any>(null)
  const [cliSearch, setCliSearch] = useState('')
  const [showCliDrop, setShowCliDrop] = useState(false)
  const [cotItems, setCotItems] = useState<CotizacionItem[]>([{...EMPTY_ITEM}])
  const [saving, setSaving] = useState(false)
  const cliDropRef = useRef<HTMLDivElement>(null)

  const [f, setF] = useState({ nro:'', fecha:new Date().toISOString().split('T')[0], cliente_id:'', cliente_nombre:'', destino:'', vin:'', show_links:true, precio_final:0, suma_adicional:0 })

  useEffect(() => {
    loadAll()
    const h=(e:MouseEvent)=>{ if(cliDropRef.current&&!cliDropRef.current.contains(e.target as Node)) setShowCliDrop(false) }
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h)
  }, [])

  const loadAll = async () => {
    const [cotRes,cliRes] = await Promise.all([
      supabase.from('cotizaciones').select('*, cotizacion_items(*)').order('created_at',{ascending:false}),
      supabase.from('clientes').select('*').order('nombre')
    ])
    setCotizaciones(cotRes.data||[])
    setClientes(cliRes.data||[])
  }

  const filtCli = clientes.filter(c => cliSearch && c.nombre.toLowerCase().includes(cliSearch.toLowerCase())).slice(0,6)
  const sinTaxes = ['ES','US'].includes(f.destino)

  const recalc = (items: CotizacionItem[]) => items.map(it => {
    const taxes11=(it.costo||0)*0.11
    const taxesImpo=sinTaxes?0:(it.taxes_impo||0)
    return {...it, taxes_11:taxes11, subtotal:(it.costo||0)+taxes11+taxesImpo+(it.costo_envio||0)}
  })

  const updateItem = (i:number, field:keyof CotizacionItem, val:any) => {
    const updated=[...cotItems]; updated[i]={...updated[i],[field]:val}; setCotItems(recalc(updated))
  }

  const totalCosto = cotItems.reduce((a,x)=>a+(x.subtotal||0),0)
  const totalPeso = cotItems.reduce((a,x)=>a+(x.peso_estimado||0),0)
  const ganancia = f.precio_final ? f.precio_final-totalCosto : 0

  const nuevaCot = async () => {
    setEditId(null)
    const {data:cnt} = await supabase.rpc('increment_counter',{counter_key:'cot'})
    setF({nro:'COT-'+String(cnt||1).padStart(3,'0'), fecha:new Date().toISOString().split('T')[0], cliente_id:'', cliente_nombre:'', destino:'', vin:'', show_links:true, precio_final:0, suma_adicional:0})
    setCotItems([{...EMPTY_ITEM}]); setCliSearch(''); setVista('form')
  }

  const editarCot = (cot: any) => {
    setEditId(cot.id)
    setF({nro:cot.nro, fecha:cot.fecha||'', cliente_id:cot.cliente_id||'', cliente_nombre:cot.cliente_nombre||'', destino:cot.destino||'', vin:cot.vin||'', show_links:cot.show_links!==false, precio_final:cot.precio_final||0, suma_adicional:0})
    setCliSearch(cot.cliente_nombre||'')
    setCotItems(cot.cotizacion_items?.length ? cot.cotizacion_items : [{...EMPTY_ITEM}])
    setVista('form')
  }

  const guardar = async () => {
    if(!cotItems[0].descripcion){toast.error('Agregá al menos un ítem con descripción');return}
    setSaving(true)
    const payload={nro:f.nro, fecha:f.fecha, cliente_id:f.cliente_id||null, cliente_nombre:f.cliente_nombre||null, destino:f.destino||null, vin:f.vin||null, show_links:f.show_links, precio_final:f.precio_final||null, updated_at:new Date().toISOString()}
    let cotId=editId
    if(editId){
      await supabase.from('cotizaciones').update(payload).eq('id',editId)
      await supabase.from('cotizacion_items').delete().eq('cotizacion_id',editId)
    } else {
      const {data} = await supabase.from('cotizaciones').insert(payload).select().single()
      cotId=data?.id
    }
    if(cotId) await supabase.from('cotizacion_items').insert(cotItems.map((it,i)=>({...it,cotizacion_id:cotId,orden:i})))
    toast.success('✓ Cotización guardada')
    setSaving(false); loadAll(); setVista('lista')
  }

  const eliminar = async (id:string) => {
    if(!confirm('¿Eliminar esta cotización?'))return
    await supabase.from('cotizaciones').delete().eq('id',id); loadAll()
  }

  const estimarPeso = async (i:number) => {
    const desc=cotItems[i].descripcion
    if(!desc){toast.error('Ingresá la descripción primero');return}
    try {
      const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:50,messages:[{role:'user',content:`Estimá el peso en kg del siguiente repuesto de moto: "${desc}". Respondé SOLO con un número decimal. Ej: 0.85`}]})})
      const data=await res.json()
      const peso=parseFloat(data.content?.[0]?.text?.trim())
      if(!isNaN(peso)){updateItem(i,'peso_estimado',peso);toast.success('Peso estimado: '+peso+' kg')}
    } catch { toast.error('No se pudo estimar. Ingresá el peso manualmente.') }
  }

  // PDF VIEW
  if(vista==='pdf' && currentCot){
    const items=currentCot.cotizacion_items||[]
    const tPeso=items.reduce((a:number,x:any)=>a+(x.peso_estimado||0),0)
    return (
      <div className="p-6 max-w-3xl">
        <div className="flex gap-2 mb-4">
          <button onClick={()=>setVista('lista')} className="btn">← Volver</button>
          <button onClick={()=>window.print()} className="btn btn-primary">🖨️ Imprimir / PDF</button>
        </div>
        <div style={{background:'#fff',border:'1px solid #ddd',borderRadius:12,padding:'2rem',fontFamily:'Georgia,serif',color:'#222'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:24,borderBottom:'2px solid #111',paddingBottom:16}}>
            <div><div style={{fontSize:22,fontWeight:700}}>🏍️ Motos DP LLC</div><div style={{fontSize:13,color:'#666',fontFamily:'system-ui'}}>Repuestos de motos</div></div>
            <div style={{textAlign:'right',fontFamily:'system-ui',fontSize:13}}>
              <div style={{fontWeight:700,fontSize:15}}>{currentCot.nro}</div>
              <div style={{color:'#666'}}>{fmtDate(currentCot.fecha)}</div>
              {currentCot.destino&&<div style={{color:'#666'}}>Destino: {currentCot.destino}</div>}
            </div>
          </div>
          <div style={{marginBottom:20,fontFamily:'system-ui'}}>
            <div style={{fontSize:11,color:'#666',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Cliente</div>
            <div style={{fontSize:18,fontWeight:700}}>{currentCot.cliente_nombre||'—'}</div>
            {currentCot.vin&&<div style={{fontSize:12,color:'#666',marginTop:4}}>VIN: {currentCot.vin}</div>}
          </div>
          <div style={{fontSize:16,fontWeight:700,marginBottom:12,fontFamily:'system-ui'}}>Cotización de repuestos</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,marginBottom:16,fontFamily:'system-ui'}}>
            <thead>
              <tr style={{background:'#f5f5f5'}}>
                <th style={{padding:'8px 10px',textAlign:'left',borderBottom:'1px solid #ddd',fontWeight:600,fontSize:11}}>#</th>
                <th style={{padding:'8px 10px',textAlign:'left',borderBottom:'1px solid #ddd',fontWeight:600,fontSize:11}}>Descripción</th>
                {currentCot.show_links&&<th style={{padding:'8px 10px',textAlign:'left',borderBottom:'1px solid #ddd',fontWeight:600,fontSize:11}}>Link</th>}
                <th style={{padding:'8px 10px',textAlign:'right',borderBottom:'1px solid #ddd',fontWeight:600,fontSize:11}}>Peso est.</th>
                <th style={{padding:'8px 10px',textAlign:'right',borderBottom:'1px solid #ddd',fontWeight:600,fontSize:11}}>Precio</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it:any,i:number)=>(
                <tr key={i}>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid #f0f0f0'}}>{i+1}</td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid #f0f0f0'}}><strong>{it.descripcion||'—'}</strong>{it.ubicacion_producto&&<div style={{fontSize:11,color:'#888',marginTop:2}}>{it.ubicacion_producto}</div>}</td>
                  {currentCot.show_links&&<td style={{padding:'8px 10px',borderBottom:'1px solid #f0f0f0',fontSize:11}}>{it.link?<a href={it.link} style={{color:'#3b82f6'}}>{it.link.substring(0,40)}</a>:'—'}</td>}
                  <td style={{padding:'8px 10px',borderBottom:'1px solid #f0f0f0',textAlign:'right'}}>{it.peso_estimado?it.peso_estimado.toFixed(2)+' kg':'—'}</td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid #f0f0f0',textAlign:'right'}}>{it.subtotal?fmt(it.subtotal):'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{textAlign:'right',fontFamily:'system-ui'}}>
            <div style={{fontSize:13}}>Peso total estimado: <strong>{tPeso.toFixed(2)} kg</strong></div>
            {currentCot.precio_final?<div style={{fontSize:20,fontWeight:700,marginTop:8}}>TOTAL: {fmt(currentCot.precio_final)} USD</div>:<div style={{color:'#9ca3af',marginTop:8,fontSize:13}}>Total: a confirmar</div>}
          </div>
          <div style={{marginTop:32,fontSize:11,color:'#aaa',textAlign:'center',borderTop:'1px solid #eee',paddingTop:12,fontFamily:'system-ui'}}>Cotización válida por 15 días · Precios en dólares estadounidenses</div>
        </div>
      </div>
    )
  }

  // FORM VIEW
  if(vista==='form') return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{editId?'Editar cotización':'Nueva cotización'}</h1>
      <div className="card mb-4">
        <div className="text-sm font-semibold mb-4">Datos generales</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="md:col-span-2 lg:col-span-3">
            <label className="label">Cliente</label>
            <div className="relative" ref={cliDropRef}>
              <input className="input" placeholder="Escribí para buscar cliente..." value={cliSearch}
                onChange={e=>{setCliSearch(e.target.value);setShowCliDrop(true);if(!e.target.value)setF(p=>({...p,cliente_id:'',cliente_nombre:''}))}}
                onFocus={()=>{if(cliSearch)setShowCliDrop(true)}} />
              {showCliDrop&&filtCli.length>0&&(
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1">
                  {filtCli.map(c=>(
                    <div key={c.id} className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                      onMouseDown={e=>{e.preventDefault();setF(p=>({...p,cliente_id:c.id,cliente_nombre:c.nombre}));setCliSearch(c.nombre);setShowCliDrop(false)}}>
                      <div className="font-medium text-sm">{c.nombre}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div><label className="label">Fecha</label><input className="input" type="date" value={f.fecha} onChange={e=>setF(p=>({...p,fecha:e.target.value}))} /></div>
          <div><label className="label">Nro. cotización</label><input className="input-readonly" readOnly value={f.nro} /></div>
          <div>
            <label className="label">Destino del paquete</label>
            <select className="input" value={f.destino} onChange={e=>{setF(p=>({...p,destino:e.target.value}));setCotItems(recalc(cotItems))}}>
              <option value="">—</option><option value="AR">Argentina</option>
              <option value="ES">España (sin taxes impo)</option><option value="US">EEUU (sin taxes impo)</option><option value="INT">Internacional</option>
            </select>
          </div>
          <div><label className="label">VIN</label><input className="input" placeholder="Número de VIN" value={f.vin} onChange={e=>setF(p=>({...p,vin:e.target.value}))} /></div>
          <div>
            <label className="label">Links en PDF</label>
            <select className="input" value={f.show_links?'si':'no'} onChange={e=>setF(p=>({...p,show_links:e.target.value==='si'}))}>
              <option value="si">Sí, mostrar links</option><option value="no">No mostrar links</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="text-sm font-semibold mb-3">Ítems de la cotización</div>
        {cotItems.map((it,i)=>(
          <div key={i} className="border border-gray-200 rounded-lg p-3 mb-3 bg-gray-50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
              <div className="col-span-2 md:col-span-4"><input className="input text-sm" placeholder="Descripción *" value={it.descripcion||''} onChange={e=>updateItem(i,'descripcion',e.target.value)} /></div>
              <div className="col-span-2"><input className="input text-sm" placeholder="Link / página" value={it.link||''} onChange={e=>updateItem(i,'link',e.target.value)} /></div>
              <div className="col-span-2"><input className="input text-sm" placeholder="Ubicación del producto" value={it.ubicacion_producto||''} onChange={e=>updateItem(i,'ubicacion_producto',e.target.value)} /></div>
              <div><input className="input text-sm" type="number" step="0.01" placeholder="Costo USD" value={it.costo||''} onChange={e=>updateItem(i,'costo',parseFloat(e.target.value)||0)} /></div>
              <div><input className="input text-sm" type="number" step="0.01" placeholder="Taxes impo USD" value={it.taxes_impo||''} onChange={e=>updateItem(i,'taxes_impo',parseFloat(e.target.value)||0)} /></div>
              <div><input className="input text-sm" type="number" step="0.01" placeholder="Peso est. kg" value={it.peso_estimado||''} onChange={e=>updateItem(i,'peso_estimado',parseFloat(e.target.value)||0)} /></div>
              <div><input className="input text-sm" type="number" step="0.01" placeholder="Costo envío USD" value={it.costo_envio||''} onChange={e=>updateItem(i,'costo_envio',parseFloat(e.target.value)||0)} /></div>
              <div><input className="input-readonly text-sm" readOnly placeholder="Taxes 11%" value={it.taxes_11?'$'+it.taxes_11.toFixed(2):''} /></div>
              <div><input className="input-readonly text-sm" readOnly placeholder="Subtotal" value={it.subtotal?'$'+it.subtotal.toFixed(2):''} /></div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>estimarPeso(i)} className="btn btn-sm btn-warning text-xs">🤖 Estimar peso IA</button>
              <button onClick={()=>setCotItems(p=>p.filter((_,j)=>j!==i))} className="btn btn-sm btn-danger text-xs"><X size={12}/> Eliminar</button>
            </div>
          </div>
        ))}
        <button onClick={()=>setCotItems(p=>[...p,{...EMPTY_ITEM}])} className="btn btn-sm mb-4"><Plus size={14}/> Agregar ítem</button>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between text-sm py-1"><span className="text-gray-500">Subtotal ítems</span><span className="font-semibold">{fmt(totalCosto)}</span></div>
          <div className="flex justify-between text-sm py-1"><span className="text-gray-500">Peso total estimado</span><span className="font-semibold">{totalPeso.toFixed(2)} kg</span></div>
          {sinTaxes&&<div className="text-xs text-green-600 py-1">✓ Sin taxes de importación ({f.destino==='ES'?'España':'EEUU'})</div>}
        </div>
      </div>

      <div className="card mb-4">
        <div className="text-sm font-semibold mb-3">Precio final</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label">Suma adicional (USD)</label>
            <input className="input" type="number" step="0.01" placeholder="0.00" value={f.suma_adicional||''}
              onChange={e=>{const extra=parseFloat(e.target.value)||0;setF(p=>({...p,suma_adicional:extra,precio_final:totalCosto+extra}))}} />
            <p className="text-xs text-gray-400 mt-1">Se suma al costo total</p>
          </div>
          <div>
            <label className="label">Precio final (USD)</label>
            <input className="input" type="number" step="0.01" placeholder="Editable" value={f.precio_final||''} onChange={e=>setF(p=>({...p,precio_final:parseFloat(e.target.value)||0}))} />
          </div>
          <div>
            <label className="label">Ganancia estimada</label>
            <div className={`input-readonly font-semibold ${ganancia>=0?'text-green-600':'text-red-600'}`}>{f.precio_final?(ganancia>=0?'+':'')+fmt(ganancia):'—'}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pb-8">
        <button onClick={guardar} disabled={saving} className="btn btn-primary px-8">{saving?'Guardando...':'Guardar'}</button>
        <button onClick={()=>setVista('lista')} className="btn">Cancelar</button>
      </div>
    </div>
  )

  // LISTA VIEW
  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><FileText size={24} className="text-gray-700"/><h1 className="text-2xl font-bold">Cotizaciones</h1></div>
        <button onClick={nuevaCot} className="btn btn-primary"><Plus size={16}/> Nueva cotización</button>
      </div>
      {cotizaciones.length===0
        ? <div className="text-center py-16 text-gray-400"><FileText size={40} className="mx-auto mb-3 opacity-30"/><div>No hay cotizaciones aún</div></div>
        : cotizaciones.map(c=>(
          <div key={c.id} className="card mb-3 cursor-pointer hover:border-gray-400 transition-all" onClick={()=>editarCot(c)}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-bold text-base">{c.nro} — {c.cliente_nombre||'Sin cliente'}</div>
                <div className="text-sm text-gray-500 mt-1">{fmtDate(c.fecha)} · {c.cotizacion_items?.length||0} ítem{c.cotizacion_items?.length!==1?'s':''} · {c.destino||'—'}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-bold text-lg">{c.precio_final?fmt(c.precio_final):<span className="text-gray-400 text-sm font-normal">Precio pendiente</span>}</div>
                <div className="flex gap-2 mt-2 justify-end">
                  <button onClick={e=>{e.stopPropagation();setCurrentCot(c);setVista('pdf')}} className="btn btn-sm btn-success text-xs"><Eye size={12}/> PDF</button>
                  <button onClick={e=>{e.stopPropagation();eliminar(c.id)}} className="btn btn-sm btn-danger text-xs">Eliminar</button>
                </div>
              </div>
            </div>
          </div>
        ))
      }
    </div>
  )
}
