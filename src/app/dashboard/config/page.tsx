'use client'
import { useState, useEffect } from 'react'
import { supabase, type Item } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ConfigPage() {
  const [config, setConfig] = useState({ wa_admin: '5491135903620', nombre_negocio: 'Motos DP LLC', slogan: 'Repuestos de motos', admin_password: '', daniel_password: 'daniel' })
  const [huerfanos, setHuerfanos] = useState<any[]>([])
  const [searchResults, setSearchResults] = useState<Record<string, Item[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const [cfgRes, huerfRes] = await Promise.all([
      supabase.from('config').select('*'),
      supabase.from('trackings_huerfanos').select('*').eq('asignado', false).order('created_at', { ascending: false })
    ])
    const cfgMap: any = {}
    cfgRes.data?.forEach((c: any) => { cfgMap[c.key] = c.value })
    setConfig(prev => ({ ...prev, ...cfgMap }))
    setHuerfanos(huerfRes.data || [])
    setLoading(false)
  }

  const saveConfig = async () => {
    const entries = Object.entries(config).filter(([k]) => !['admin_password', 'daniel_password'].includes(k))
    for (const [key, value] of entries) {
      await supabase.from('config').upsert({ key, value })
    }
    toast.success('✓ Configuración guardada')
  }

  const searchItems = async (huerfanoId: string, q: string) => {
    if (!q.trim()) { setSearchResults(prev => ({ ...prev, [huerfanoId]: [] })); return }
    const { data } = await supabase.from('items').select('id, producto, codigo, oem, nro_orden, ubicacion')
      .or(`producto.ilike.%${q}%,oem.ilike.%${q}%,codigo.ilike.%${q}%,nro_orden.ilike.%${q}%`)
      .not('ubicacion', 'eq', 'Vendido').limit(6)
    setSearchResults(prev => ({ ...prev, [huerfanoId]: data || [] }))
  }

  const asignar = async (huerfano: any, itemId: string) => {
    const item = searchResults[huerfano.id]?.find(x => x.id === itemId)
    if (!item) return
    await supabase.from('items').update({ tracking_compra: huerfano.tracking, ubicacion: 'Daniel', updated_at: new Date().toISOString() }).eq('id', itemId)
    await supabase.from('trackings_huerfanos').update({ asignado: true, item_id: itemId }).eq('id', huerfano.id)
    toast.success(`✓ Tracking asignado a: ${item.producto}`)
    loadAll()
  }

  const descartar = async (id: string) => {
    if (!confirm('¿Descartar este tracking sin asignarlo?')) return
    await supabase.from('trackings_huerfanos').update({ asignado: true }).eq('id', id)
    loadAll()
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Configuración</h1>

      <div className="card mb-6">
        <div className="text-sm font-semibold mb-4">Sistema</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Nombre del negocio</label>
            <input className="input" value={config.nombre_negocio} onChange={e => setConfig(p => ({ ...p, nombre_negocio: e.target.value }))} />
          </div>
          <div>
            <label className="label">Slogan (PDFs)</label>
            <input className="input" value={config.slogan} onChange={e => setConfig(p => ({ ...p, slogan: e.target.value }))} />
          </div>
          <div>
            <label className="label">Tu WhatsApp para alertas</label>
            <input className="input font-mono" value={config.wa_admin} onChange={e => setConfig(p => ({ ...p, wa_admin: e.target.value }))} placeholder="+5491135903620" />
            <p className="text-xs text-gray-400 mt-1">Con código de país, sin + ni espacios</p>
          </div>
        </div>
        <div className="mt-4">
          <button onClick={saveConfig} className="btn btn-primary">Guardar configuración</button>
        </div>
      </div>

      {/* Tracking huerfanos */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">Trackings sin asignar {huerfanos.length > 0 && <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full ml-1">{huerfanos.length}</span>}</div>
        </div>
        {huerfanos.length === 0 ? (
          <div className="text-gray-400 text-sm text-center py-6">✓ Sin trackings pendientes</div>
        ) : huerfanos.map(h => (
          <div key={h.id} className="border border-orange-200 rounded-lg p-3 mb-3 bg-orange-50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-mono font-semibold text-sm">{h.tracking}</div>
                <div className="text-xs text-gray-500">{new Date(h.created_at).toLocaleDateString('es-AR')} · Ingresado por Daniel</div>
              </div>
              <button onClick={() => descartar(h.id)} className="btn btn-sm btn-danger text-xs">Descartar</button>
            </div>
            <div className="relative">
              <input
                className="input text-sm"
                placeholder="Buscar producto para asignar este tracking..."
                onChange={e => searchItems(h.id, e.target.value)}
              />
              {searchResults[h.id]?.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1">
                  {searchResults[h.id].map(item => (
                    <div key={item.id} className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0" onClick={() => asignar(h, item.id)}>
                      <div className="font-medium text-sm">{item.producto} <span className="font-mono text-xs text-gray-400">{item.codigo}</span></div>
                      <div className="text-xs text-gray-400">{item.nro_orden ? 'Orden: ' + item.nro_orden + ' · ' : ''}{item.ubicacion}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
