'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface SelectorCotizacionProps {
  cotizaciones: any[]
  setF: (updater: (prev: any) => any) => void
  setCliSearch: (val: string) => void
  cotDropRef: React.RefObject<HTMLDivElement>
}

export default function SelectorCotizacion({ cotizaciones, setF, setCliSearch, cotDropRef }: SelectorCotizacionProps) {
  const [cotSearch, setCotSearch] = useState('')
  const [showCotDrop, setShowCotDrop] = useState(false)

  const filtCot = cotizaciones.filter(c => 
    !cotSearch || 
    (c.nro || '').toLowerCase().includes(cotSearch.toLowerCase()) || 
    (c.cliente_nombre || '').toLowerCase().includes(cotSearch.toLowerCase())
  ).slice(0, 6)

  const cargarDesdeCot = (cot: any) => {
    const items = cot.cotizacion_items || []
    if (!items.length) { toast.error('Esta cotización no tiene ítems'); return }
    const it = items[0]
    setF((p: any) => ({
      ...p,
      producto: it.descripcion || p.producto,
      link_producto: it.link || p.link_producto,
      pagina: it.ubicacion_producto || p.pagina,
      importe: it.costo?.toString() || p.importe,
      peso: it.peso_estimado?.toString() || p.peso,
      costo_envio: it.costo_envio?.toString() || p.costo_envio,
      cliente_id: cot.cliente_id || p.cliente_id,
      cliente_nombre: cot.cliente_nombre || p.cliente_nombre,
    }))
    if (cot.cliente_nombre) setCliSearch(cot.cliente_nombre)
    setShowCotDrop(false)
    setCotSearch('')
    toast.success('Datos de cotización cargados ✓')
  }

  return (
    <div className="card mb-4 border-blue-200 bg-blue-50 p-4 rounded-xl border" ref={cotDropRef}>
      <div className="text-sm font-semibold text-blue-800 mb-2">📋 Cargar datos desde cotización</div>
      <div className="relative">
        <input 
          className="w-full px-3 py-2 border rounded-lg bg-white text-sm" 
          placeholder="Buscar cotización por número o cliente..." 
          value={cotSearch} 
          onChange={e => { setCotSearch(e.target.value); setShowCotDrop(true) }} 
          onFocus={() => setShowCotDrop(true)} 
        />
        {showCotDrop && filtCot.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1 max-h-60 overflow-y-auto">
            {filtCot.map(c => (
              <div 
                key={c.id} 
                className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 text-sm" 
                onMouseDown={e => { e.preventDefault(); cargarDesdeCot(c) }}
              >
                <div className="font-medium text-gray-800">{c.nro} — {c.cliente_nombre || 'Sin cliente'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}