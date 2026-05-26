'use client'
import { useState, useRef } from 'react' // Importa useRef
import toast from 'react-hot-toast'

interface SelectorCotizacionProps {
  cotizaciones: any[]
  setF: (updater: (prev: any) => any) => void
  setCliSearch: (val: string) => void
  cotDropRef: React.RefObject<HTMLDivElement> // cotDropRef es un RefObject<HTMLDivElement>
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
    const it = items[0] // Carga el primer ítem de la cotización
    setF((p: any) => ({
      ...p,
      producto: it.descripcion || p.producto,
      link_producto: it.link || p.link_producto, // Asumo que `it.link` es el link del producto
      pagina: it.ubicacion_producto || p.pagina, // Asumo que `ubicacion_producto` es la página
      importe: it.costo?.toString() || p.importe, // Asumo que `it.costo` es el importe
      peso: it.peso_estimado?.toString() || p.peso,
      costo_envio: it.costo_envio?.toString() || p.costo_envio,
      cliente_id: cot.cliente_id || p.cliente_id,
      cliente_nombre: cot.cliente_nombre || p.cliente_nombre,
      // Aquí podrías sumar otros campos si es necesario
    }))
    if (cot.cliente_nombre) setCliSearch(cot.cliente_nombre)
    setShowCotDrop(false)
    setCotSearch('')
    toast.success('Datos de cotización cargados ✓')
  }

  return (
    <div className="bg-yellow-100 p-4 rounded-lg border border-yellow-300 relative">
      <h3 className="font-bold text-yellow-800 mb-2">📋 Cargar datos desde cotización</h3>
      <p className="text-sm text-yellow-700 mb-3">Busca una cotización existente para precargar algunos datos del ítem.</p>
      <input
        type="text"
        className="w-full border rounded p-2 text-sm mb-3"
        value={cotSearch}
        onChange={e => { setCotSearch(e.target.value); setShowCotDrop(true) }}
        onFocus={() => setShowCotDrop(true)}
        placeholder="Buscar cotización por nro o cliente..."
      />
      {showCotDrop && filtCot.length > 0 && (
        <div ref={cotDropRef} className="absolute top-full left-0 right-0 bg-white border rounded mt-1 shadow-lg z-10 max-h-48 overflow-y-auto">
          {filtCot.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={e => { e.preventDefault(); cargarDesdeCot(c) }}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0 text-sm"
            >
              <p className="font-bold">{c.nro} — {c.cliente_nombre || 'Sin cliente'}</p>
              <p className="text-gray-600">{c.cotizacion_items?.length || 0} ítems</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
