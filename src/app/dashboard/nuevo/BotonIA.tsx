'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface BotonIAProps {
  setF: (updater: (prev: any) => any) => void;
}

export default function BotonIA({ setF }: BotonIAProps) { // setF ahora es una prop
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)

  const buscar = async () => {
    if (!texto.trim()) return
    setLoading(true)
    const tid = toast.loading('Analizando con IA...')
    try {
      // Endpoint de ejemplo. Asegúrate de tener /api/parse-ebay configurado.
      const res = await fetch('/api/parse-ebay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textoPublicacion: texto })
      })
      const r = await res.json()
      if (r.success && r.data) {
        setF((p: any) => ({
          ...p,
          pagina: 'eBay',
          producto: r.data.producto || p.producto,
          marca: r.data.marca || p.marca,
          anio: r.data.ano || p.anio,
          modelo: r.data.modelo || p.modelo,
          oem: r.data.oem || p.oem,
          peso: r.data.peso?.toString() || p.peso
        }))
        toast.success('¡Datos cargados!', { id: tid })
        setTexto('')
      } else {
        toast.error(r.error || 'Error', { id: tid })
      }
    } catch {
      toast.error('Error de conexión', { id: tid })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-purple-100 p-4 rounded-lg border border-purple-300">
      <h3 className="font-bold text-purple-800 mb-2">⚡ Autocompletar con IA</h3>
      <p className="text-sm text-purple-700 mb-3">Pegá el título o la descripción técnica copiada de eBay:</p>
      <textarea
        className="w-full border rounded p-2 text-sm h-20 mb-3"
        value={texto}
        onChange={e => setTexto(e.target.value)}
        disabled={loading}
      />
      <button
        type="button"
        onClick={buscar}
        disabled={loading || !texto.trim()}
        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 font-bold w-full"
      >
        {loading ? 'Analizando...' : 'Procesar'}
      </button>
    </div>
  )
}
