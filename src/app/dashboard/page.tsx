'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface EstadoResumen {
  nombre: string
  icon: string
  color: string
  textColor: string
  count: number
}

export default function DashboardPage() {
  const [estados, setEstados] = useState<EstadoResumen[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true)
        // Ajustado para contar todos los que no están "vendidos" o "cancelados"
        const { data } = await supabase
          .from('items')
          .select('ubicacion')
          .not('ubicacion', 'eq', 'Vendido')
          .not('ubicacion', 'eq', 'Cancelado')


        const estadosConfig: { [key: string]: { icon: string; color: string; textColor: string } } = {
          'Proveedor': { icon: '🏭', color: 'bg-blue-500', textColor: 'text-blue-600' },
          'En tránsito': { icon: '🚚', color: 'bg-yellow-500', textColor: 'text-yellow-600' },
          'En tránsito a Daniel': { icon: '🛫', color: 'bg-orange-500', textColor: 'text-orange-600' },
          'Daniel': { icon: '👤', color: 'bg-purple-500', textColor: 'text-purple-600' },
          'Pablo': { icon: '👤', color: 'bg-pink-500', textColor: 'text-pink-600' },
          'Blue Mail': { icon: '📦', color: 'bg-indigo-500', textColor: 'text-indigo-600' },
          'Tato': { icon: '👤', color: 'bg-cyan-500', textColor: 'text-cyan-600' },
          'Tránsito a Bs As': { icon: '✈️', color: 'bg-green-500', textColor: 'text-green-600' },
          'En Mano': { icon: '✋', color: 'bg-emerald-500', textColor: 'text-emerald-600' },
          'Stock EEUU': { icon: '🇺🇸', color: 'bg-red-500', textColor: 'text-red-600' },
          'Stock España': { icon: '🇪🇸', color: 'bg-orange-500', textColor: 'text-orange-600' },
          'Stock Argentina': { icon: '🇦🇷', color: 'bg-lime-500', textColor: 'text-lime-600' },
        }

        const contador: { [key: string]: number } = {}
        if (data) {
          data.forEach(item => {
            const ubi = item.ubicacion || 'Sin ubicación'
            contador[ubi] = (contador[ubi] || 0) + 1
          })
        }

        const resultado: EstadoResumen[] = Object.entries(estadosConfig).map(([nombre, config]) => ({
          nombre,
          icon: config.icon,
          color: config.color,
          textColor: config.textColor,
          count: contador[nombre] || 0
        }))

        setEstados(resultado)
      } catch (err) {
        console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-500 text-lg">Cargando...</p>
      </div>
    )
  }

  const totalItemsEnStock = estados.reduce((sum, est) => sum + est.count, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-800 mb-2">📊 Dashboard Actual</h1>
          <p className="text-gray-600 text-lg">Estado de tu inventario al día de hoy: <span className="font-semibold">{new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
        </div>

        {/* TOTAL EN STOCK */}
        <div className="mb-8 p-8 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-lg">
          <p className="text-xl opacity-90">Total de productos en Stock / Tránsito</p>
          <p className="text-6xl font-bold">{totalItemsEnStock}</p>
        </div>

        {/* ESTADOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {estados.map(est => (
            <div
              key={est.nombre}
              className={`${est.color} text-white rounded-lg p-6 shadow-lg hover:shadow-xl transition transform hover:scale-105 cursor-pointer`}
            >
              <div className="text-4xl mb-2">{est.icon}</div>
              <p className="text-sm font-semibold opacity-90 mb-2">{est.nombre}</p>
              <p className="text-3xl font-bold">{est.count}</p>
            </div>
          ))}
        </div>

        {totalItemsEnStock === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-xl">No hay productos en stock o en tránsito.</p>
          </div>
        )}
      </div>
    </div>
  )
}
