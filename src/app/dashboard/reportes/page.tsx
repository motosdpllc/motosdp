'use client'
import { useState, useEffect } from 'react'
import { supabase, fmt, fmtDate } from '@/lib/supabase'
import { TrendingUp, DollarSign, Package, Users, Download } from 'lucide-react'

interface Stats {
  totalInvertido: number
  totalVendido: number
  gananciaTotal: number
  margenPromedio: number
  itemsVendidos: number
  itemsEnStock: number
  itemsEnTransito: number
  topClientes: { nombre: string; total: number; items: number }[]
  topMarcas: { marca: string; items: number; ganancia: number }[]
  ventasPorMes: { mes: string; ventas: number; ganancia: number }[]
  pendientesCobrar: number
  pendientesPagar: number
}

export default function ReportesPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('todo')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  useEffect(() => { cargarStats() }, [periodo, desde, hasta])

  const cargarStats = async () => {
    setLoading(true)
    let query = supabase.from('items').select('*')

    // Filtro por período
    const hoy = new Date()
    if (periodo === '7d') query = query.gte('created_at', new Date(Date.now() - 7*24*60*60*1000).toISOString())
    else if (periodo === '30d') query = query.gte('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString())
    else if (periodo === '90d') query = query.gte('created_at', new Date(Date.now() - 90*24*60*60*1000).toISOString())
    else if (periodo === 'mes') { const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1); query = query.gte('created_at', ini.toISOString()) }
    else if (periodo === 'anio') { const ini = new Date(hoy.getFullYear(), 0, 1); query = query.gte('created_at', ini.toISOString()) }
    else if (periodo === 'custom' && desde) {
      query = query.gte('created_at', desde + 'T00:00:00')
      if (hasta) query = query.lte('created_at', hasta + 'T23:59:59')
    }

    const { data: items } = await query
    if (!items) { setLoading(false); return }

    const vendidos = items.filter(x => x.ubicacion === 'Vendido')
    const enStock = items.filter(x => !['Vendido','Cancelado'].includes(x.ubicacion||''))
    const enTransito = items.filter(x => (x.ubicacion||'').includes('ránsito'))

    const totalInvertido = items.filter(x=>x.ubicacion!=='Cancelado').reduce((a,x)=>a+(x.costo_total||0),0)
    const totalVendido = vendidos.reduce((a,x)=>a+(x.precio_venta||0),0)
    const gananciaTotal = vendidos.reduce((a,x)=>a+(x.ganancia||0),0)
    const margenPromedio = totalVendido > 0 ? (gananciaTotal/totalVendido)*100 : 0

    // Top clientes
    const cliMap: Record<string, {total:number,items:number}> = {}
    vendidos.forEach(x => {
      const n = x.cliente_nombre || 'Sin cliente'
      if (!cliMap[n]) cliMap[n] = {total:0,items:0}
      cliMap[n].total += x.precio_venta||0
      cliMap[n].items++
    })
    const topClientes = Object.entries(cliMap).map(([nombre,v])=>({nombre,...v})).sort((a,b)=>b.total-a.total).slice(0,5)

    // Top marcas
    const marcaMap: Record<string, {items:number,ganancia:number}> = {}
    items.forEach(x => {
      const m = x.marca || 'Sin marca'
      if (!marcaMap[m]) marcaMap[m] = {items:0,ganancia:0}
      marcaMap[m].items++
      marcaMap[m].ganancia += x.ganancia||0
    })
    const topMarcas = Object.entries(marcaMap).map(([marca,v])=>({marca,...v})).sort((a,b)=>b.items-a.items).slice(0,5)

    // Ventas por mes (últimos 6 meses)
    const mesesMap: Record<string, {ventas:number,ganancia:number}> = {}
    vendidos.forEach(x => {
      const fecha = x.fecha_venta || x.created_at?.split('T')[0] || ''
      if (!fecha) return
      const mes = fecha.substring(0,7)
      if (!mesesMap[mes]) mesesMap[mes] = {ventas:0,ganancia:0}
      mesesMap[mes].ventas += x.precio_venta||0
      mesesMap[mes].ganancia += x.ganancia||0
    })
    const ventasPorMes = Object.entries(mesesMap).sort(([a],[b])=>a.localeCompare(b)).slice(-6).map(([mes,v])=>({mes,...v}))

    // Pendientes
    const pendientesCobrar = items.filter(x=>x.estado_pago==='Debe').reduce((a,x)=>a+(x.precio_venta||0),0)
    const pendientesPagar = items.filter(x=>x.estado_pago==='Debemos').reduce((a,x)=>a+(x.costo_total||0),0)

    setStats({ totalInvertido, totalVendido, gananciaTotal, margenPromedio, itemsVendidos:vendidos.length, itemsEnStock:enStock.length, itemsEnTransito:enTransito.length, topClientes, topMarcas, ventasPorMes, pendientesCobrar, pendientesPagar })
    setLoading(false)
  }

  const exportarCSV = async () => {
    const { data } = await supabase.from('items').select('*').order('created_at', { ascending: false })
    if (!data) return
    const headers = ['Código','Producto','OEM','Orden','Marca','Modelo','Año','Importe','Costo Envío','Taxes','Reembolsos','Costo Total','Precio Venta','Ganancia','Ubicación','Destino','Cliente','Estado$','Fecha Compra','Fecha Venta','Tracking','Plataforma']
    const rows = data.map(x => [
      x.codigo,x.producto,x.oem,x.nro_orden,x.marca,x.modelo,x.anio,
      x.importe,x.costo_envio,x.taxes,x.reembolsos,x.costo_total,x.precio_venta,x.ganancia,
      x.ubicacion,x.destino,x.cliente_nombre,x.estado_pago,x.fecha_compra,x.fecha_venta,
      x.tracking_compra,x.plataforma
    ].map(v => v===null||v===undefined?'':String(v).replace(/,/g,';')))
    const csv = [headers.join(','),...rows.map(r=>r.join(','))].join('\n')
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='motosdp_inventario.csv'; a.click()
  }

  const mesesNombres: Record<string,string> = { '01':'Ene','02':'Feb','03':'Mar','04':'Abr','05':'May','06':'Jun','07':'Jul','08':'Ago','09':'Sep','10':'Oct','11':'Nov','12':'Dic' }
  const fmtMes = (m: string) => { const [y,mo]=m.split('-'); return (mesesNombres[mo]||mo)+' '+y.slice(2) }

  const maxVenta = stats?.ventasPorMes.reduce((a,x)=>Math.max(a,x.ventas),0) || 1

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <TrendingUp size={24} className="text-gray-700"/>
          <h1 className="text-2xl font-bold">Reportes</h1>
        </div>
        <button onClick={exportarCSV} className="btn gap-2">
          <Download size={16}/> Exportar CSV
        </button>
      </div>

      {/* Filtro período */}
      <div className="card mb-6">
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-sm text-gray-500 font-medium">Período:</span>
          {[
            {v:'7d',l:'7 días'},{v:'30d',l:'30 días'},{v:'90d',l:'90 días'},
            {v:'mes',l:'Este mes'},{v:'anio',l:'Este año'},{v:'todo',l:'Todo'},{v:'custom',l:'Personalizado'}
          ].map(p=>(
            <button key={p.v} onClick={()=>setPeriodo(p.v)}
              className={`btn btn-sm ${periodo===p.v?'btn-primary':''}`}>{p.l}</button>
          ))}
          {periodo==='custom' && (
            <div className="flex gap-2 items-center mt-2 w-full">
              <input type="date" className="input w-auto" value={desde} onChange={e=>setDesde(e.target.value)} />
              <span className="text-gray-400">→</span>
              <input type="date" className="input w-auto" value={hasta} onChange={e=>setHasta(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando reportes...</div>
      ) : stats ? (
        <>
          {/* Stats principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="card bg-gray-900 text-white">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total invertido</div>
              <div className="text-2xl font-bold">{fmt(stats.totalInvertido)}</div>
            </div>
            <div className="card bg-gray-900 text-white">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total vendido</div>
              <div className="text-2xl font-bold">{fmt(stats.totalVendido)}</div>
            </div>
            <div className={`card ${stats.gananciaTotal>=0?'bg-green-600':'bg-red-600'} text-white`}>
              <div className="text-xs text-white/70 uppercase tracking-wide mb-1">Ganancia neta</div>
              <div className="text-2xl font-bold">{fmt(stats.gananciaTotal)}</div>
              <div className="text-xs text-white/70 mt-1">Margen: {stats.margenPromedio.toFixed(1)}%</div>
            </div>
            <div className="card">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Stock</div>
              <div className="text-2xl font-bold text-gray-900">{stats.itemsEnStock}</div>
              <div className="text-xs text-gray-400 mt-1">{stats.itemsEnTransito} en tránsito</div>
            </div>
          </div>

          {/* Pendientes */}
          {(stats.pendientesCobrar > 0 || stats.pendientesPagar > 0) && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              {stats.pendientesCobrar > 0 && (
                <div className="card border-red-200 bg-red-50">
                  <div className="text-xs text-red-600 uppercase tracking-wide mb-1">Te deben cobrar</div>
                  <div className="text-xl font-bold text-red-700">{fmt(stats.pendientesCobrar)}</div>
                </div>
              )}
              {stats.pendientesPagar > 0 && (
                <div className="card border-amber-200 bg-amber-50">
                  <div className="text-xs text-amber-600 uppercase tracking-wide mb-1">Debés pagar</div>
                  <div className="text-xl font-bold text-amber-700">{fmt(stats.pendientesPagar)}</div>
                </div>
              )}
            </div>
          )}

          {/* Gráfico de ventas por mes */}
          {stats.ventasPorMes.length > 0 && (
            <div className="card mb-6">
              <div className="text-sm font-semibold mb-4">Ventas por mes</div>
              <div className="flex items-end gap-2 h-40">
                {stats.ventasPorMes.map((m,i)=>(
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs text-gray-500 font-medium">{fmt(m.ventas)}</div>
                    <div className="w-full flex flex-col justify-end" style={{height:120}}>
                      <div className={`w-full rounded-t-md transition-all ${m.ganancia>=0?'bg-green-500':'bg-red-400'}`}
                        style={{height:Math.max(4,(m.ventas/maxVenta)*100)+'%'}}
                        title={`Ventas: ${fmt(m.ventas)} | Ganancia: ${fmt(m.ganancia)}`}>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">{fmtMes(m.mes)}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm inline-block"></span>Ganancia positiva</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded-sm inline-block"></span>Pérdida</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top clientes */}
            <div className="card">
              <div className="text-sm font-semibold mb-4">Top clientes</div>
              {stats.topClientes.length === 0
                ? <div className="text-gray-400 text-sm text-center py-4">Sin ventas aún</div>
                : stats.topClientes.map((c,i)=>(
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{c.nombre}</div>
                      <div className="text-xs text-gray-400">{c.items} ítem{c.items!==1?'s':''}</div>
                    </div>
                    <div className="font-semibold text-sm flex-shrink-0">{fmt(c.total)}</div>
                  </div>
                ))
              }
            </div>

            {/* Top marcas */}
            <div className="card">
              <div className="text-sm font-semibold mb-4">Por marca</div>
              {stats.topMarcas.length === 0
                ? <div className="text-gray-400 text-sm text-center py-4">Sin datos</div>
                : stats.topMarcas.map((m,i)=>(
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{m.marca||'?'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{m.marca||'Sin marca'}</div>
                      <div className="text-xs text-gray-400">{m.items} ítem{m.items!==1?'s':''}</div>
                    </div>
                    <div className={`font-semibold text-sm flex-shrink-0 ${m.ganancia>=0?'text-green-600':'text-red-600'}`}>
                      {m.ganancia>=0?'+':''}{fmt(m.ganancia)}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
