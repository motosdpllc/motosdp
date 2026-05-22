'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, fmt, fmtDate, type Item, type Alerta } from '@/lib/supabase'
import Link from 'next/link'
import { Bell, AlertTriangle, ShoppingCart, TrendingUp, Package } from 'lucide-react'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const [stats, setStats] = useState({ invertido: 0, vendido: 0, ganancia: 0, transito: 0, items: 0, clientes: 0 })
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [huerfanos, setHuerfanos] = useState<any[]>([])
  const [ubicaciones, setUbicaciones] = useState<Record<string, number>>({})
  const [recientes, setRecientes] = useState<Item[]>([])
  const [etaProximos, setEtaProximos] = useState<any[]>([])
  const [pendientesCobro, setPendientesCobro] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [itemsRes, alertasRes, huerfRes, cliRes] = await Promise.all([
        supabase.from('items').select('*').order('created_at', { ascending: false }),
        supabase.from('alertas').select('*').eq('activa', true).eq('completada', false).order('created_at', { ascending: false }),
        supabase.from('trackings_huerfanos').select('*').eq('asignado', false).order('created_at', { ascending: false }),
        supabase.from('clientes').select('id'),
      ])

      const items: Item[] = itemsRes.data || []
      const alts: Alerta[] = alertasRes.data || []
      const hurf = huerfRes.data || []

      const now = new Date()
      const alertasActivas = alts.filter(a => !a.recordar_en || new Date(a.recordar_en) <= now)

      setAlertas(alertasActivas)
      setHuerfanos(hurf)

      const itemsVendidos = items.filter(x => x.destino === 'Venta')
      const itemsEnStock = items.filter(x => x.destino === 'Stock')

      setStats({
        invertido: items.reduce((a, x) => a + (x.costo_total || 0), 0),
        vendido: itemsVendidos.reduce((a, x) => a + (x.precio_venta || 0), 0),
        ganancia: itemsVendidos.reduce((a, x) => a + (x.ganancia || 0), 0),
        transito: items.filter(x => x.tracking_compra && !x.ubicacion).length,
        items: items.length,
        clientes: cliRes.data?.length || 0,
      })

      const ubMap: Record<string, number> = {}
      items.forEach(x => { 
        if (x.ubicacion) {
          ubMap[x.ubicacion] = (ubMap[x.ubicacion] || 0) + 1 
        } else if (x.destino === 'Stock') {
          ubMap['Sin Ubicación'] = (ubMap['Sin Ubicación'] || 0) + 1
        }
      })
      setUbicaciones(ubMap)

      setRecientes(items.slice(0, 6))

      const hoy = new Date()
      const proxETA = items
        .filter(x => x.eta && x.destino !== 'Venta')
        .map(x => ({ ...x, days: Math.round((new Date(x.eta + 'T12:00:00').getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)) }))
        .filter(x => x.days <= 14 && x.days >= -3)
        .sort((a, b) => a.days - b.days)
        .slice(0, 5)
      setEtaProximos(proxETA)

      setPendientesCobro(items.filter(x => x.estado_pago === 'Debe' || x.estado_pago === 'Debemos').slice(0, 5))

    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [loadData])

  const snoozeAlerta = async (id: string, minutes: number) => {
    const recordarEn = new Date(Date.now() + minutes * 60 * 1000).toISOString()
    await supabase.from('alertas').update({ recordar_en: recordarEn, intervalo_minutos: minutes }).eq('id', id)
    toast.success(`Recordatorio en ${minutes < 60 ? minutes + ' min' : (minutes / 60) + 'h'}`)
    loadData()
  }

  const completarAlerta = async (id: string) => {
    await supabase.from('alertas').update({ completada: true, activa: false }).eq('id', id)
    toast.success('Alerta completada')
    loadData()
  }

  const dotColor: Record<string, string> = {
    'Argentina': 'bg-blue-500', 
    'EEUU': 'bg-green-500', 
    'España': 'bg-red-500',
    'Sin Ubicación': 'bg-gray-300'
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400 text-lg">Cargando...</div>
    </div>
  )

  return (
    <div className="p-6 max-w-7xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* BANNER DE ALERTAS */}
      {(alertas.length > 0 || huerfanos.length > 0) && (
        <div className="mb-6 space-y-2">
          {huerfanos.length > 0 && (
            <div className="alert-banner bg-orange-50 border-orange-200 p-4 rounded-xl flex gap-3 items-start border">
              <AlertTriangle className="text-orange-500 mt-0.5 flex-shrink-0" size={18} />
              <div className="flex-1">
                <div className="font-semibold text-orange-800">{huerfanos.length} tracking{huerfanos.length > 1 ? 's' : ''} sin asignar</div>
                <div className="text-orange-600 text-xs mt-0.5">{huerfanos.map(h => h.tracking).join(', ')}</div>
              </div>
              <Link href="/dashboard/config" className="btn btn-sm border-orange-300 text-orange-700 hover:bg-orange-100 text-xs px-2 py-1 border rounded">Ver y asignar</Link>
            </div>
          )}
          {alertas.map(a => (
            <div key={a.id} className="alert-banner bg-red-50 border-red-200 p-4 rounded-xl flex gap-3 items-start border">
              <Bell className="text-red-500 mt-0.5 flex-shrink-0" size={18} />
              <div className="flex-1">
                <div className="font-semibold text-red-800">{a.mensaje}</div>
                <div className="text-red-500 text-xs mt-0.5">Recordar en:</div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {[15, 30, 60, 180, 1440].map(m => (
                    <button key={m} onClick={() => snoozeAlerta(a.id, m)} className="border border-red-200 text-red-600 hover:bg-red-100 text-xs py-0.5 px-2 rounded">
                      {m < 60 ? m + 'min' : m === 60 ? '1h' : m === 180 ? '3h' : 'Mañana'}
                    </button>
                  ))}
                  <button onClick={() => completarAlerta(a.id)} className="border border-green-200 text-green-700 hover:bg-green-50 text-xs py-0.5 px-2 rounded font-medium">✓ Listo</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BLOQUES DE ESTADÍSTICAS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Invertido Total', value: fmt(stats.invertido), color: 'text-gray-900' },
          { label: 'Vendido Total', value: fmt(stats.vendido), color: 'text-gray-900' },
          { label: 'Ganancia real', value: fmt(stats.ganancia), color: stats.ganancia >= 0 ? 'text-green-600' : 'text-red-600' },
          { label: 'Por recibir (ETA)', value: stats.transito.toString(), color: 'text-amber-600' },
          { label: 'Items en Base', value: stats.items.toString(), color: 'text-gray-900' },
          { label: 'Fidelizados', value: stats.clientes.toString(), color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{s.label}</div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* UBICACIONES REALES DE STOCK */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Distribución Física de Stock</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ubicaciones).map(([u, c]) => (
            <Link key={u} href={`/dashboard/inventario?ubicacion=${encodeURIComponent(u)}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 hover:border-gray-400 text-sm transition-all">
              <span className={`w-2 h-2 rounded-full ${dotColor[u] || 'bg-violet-400'}`}></span>
              <span>{u}</span>
              <span className="font-semibold">{c}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* SECCIÓN INFERIOR DE SEGUIMIENTO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximos Arribos */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Package size={16} className="text-amber-500" /> Próximos Arribos (ETA)
          </h3>
          <div className="space-y-2">
            {etaProximos.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">No hay arribos estimados en los próximos 14 días.</p>
            ) : (
              etaProximos.map(item => (
                <div key={item.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                  <span className="truncate max-w-[250px] font-medium text-gray-800">{item.repuesto || item.descripcion || 'Sin descripción'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${item.days < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {item.days === 0 ? 'Llega hoy' : item.days < 0 ? `Demorado ${Math.abs(item.days)}d` : `En ${item.days} días`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cuentas Pendientes de Pago/Cobro */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ShoppingCart size={16} className="text-red-500" /> Saldos Pendientes
          </h3>
          <div className="space-y-2">
            {pendientesCobro.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">Al día. No hay saldos pendientes.</p>
            ) : (
              pendientesCobro.map(item => (
                <div key={item.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                  <span className="truncate max-w-[250px] text-gray-800">{item.repuesto || item.descripcion}</span>
                  <span className={`text-xs font-bold ${item.estado_pago === 'Debe' ? 'text-red-600' : 'text-orange-600'}`}>
                    {item.estado_pago === 'Debe' ? 'Cliente Debe' : 'Debemos'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}