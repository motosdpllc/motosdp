'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Item {
  id: string
  codigo: string
  producto: string
  ubicacion: string
  cliente_nombre: string
  marca?: string
  precio_venta?: number
}

interface Ubicacion {
  nombre: string
  icon: string
  color: string
  count: number
  items: Item[]
}

export default function DashboardPage() {
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUbicacion, setSelectedUbicacion] = useState<string | null>(null)

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true)
        const hoy = new Date().toISOString().split('T')[0]

        const { data } = await supabase
          .from('items')
          .select('id, codigo, producto, ubicacion, cliente_nombre, marca, precio_venta')
          .gte('fecha_compra', hoy)
          .lte('fecha_compra', hoy + 'T23:59:59')

        if (data) {
          const grouped: { [key: string]: Item[] } = {}

          data.forEach(item => {
            const ubi = item.ubicacion || 'Sin ubicación'
            if (!grouped[ubi]) grouped[ubi] = []
            grouped[ubi].push(item)
          })

          const ubicacionesConfig: { [key: string]: { icon: string; color: string } } = {
            'Proveedor': { icon: '🏭', color: 'bg-blue-100 border-blue-300' },
            'En tránsito': { icon: '🚚', color: 'bg-yellow-100 border-yellow-300' },
            'En tránsito a Daniel': { icon: '🛫', color: 'bg-orange-100 border-orange-300' },
            'Daniel': { icon: '👤', color: 'bg-purple-100 border-purple-300' },
            'Pablo': { icon: '👤', color: 'bg-pink-100 border-pink-300' },
            'Blue Mail': { icon: '📦', color: 'bg-indigo-100 border-indigo-300' },
            'Tato': { icon: '👤', color: 'bg-cyan-100 border-cyan-300' },
            'Tránsito a Bs As': { icon: '✈️', color: 'bg-green-100 border-green-300' },
            'En Mano': { icon: '✋', color: 'bg-emerald-100 border-emerald-300' },
            'Vendido': { icon: '💰', color: 'bg-gray-100 border-gray-300' },
            'Cancelado': { icon: '❌', color: 'bg-red-100 border-red-300' },
            'Sin ubicación': { icon: '❓', color: 'bg-gray-100 border-gray-300' }
          }

          const resultado: Ubicacion[] = Object.entries(grouped).map(([nombre, items]) => {
            const config = ubicacionesConfig[nombre] || { icon: '📍', color: 'bg-gray-100 border-gray-300' }
            return {
              nombre,
              icon: config.icon,
              color: config.color,
              count: items.length,
              items
            }
          })

          setUbicaciones(resultado.sort((a, b) => b.count - a.count))
        }
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

  const totalItems = ubicaciones.reduce((sum, ubi) => sum + ubi.count, 0)
  const selectedUbi = ubicaciones.find(u => u.nombre === selectedUbicacion)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Dashboard</h1>
          <p className="text-gray-600">Hoy: <span className="font-semibold">{new Date().toLocaleDateString('es-AR')}</span></p>
        </div>

        <div className="mb-8 p-6 bg-white rounded-lg shadow">
          <div className="text-center">
            <p className="text-gray-600 text-lg">Total de productos hoy</p>
            <p className="text-5xl font-bold text-blue-600">{totalItems}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {ubicaciones.map(ubi => (
            <button
              key={ubi.nombre}
              onClick={() => setSelectedUbicacion(selectedUbicacion === ubi.nombre ? null : ubi.nombre)}
              className={`${ubi.color} border-2 rounded-lg p-6 shadow-md hover:shadow-lg transition cursor-pointer text-left ${selectedUbicacion === ubi.nombre ? 'ring-4 ring-offset-2' : ''}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">{ubi.icon}</h2>
                <span className="text-3xl font-bold text-gray-800">{ubi.count}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800">{ubi.nombre}</h3>
              <p className="text-sm text-gray-600 mt-2">Clickeá para ver detalles</p>
            </button>
          ))}
        </div>

        {selectedUbi && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold">
                {selectedUbi.icon} {selectedUbi.nombre} <span className="text-2xl text-gray-600">({selectedUbi.count})</span>
              </h2>
              <button
                onClick={() => setSelectedUbicacion(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-3 px-4 font-bold">Código</th>
                    <th className="text-left py-3 px-4 font-bold">Producto</th>
                    <th className="text-left py-3 px-4 font-bold">Marca</th>
                    <th className="text-left py-3 px-4 font-bold">Cliente</th>
                    <th className="text-right py-3 px-4 font-bold">Precio Venta</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUbi.items.map((item, idx) => (
                    <tr key={item.id} className={`border-b ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-yellow-50`}>
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{item.codigo}</td>
                      <td className="py-3 px-4 text-gray-800">{item.producto}</td>
                      <td className="py-3 px-4 text-gray-600">{item.marca || '—'}</td>
                      <td className="py-3 px-4 text-gray-600">{item.cliente_nombre || '—'}</td>
                      <td className="py-3 px-4 text-right font-bold text-green-600">${item.precio_venta?.toFixed(2) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {totalItems === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-xl">No hay productos hoy</p>
          </div>
        )}
      </div>
    </div>
  )
}
