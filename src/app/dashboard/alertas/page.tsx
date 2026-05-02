'use client'
import { useState, useEffect } from 'react'
import { supabase, type Alerta } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Bell, Plus, Check, Clock, Calendar } from 'lucide-react'

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [nueva, setNueva] = useState('')
  const [fechaProg, setFechaProg] = useState('')
  const [horaProg, setHoraProg] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'activas'|'nueva'|'programar'>('activas')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('alertas').select('*').eq('completada', false).order('created_at', { ascending: false })
    setAlertas(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Check alertas every 30s
  useEffect(() => {
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const crear = async () => {
    if (!nueva.trim()) return
    await supabase.from('alertas').insert({ tipo: 'custom', mensaje: nueva.trim(), activa: true })
    toast.success('Alerta creada')
    setNueva('')
    load()
  }

  const programar = async () => {
    if (!nueva.trim()) { toast.error('Ingresá el mensaje de la alerta'); return }
    if (!fechaProg) { toast.error('Seleccioná una fecha'); return }
    if (!horaProg) { toast.error('Seleccioná una hora'); return }
    const recordarEn = new Date(`${fechaProg}T${horaProg}:00`).toISOString()
    await supabase.from('alertas').insert({
      tipo: 'custom',
      mensaje: nueva.trim(),
      activa: true,
      recordar_en: recordarEn
    })
    toast.success(`Alerta programada para el ${fechaProg} a las ${horaProg}`)
    setNueva(''); setFechaProg(''); setHoraProg('')
    load()
  }

  const snooze = async (id: string, minutes: number) => {
    const recordarEn = new Date(Date.now() + minutes * 60 * 1000).toISOString()
    await supabase.from('alertas').update({ recordar_en: recordarEn, activa: true }).eq('id', id)
    toast.success(`Recordatorio en ${minutes < 60 ? minutes + 'min' : minutes === 60 ? '1h' : minutes === 180 ? '3h' : 'mañana'}`)
    load()
  }

  const snoozeDateTime = async (id: string, fecha: string, hora: string) => {
    if (!fecha || !hora) { toast.error('Seleccioná fecha y hora'); return }
    const recordarEn = new Date(`${fecha}T${hora}:00`).toISOString()
    await supabase.from('alertas').update({ recordar_en: recordarEn }).eq('id', id)
    toast.success(`Recordatorio programado para ${fecha} a las ${hora}`)
    load()
  }

  const completar = async (id: string) => {
    await supabase.from('alertas').update({ completada: true, activa: false }).eq('id', id)
    toast.success('✓ Completada')
    load()
  }

  const now = new Date()
  const activas = alertas.filter(a => a.activa && (!a.recordar_en || new Date(a.recordar_en) <= now))
  const snoozed = alertas.filter(a => a.recordar_en && new Date(a.recordar_en) > now)

  const tipoColor: Record<string, string> = {
    comprar: 'bg-red-50 border-red-200',
    tracking_huerfano: 'bg-orange-50 border-orange-200',
    cancelado_proveedor: 'bg-yellow-50 border-yellow-200',
    custom: 'bg-blue-50 border-blue-200',
  }
  const tipoText: Record<string, string> = {
    comprar: 'text-red-800', tracking_huerfano: 'text-orange-800',
    cancelado_proveedor: 'text-yellow-800', custom: 'text-blue-800',
  }

  const hoy = new Date().toISOString().split('T')[0]

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="text-gray-700" size={24} />
        <h1 className="text-2xl font-bold">Alertas y recordatorios</h1>
        {activas.length > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{activas.length}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { v: 'activas', l: `Activas ${activas.length > 0 ? '('+activas.length+')' : ''}` },
          { v: 'nueva', l: '+ Alerta rápida' },
          { v: 'programar', l: '📅 Programar' },
        ].map(t => (
          <button key={t.v} onClick={() => setTab(t.v as any)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === t.v ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Nueva alerta rápida */}
      {tab === 'nueva' && (
        <div className="card mb-6">
          <div className="text-sm font-semibold mb-3">Alerta rápida</div>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Ej: Comprar carburador K88 para Juan..."
              value={nueva} onChange={e => setNueva(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') crear() }} />
            <button onClick={crear} disabled={!nueva.trim()} className="btn btn-primary gap-1">
              <Plus size={16} /> Crear
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Aparece inmediatamente en el dashboard</p>
        </div>
      )}

      {/* Programar alerta */}
      {tab === 'programar' && (
        <div className="card mb-6">
          <div className="text-sm font-semibold mb-4">Programar alerta con fecha y hora</div>
          <div className="space-y-3">
            <div>
              <label className="label">Mensaje de la alerta</label>
              <input className="input" placeholder="Ej: Llamar a Juan para coordinar entrega..."
                value={nueva} onChange={e => setNueva(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Fecha</label>
                <input className="input" type="date" min={hoy} value={fechaProg} onChange={e => setFechaProg(e.target.value)} />
              </div>
              <div>
                <label className="label">Hora</label>
                <input className="input" type="time" value={horaProg} onChange={e => setHoraProg(e.target.value)} />
              </div>
            </div>
            {fechaProg && horaProg && nueva && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
                📅 La alerta aparecerá el <strong>{new Date(`${fechaProg}T${horaProg}`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong> a las <strong>{horaProg}hs</strong>
              </div>
            )}
            <button onClick={programar} disabled={!nueva.trim() || !fechaProg || !horaProg} className="btn btn-primary w-full justify-center">
              <Calendar size={16} /> Programar alerta
            </button>
          </div>
        </div>
      )}

      {/* Alertas activas */}
      {tab === 'activas' && (
        <>
          {activas.length === 0 && snoozed.length === 0 && !loading ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">✨</div>
              <div className="text-lg font-medium">Sin alertas pendientes</div>
              <div className="text-sm mt-1">Estás al día con todo</div>
            </div>
          ) : null}

          {activas.length > 0 && (
            <div className="mb-6 space-y-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🔔 Activas ahora ({activas.length})</div>
              {activas.map(a => (
                <AlertaCard key={a.id} alerta={a} onSnooze={snooze} onSnoozeDateTime={snoozeDateTime} onCompletar={completar} tipoColor={tipoColor} tipoText={tipoText} />
              ))}
            </div>
          )}

          {snoozed.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">⏰ Programadas / pospuestas ({snoozed.length})</div>
              <div className="space-y-2">
                {snoozed.map(a => {
                  const dt = new Date(a.recordar_en!)
                  const esHoy = dt.toDateString() === now.toDateString()
                  const label = esHoy
                    ? `Hoy a las ${dt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
                    : dt.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + dt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={a.id} className="card flex items-center gap-3">
                      <Calendar size={16} className="text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{a.mensaje}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                      </div>
                      <button onClick={() => completar(a.id)} className="btn btn-sm text-xs">✓ Listo</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function AlertaCard({ alerta: a, onSnooze, onSnoozeDateTime, onCompletar, tipoColor, tipoText }: {
  alerta: Alerta
  onSnooze: (id: string, min: number) => void
  onSnoozeDateTime: (id: string, fecha: string, hora: string) => void
  onCompletar: (id: string) => void
  tipoColor: Record<string, string>
  tipoText: Record<string, string>
}) {
  const [showCustom, setShowCustom] = useState(false)
  const [customFecha, setCustomFecha] = useState('')
  const [customHora, setCustomHora] = useState('')
  const hoy = new Date().toISOString().split('T')[0]

  return (
    <div className={`rounded-xl border p-4 ${tipoColor[a.tipo] || 'bg-gray-50 border-gray-200'}`}>
      <div className={`font-semibold text-sm mb-2 ${tipoText[a.tipo] || 'text-gray-800'}`}>{a.mensaje}</div>
      <div className="text-xs mb-3 opacity-60">
        {a.tipo === 'comprar' && '🛒 Compra pendiente'}
        {a.tipo === 'tracking_huerfano' && '📦 Tracking sin asignar'}
        {a.tipo === 'custom' && '📝 Recordatorio'}
        {a.tipo === 'cancelado_proveedor' && '⚠️ Cancelado por proveedor'}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className="text-xs opacity-60 self-center">Recordar en:</span>
        {[
          { l: '15min', m: 15 }, { l: '30min', m: 30 },
          { l: '1h', m: 60 }, { l: '3h', m: 180 }, { l: 'Mañana', m: 1440 },
        ].map(({ l, m }) => (
          <button key={m} onClick={() => onSnooze(a.id, m)}
            className="btn btn-sm bg-white/70 border-current text-xs py-0.5">
            <Clock size={10} /> {l}
          </button>
        ))}
        <button onClick={() => setShowCustom(p => !p)}
          className="btn btn-sm bg-white/70 border-current text-xs py-0.5">
          <Calendar size={10} /> Fecha/hora
        </button>
        <button onClick={() => onCompletar(a.id)}
          className="btn btn-sm bg-white border-green-400 text-green-700 text-xs py-0.5 ml-auto">
          <Check size={12} /> Listo
        </button>
      </div>

      {showCustom && (
        <div className="flex gap-2 mt-2 items-end">
          <div className="flex-1">
            <input type="date" min={hoy} className="input text-xs py-1" value={customFecha} onChange={e => setCustomFecha(e.target.value)} />
          </div>
          <div className="flex-1">
            <input type="time" className="input text-xs py-1" value={customHora} onChange={e => setCustomHora(e.target.value)} />
          </div>
          <button onClick={() => { onSnoozeDateTime(a.id, customFecha, customHora); setShowCustom(false) }}
            className="btn btn-sm btn-primary text-xs py-1">OK</button>
        </div>
      )}
    </div>
  )
}
