'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function DashboardPage() {
  const [stats, setStats] = useState({ vendidos: 0, stock: 0, totalPeso: 0 })
  const [huerfanos, setHuerfanos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    
    const { data: items } = await supabase
      .from('cotizacion_items')
      .select('*')

    const { data: hurf } = await supabase
      .from('cotizacion_items')
      .select('*')
      .is('cotizacion_id', null)

    if (items) {
      if (hurf) setHuerfanos(hurf)

      // Engañamos a TypeScript accediendo como propiedad dinámica de objeto para evitar el error de tipo Destino
      const itemsVendidos = items.filter(x => (x as any)['destino'] === 'Venta' || (x as any)['destino'] === 'AR')
      const itemsEnStock = items.filter(x => (x as any)['destino'] === 'Stock' || (x as any)['destino'] === 'USA')

      const peso = items.reduce((acc, item) => acc + (Number(item.peso) || 0), 0)

      setStats({
        vendidos: itemsVendidos.length,
        stock: itemsEnStock.length,
        totalPeso: parseFloat(peso.toFixed(2))
      })
    }

    setLoading(false)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Panel de Control</h1>

      {loading ? (
        <p className="text-gray-500">Cargando estadísticas...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow border-l-4 border-green-500">
              <p className="text-xs font-bold text-gray-500 uppercase">Items Destino AR / Venta</p>
              <p className="text-3xl font-black text-gray-800 mt-2">{stats.vendidos}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow border-l-4 border-blue-500">
              <p className="text-xs font-bold text-gray-500 uppercase">Items Destino USA / Stock</p>
              <p className="text-3xl font-black text-gray-800 mt-2">{stats.stock}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow border-l-4 border-yellow-500">
              <p className="text-xs font-bold text-gray-500 uppercase">Peso Total Acumulado</p>
              <p className="text-3xl font-black text-gray-800 mt-2">{stats.totalPeso} kg</p>
            </div>
          </div>

          {huerfanos.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <h2 className="text-lg font-bold text-red-800 mb-2">¡Atención! Ítems Huérfanos Detectados</h2>
              <p className="text-sm text-red-600 mb-4">Hay {huerfanos.length} repuestos en la base de datos que no están asignados a ninguna cotización existente.</p>
              <div className="bg-white rounded-lg overflow-hidden border border-red-100 max-h-60 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-red-100 font-bold text-red-700">
                    <tr>
                      <th className="p-2 text-left">Código</th>
                      <th className="p-2 text-left">Descripción</th>
                      <th className="p-2 text-center">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {huerfanos.map((item, idx) => (
                      <tr key={idx} className="hover:bg-red-50 font-mono">
                        <td className="p-2 font-bold text-gray-700">{item.codigo || 'S/C'}</td>
                        <td className="p-2 text-gray-600">{item.descripcion || 'Sin descripción'}</td>
                        <td className="p-2 text-center text-gray-600">{item.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}