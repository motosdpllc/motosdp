'use client'
import { useState, useEffect } from 'react'
import { supabase, type Alerta } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Bell, Plus, Check, Clock } from 'lucide-react'

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [nueva, setNueva] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('alertas').select('*, clientes(nombre)').eq('completada', false).order('created_at', { ascending: false })
    setAlertas(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const crear = async () => {
    if (!nueva.trim()) return
    await supabase.from('alertas').insert({ tipo: 'custom', mensaje: nueva.trim(), activa: true })
    toast.success('Alerta creada')
    setNueva('')
    load()
  }

  const snooze = async (id: string, minutes: number) => {
    const recordarEn = new Date(Date.now() + minutes * 60 * 1000).toISOString()
    await supabase.from('alertas').update({ recordar_en: recordarEn, activa: true }).eq('id', id)
    toast.success(`Recordatorio en ${minutes < 60 ? minutes + 'min' : minutes / 60 + 'h'}`)
    load()
  }

  const completar = async (id: string) => {
    await supabase.from('alertas').update({ completada: true, activa: false }).eq('id', id)
    toast.success('✓ Completada')
    load()
  }

  const tipoColor: Record<string, string> = {
    comprar: 'bg-red-100 text-red-700 border-red-200',
    tracking_huerfano: 'bg-orange-100 text-orange-700 border-orange-200',
    cancelado_proveedor: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    custom: 'bg-blue-100 text-blue-700 border-blue-200',
  }

  const now = new Date()
  const activas = alertas.filter(a => a.activa && (!a.recordar_en || new Date(a.recordar_en) <= now))
  const snoozed = alertas.filter(a => a.recordar_en && new Date(a.recordar_en) > now)

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="text-gray-700" size={24} />
        <h1 className="text-2xl font-bold">Alertas y recordatorios</h1>
        {activas.length > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{activas.length}</span>}
      </div>

      {/* Nueva alerta */}
      <div className="card mb-6">
        <div className="text-sm font-semibold mb-3">Nueva alerta manual</div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Ej: Comprar carburador K88 para Juan..."
            value={nueva}
            onChange={e => setNueva(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') crear() }}
          />
          <button onClick={crear} disabled={!nueva.trim()} className="btn btn-primary gap-1">
            <Plus size={16} /> Crear
          </button>
        </div>
      </div>

      {/* Alertas activas */}
      {activas.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">🔔 Activas ahora ({activas.length})</div>
          <div className="space-y-3">
            {activas.map(a => (
              <div key={a.id} className={`rounded-xl border p-4 ${tipoColor[a.tipo] || 'bg-gray-50 border-gray-200'}`}>
                <div className="font-semibold text-sm mb-3">{a.mensaje}</div>
                <div className="text-xs mb-3 opacity-70">
                  {a.tipo === 'comprar' && '🛒 Compra pendiente'}
                  {a.tipo === 'tracking_huerfano' && '📦 Tracking sin asignar'}
                  {a.tipo === 'custom' && '📝 Recordatorio'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs opacity-60 self-center mr-1">Recordar en:</span>
                  {[
                    { label: '15min', min: 15 },
                    { label: '30min', min: 30 },
                    { label: '1h', min: 60 },
                    { label: '3h', min: 180 },
                    { label: 'Mañana', min: 1440 },
                  ].map(({ label, min }) => (
                    <button key={min} onClick={() => snooze(a.id, min)}
                      className="btn btn-sm bg-white/70 border-current text-xs py-0.5">
                      <Clock size={10} /> {label}
                    </button>
                  ))}
                  <button onClick={() => completar(a.id)} className="btn btn-sm bg-white border-green-400 text-green-700 text-xs py-0.5 ml-auto">
                    <Check size={12} /> Listo
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Snoozed */}
      {snoozed.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">⏰ Pospuestas ({snoozed.length})</div>
          <div className="space-y-2">
            {snoozed.map(a => {
              const remaining = Math.round((new Date(a.recordar_en!).getTime() - now.getTime()) / 60000)
              return (
                <div key={a.id} className="card flex items-center gap-3 opacity-60">
                  <Clock size={16} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 text-sm truncate">{a.mensaje}</div>
                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {remaining < 60 ? `${remaining}min` : `${Math.round(remaining / 60)}h`}
                  </div>
                  <button onClick={() => completar(a.id)} className="btn btn-sm text-xs">✓</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activas.length === 0 && snoozed.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">✨</div>
          <div className="text-lg font-medium">Sin alertas pendientes</div>
          <div className="text-sm mt-1">Estás al día con todo</div>
        </div>
      )}
    </div>
  )
}
