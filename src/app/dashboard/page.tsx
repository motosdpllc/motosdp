'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, fmt, fmtDate, type Item, type Alerta } from '@/lib/supabase'
import Link from 'next/link'
import { Bell, AlertTriangle, ShoppingCart, TrendingUp, Package, Clock } from 'lucide-react'
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

      // Check alertas que deben reaparecer
      const now = new Date()
      const alertasActivas = alts.filter(a => !a.recordar_en || new Date(a.recordar_en) <= now)

      setAlertas(alertasActivas)
      setHuerfanos(hurf)

      // Stats
      const vendidos = items.filter(x => x.ubicacion === 'Vendido')
      const enTransito = items.filter(x => x.ubicacion?.includes('ránsito'))
      setStats({
        invertido: items.filter(x => x.ubicacion !== 'Cancelado').reduce((a, x) => a + (x.costo_total || 0), 0),
        vendido: vendidos.reduce((a, x) => a + (x.precio_venta || 0), 0),
        ganancia: vendidos.reduce((a, x) => a + (x.ganancia || 0), 0),
        transito: enTransito.length,
        items: items.length,
        clientes: cliRes.data?.length || 0,
      })

      // Ubicaciones
      const ubMap: Record<string, number> = {}
      items.forEach(x => { if (x.ubicacion) ubMap[x.ubicacion] = (ubMap[x.ubicacion] || 0) + 1 })
      setUbicaciones(ubMap)

      // Recientes
      setRecientes(items.slice(0, 6))

      // ETA próximos
      const hoy = new Date()
      const proxETA = items
        .filter(x => x.eta && x.ubicacion !== 'Vendido' && x.ubicacion !== 'Cancelado')
        .map(x => ({ ...x, days: Math.round((new Date(x.eta + 'T12:00:00').getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)) }))
        .filter(x => x.days <= 14 && x.days >= -3)
        .sort((a, b) => a.days - b.days)
        .slice(0, 5)
      setEtaProximos(proxETA)

      // Pendientes cobro
      setPendientesCobro(items.filter(x => (x.estado_pago === 'Debe' || x.estado_pago === 'Debemos') && x.ubicacion !== 'Cancelado').slice(0, 5))

    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Check alertas cada minuto
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
    'En Mano': 'bg-green-500', 'Vendido': 'bg-gray-400', 'Cancelado': 'bg-red-500',
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400 text-lg">Cargando...</div>
    </div>
  )

  return (
    <div className="p-6 max-w-7xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* ALERTAS */}
      {(alertas.length > 0 || huerfanos.length > 0) && (
        <div className="mb-6 space-y-2">
          {huerfanos.length > 0 && (
            <div className="alert-banner bg-orange-50 border-orange-200">
              <AlertTriangle className="text-orange-500 mt-0.5 flex-shrink-0" size={18} />
              <div className="flex-1">
                <div className="font-semibold text-orange-800">{huerfanos.length} tracking{huerfanos.length > 1 ? 's' : ''} sin asignar de Daniel</div>
                <div className="text-orange-600 text-xs mt-0.5">{huerfanos.map(h => h.tracking).join(', ')}</div>
              </div>
              <Link href="/dashboard/config" className="btn btn-sm border-orange-300 text-orange-700 hover:bg-orange-100">Ver y asignar</Link>
            </div>
          )}
          {alertas.map(a => (
            <div key={a.id} className="alert-banner bg-red-50 border-red-200">
              <Bell className="text-red-500 mt-0.5 flex-shrink-0" size={18} />
              <div className="flex-1">
                <div className="font-semibold text-red-800">{a.mensaje}</div>
                <div className="text-red-500 text-xs mt-0.5">Recordar en:</div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {[15, 30, 60, 180, 1440].map(m => (
                    <button key={m} onClick={() => snoozeAlerta(a.id, m)} className="btn btn-sm border-red-200 text-red-600 hover:bg-red-100 text-xs py-0.5">
                      {m < 60 ? m + 'min' : m === 60 ? '1h' : m === 180 ? '3h' : 'Mañana'}
                    </button>
                  ))}
                  <button onClick={() => completarAlerta(a.id)} className="btn btn-sm border-green-200 text-green-700 hover:bg-green-50 text-xs py-0.5">✓ Listo</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Invertido', value: fmt(stats.invertido), color: 'text-gray-900', icon: Package },
          { label: 'Vendido', value: fmt(stats.vendido), color: 'text-gray-900', icon: ShoppingCart },
          { label: 'Ganancia', value: fmt(stats.ganancia), color: stats.ganancia >= 0 ? 'text-green-600' : 'text-red-600', icon: TrendingUp },
          { label: 'En tránsito', value: stats.transito.toString(), color: 'text-amber-600', icon: Package },
          { label: 'Total ítems', value: stats.items.toString(), color: 'text-gray-900', icon: Package },
          { label: 'Clientes', value: stats.clientes.toString(), color: 'text-blue-600', icon: Package },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{s.label}</div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* UBICACIONES */}
      <div className="card mb-6">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Estado por ubicación</div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* ETA PRÓXIMOS */}
        <div className="card">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Próximas entregas</div>
          {etaProximos.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-4">Sin entregas próximas</div>
          ) : etaProximos.map(x => (
            <div key={x.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${x.days < 0 ? 'bg-red-100 text-red-700' : x.days === 0 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                {x.days < 0 ? '!' : x.days === 0 ? 'Hoy' : x.days + 'd'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{x.producto}</div>
                <div className="text-xs text-gray-400">{x.ubicacion} · {fmtDate(x.eta)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* PENDIENTES COBRO */}
        <div className="card">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pendientes de cobro/pago</div>
          {pendientesCobro.length === 0 ? (
            <div className="text-green-600 text-sm text-center py-4">✓ Todo saldado</div>
          ) : pendientesCobro.map(x => (
            <div key={x.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${x.estado_pago === 'Debe' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                {x.estado_pago === 'Debe' ? '$' : '↑'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{x.producto}</div>
                <div className="text-xs text-gray-400">{x.estado_pago === 'Debe' ? 'Cliente: ' + (x.cliente_nombre || '—') : 'Le debés al proveedor'}</div>
              </div>
              <div className="text-sm font-semibold">{fmt(x.estado_pago === 'Debe' ? x.precio_venta : x.costo_total)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* RECIENTES */}
      <div className="card">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Últimos ítems</div>
        <div className="space-y-1">
          {recientes.map(x => (
            <div key={x.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{x.producto} {x.codigo && <span className="font-mono text-xs text-gray-400">{x.codigo}</span>}</div>
                <div className="text-xs text-gray-400">{x.pagina || '—'} {x.nro_orden ? '· Orden: ' + x.nro_orden : ''}</div>
              </div>
              <div className="text-sm text-gray-600">{fmt(x.costo_total)}</div>
              <Link href={`/dashboard/nuevo?edit=${x.id}`} className="btn btn-sm text-xs">Editar</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
