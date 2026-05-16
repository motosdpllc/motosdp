'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface BotonIAProps {
  linkProducto: string
  setLinkProducto: (val: string) => void
  setF: (updater: (prev: any) => any) => void
}

export default function BotonIA({ linkProducto, setLinkProducto, setF }: BotonIAProps) {
  const [loadingIA, setLoadingIA] = useState(false)

  return (
    <div className="card mb-4 border-purple-200 bg-purple-50 p-4 rounded-xl border">
      <div className="text-sm font-semibold text-purple-800 mb-1">⚡ Autocompletar con IA</div>
      <p className="text-xs text-purple-600 mb-2">Pegá el link de eBay y la IA va a buscar la información sola:</p>
      <div className="flex gap-2">
        <input 
          type="text"
          className="input bg-white border-purple-300 focus:border-purple-500 text-sm flex-1 px-3 py-2 border rounded-lg" 
          placeholder="https://www.ebay.com/itm/..." 
          value={linkProducto}
          onChange={e => setLinkProducto(e.target.value)}
          disabled={loadingIA}
        />
        <button 
          type="button" 
          onClick={async () => {
            if (!linkProducto.trim()) return
            setLoadingIA(true)
            const toastId = toast.loading('Descargando publicación y analizando con IA...')
            try {
              const res = await fetch('/api/parse-ebay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: linkProducto })
              })
              const result = await res.json()
              if (result.success && result.data) {
                const d = result.data
                setF((prev: any) => ({
                  ...prev,
                  pagina: 'eBay',
                  producto: d.producto || prev.producto,
                  marca: d.marca || prev.marca,
                  anio: d.ano || prev.anio,
                  modelo: d.modelo || prev.modelo,
                  oem: d.oem || prev.oem,
                  peso: d.peso ? d.peso.toString() : prev.peso,
                }))
                toast.success('¡Datos cargados con éxito!', { id: toastId })
              } else {
                toast.error(result.error || 'No se pudo extraer la información.', { id: toastId })
              }
            } catch (err) {
              toast.error('Error de conexión con la IA.', { id: toastId })
            } finaly {
              setLoadingIA(false)
            }
          }}
          disabled={loadingIA || !linkProducto.trim()}
          className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 text-sm rounded-lg transition-colors"
        >
          {loadingIA ? 'Procesando...' : 'Completar Solo'}
        </button>
      </div>
    </div>
  )
}