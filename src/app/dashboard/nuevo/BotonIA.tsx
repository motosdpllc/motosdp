'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function BotonIA({ linkProducto, setLinkProducto, setF }: any) {
  const [loading, setLoading] = useState(false)
  const buscar = async () => {
    if (!linkProducto.trim()) return
    setLoading(true)
    const tid = toast.loading('Analizando con IA...')
    try {
      const res = await fetch('/api/parse-ebay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: linkProducto }) })
      const r = await res.json()
      if (r.success && r.data) {
        setF((p: any) => ({ ...p, pagina: 'eBay', producto: r.data.producto || p.producto, marca: r.data.marca || p.marca, anio: r.data.ano || p.anio, modelo: r.data.modelo || p.modelo, oem: r.data.oem || p.oem, peso: r.data.peso?.toString() || p.peso }))
        toast.success('¡Datos cargados!', { id: tid })
      } else { toast.error(r.error || 'Error', { id: tid }) }
    } catch { toast.error('Error de conexión', { id: tid }) } finally { setLoading(false) }
  }
  return (
    <div className="card mb-4 border-purple-200 bg-purple-50 p-4 rounded-xl border">
      <div className="text-sm font-semibold text-purple-800 mb-1">⚡ Autocompletar con IA</div>
      <div className="flex gap-2">
        <input className="input bg-white text-sm flex-1 px-3 py-2 border rounded-lg" placeholder="Link de eBay..." value={linkProducto} onChange={e => setLinkProducto(e.target.value)} disabled={loading} />
        <button type="button" onClick={buscar} disabled={loading || !linkProducto.trim()} className="bg-purple-600 text-white px-4 py-2 text-sm rounded-lg">{loading ? '...' : 'Completar Solo'}</button>
      </div>
    </div>
  )
}