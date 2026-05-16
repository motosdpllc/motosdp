'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Zap } from 'lucide-react'

export default function TrackingPage() {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<Array<{linea:string,ok:boolean,msg:string}>>([])
  const [loading, setLoading] = useState(false)

  const detectarSep = (l: string) => {
    const tabs=(l.match(/\t/g)||[]).length
    const sc=(l.match(/;/g)||[]).length
    const c=(l.match(/,/g)||[]).length
    if(tabs>=sc&&tabs>=c)return'\t'
    if(sc>=c)return';'
    return','
  }

  const procesar = async () => {
    const lineas = texto.split('\n').filter(l => l.trim())
    if (!lineas.length) return
    setLoading(true)
    const res: typeof resultados = []
    const sep = detectarSep(lineas[0])

    for (const linea of lineas) {
      const partes = linea.split(sep).map(p => p.trim().replace(/^"|"$/g,''))
      if (partes.length < 2) { res.push({ linea, ok: false, msg: 'Formato inválido — necesita orden y tracking' }); continue }
      
      const [orden, tracking] = partes
      const { data } = await supabase.from('items').select('id, producto, peso').eq('nro_orden', orden).limit(1)
      
      if (!data?.length) { res.push({ linea, ok: false, msg: `Orden "${orden}" no encontrada` }); continue }
      
      const item = data[0]
      const ubicacion = (item.peso && item.peso > 0) ? 'En Mano' : 'En tránsito a Daniel'
      
      await supabase.from('items').update({ tracking_compra: tracking, ubicacion, updated_at: new Date().toISOString() }).eq('id', item.id)
      res.push({ linea, ok: true, msg: `✓ ${item.producto} → tracking actualizado (${ubicacion})` })
    }
    
    setResultados(res)
    setLoading(false)
    const ok = res.filter(r => r.ok).length
    toast.success(`${ok} de ${res.length} trackings actualizados`)
  }

  const leerArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setTexto(ev.target?.result as string || '')
    reader.readAsText(file, 'UTF-8')
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-2">
        <Zap className="text-amber-500" size={24} />
        <h1 className="text-2xl font-bold">Carga masiva de tracking</h1>
      </div>
      <p className="text-gray-500 mb-6">
        Pegá filas con formato: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">nro_orden [tab o ;] tracking</code> — una por línea.
        Detecta automáticamente el separador (tab, punto y coma o coma).
      </p>

      <div className="card mb-4 bg-white p-4 shadow rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">Pegar datos</label>
        <textarea
          className="w-full font-mono text-sm border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-gray-900 h-40 resize-none"
          placeholder={"ORD-001\t1Z999AA10123456784\nORD-002\t9400111899223397622940"}
          value={texto} onChange={e => setTexto(e.target.value)}
        />
        <div className="flex gap-2 mt-3">
          <button onClick={procesar} disabled={loading || !texto.trim()} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:bg-gray-300">
            {loading ? 'Procesando...' : 'Procesar tracking'}
          </button>
          <label className="px-4 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
            📎 Subir CSV / TXT
            <input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={leerArchivo} />
          </label>
          {texto && <button onClick={() => { setTexto(''); setResultados([]) }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Limpiar</button>}
        </div>
      </div>

      {resultados.length > 0 && (
        <div className="card bg-white p-4 shadow rounded-lg">
          <div className="text-sm font-semibold mb-3">
            {resultados.filter(r => r.ok).length} actualizados · {resultados.filter(r => !r.ok).length} errores
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {resultados.map((r, i) => (
              <div key={i} className={`flex gap-3 px-3 py-2 border-b border-gray-100 last:border-0 text-sm ${r.ok ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                <span className="flex-shrink-0">{r.ok ? '✓' : '✕'}</span>
                <span className="font-mono text-xs flex-shrink-0 opacity-60 truncate max-w-32">{r.linea.substring(0, 30)}</span>
                <span className="flex-1">{r.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}