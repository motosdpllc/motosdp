'use client'
import { useState, useEffect } from 'react'
import { supabase, type Item } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ConfigPage() {
  const [config, setConfig] = useState({ wa_admin: '5491135903620', nombre_negocio: 'Motos DP LLC', slogan: 'Repuestos de motos', logo_url: '' })
  const [huerfanos, setHuerfanos] = useState<any[]>([])
  const [searchResults, setSearchResults] = useState<Record<string, Item[]>>({})
  const [loading, setLoading] = useState(true)
  const [logoPreview, setLogoPreview] = useState('')

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
    setLogoPreview(cfgMap.logo_url || '')
    setHuerfanos(huerfRes.data || [])
    setLoading(false)
  }

  const saveConfig = async () => {
    for (const [key, value] of Object.entries(config)) {
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
    if (!confirm('¿Descartar este tracking?')) return
    await supabase.from('trackings_huerfanos').update({ asignado: true }).eq('id', id)
    loadAll()
  }

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      setConfig(p => ({ ...p, logo_url: url }))
      setLogoPreview(url)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Configuración</h1>

      {/* Sistema */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200 mb-6">
        <div className="text-sm font-semibold mb-4 text-gray-800">Sistema</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nombre del negocio</label>
            <input className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900" value={config.nombre_negocio} onChange={e => setConfig(p => ({ ...p, nombre_negocio: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Slogan (PDFs)</label>
            <input className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900" value={config.slogan} onChange={e => setConfig(p => ({ ...p, slogan: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Tu WhatsApp para alertas</label>
            <input className="w-full text-sm font-mono border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900" value={config.wa_admin} onChange={e => setConfig(p => ({ ...p, wa_admin: e.target.value }))} placeholder="5491135903620" />
            <p className="text-xs text-gray-400 mt-1">Con código de país, sin + ni espacios. Ej: 5491135903620</p>
          </div>
        </div>
        <div className="mt-4">
          <button onClick={saveConfig} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800">Guardar configuración</button>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200 mb-6">
        <div className="text-sm font-semibold mb-4 text-gray-800">Logo para PDFs de cotización</div>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">URL del logo (o subí una imagen)</label>
            <input className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900 mb-2" placeholder="https://..." value={config.logo_url.startsWith('data:') ? '' : config.logo_url}
              onChange={e => { setConfig(p => ({ ...p, logo_url: e.target.value })); setLogoPreview(e.target.value) }} />
            <label className="w-full text-center block px-4 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
              📎 Subir imagen
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
            </label>
            <p className="text-xs text-gray-400 mt-1">PNG o JPG recomendado. Se guarda en la configuración.</p>
          </div>
          {logoPreview && (
            <div className="flex-shrink-0">
              <div className="text-xs text-gray-500 mb-1">Vista previa:</div>
              <img src={logoPreview} alt="Logo" className="h-16 object-contain border border-gray-200 rounded-lg p-1" />
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center">
          <button onClick={saveConfig} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800">Guardar logo</button>
          {config.logo_url && <button onClick={() => { setConfig(p => ({ ...p, logo_url: '' })); setLogoPreview('') }} className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 ml-2">Quitar logo</button>}
        </div>
      </div>

      {/* Trackings huérfanos */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-gray-800">
            Trackings sin asignar
            {huerfanos.length > 0 && <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full ml-2">{huerfanos.length}</span>}
          </div>
        </div>
        {huerfanos.length === 0
          ? <div className="text-gray-400 text-sm text-center py-6">✓ Sin trackings pendientes</div>
          : huerfanos.map((h, i) => (
            <div key={h.id} className="border border-orange-200 rounded-lg p-3 mb-3 bg-orange-50">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-mono font-semibold text-sm text-orange-950">{h.tracking}</div>
                  <div className="text-xs text-gray-500">{new Date(h.created_at).toLocaleDateString('es-AR')} · Ingresado por Daniel</div>
                </div>
                <button onClick={() => descartar(h.id)} className="px-2.5 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100">Descartar</button>
              </div>
              <div className="relative">
                <input className="w-full text-sm border border-gray-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Buscar producto para asignar este tracking..."
                  onChange={e => searchItems(h.id, e.target.value)} />
                {searchResults[h.id]?.length > 0 && (                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 max-h-48 overflow-y-auto">
                    {searchResults[h.id].map(item => (
                      <div key={item.id} className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0" onClick={() => asignar(h, item.id)}>
                        <div className="font-medium text-sm text-gray-800">{item.producto} <span className="font-mono text-xs text-gray-400">{item.codigo}</span></div>
                        <div className="text-xs text-gray-400">{item.nro_orden ? 'Orden: ' + item.nro_orden + ' · ' : ''}{item.ubicacion}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}