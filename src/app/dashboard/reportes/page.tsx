'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface ItemVenta {
  id: string
  codigo: string
  cliente_nombre: string
  fecha_venta: string
  ganancia: number
}

interface GananciasPorMes {
  mes: string
  total: number
  cantidad: number
}

interface GananciasPorCliente {
  cliente: string
  total: number
  cantidad: number
}

export default function ReportesPage() {
  const [items, setItems] = useState<ItemVenta[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroCliente, setFiltroCliente] = useState<string>('')
  const [filtroMes, setFiltroMes] = useState<string>('')
  const [filtroAnio, setFiltroAnio] = useState<string>(new Date().getFullYear().toString())
  const [clientes, setClientes] = useState<string[]>([])

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true)
        const { data } = await supabase
          .from('items')
          .select('id, codigo, cliente_nombre, fecha_venta, ganancia')
          .not('ganancia', 'is', null)
          .not('fecha_venta', 'is', null)
          .order('fecha_venta', { ascending: false })

        if (data) {
          setItems(data as ItemVenta[])

          // Extraer clientes únicos
         const clientesUnicos = Array.from(new Set(data.map(item => item.cliente_nombre).filter(Boolean))) as string[]
          setClientes(clientesUnicos.sort())
        }
      } catch (err) {
        console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [])

  // Aplicar filtros
  const itemsFiltrados = items.filter(item => {
    if (filtroCliente && item.cliente_nombre !== filtroCliente) return false
    if (filtroAnio && !item.fecha_venta?.startsWith(filtroAnio)) return false
    if (filtroMes && !item.fecha_venta?.startsWith(`${filtroAnio}-${filtroMes}`)) return false
    return true
  })

  // Calcular ganancias por mes
  const gananciasPorMes: { [key: string]: GananciasPorMes } = {}
  itemsFiltrados.forEach(item => {
    if (item.fecha_venta) {
      const mes = item.fecha_venta.substring(0, 7) // YYYY-MM
      if (!gananciasPorMes[mes]) {
        gananciasPorMes[mes] = { mes, total: 0, cantidad: 0 }
      }
      gananciasPorMes[mes].total += item.ganancia || 0
      gananciasPorMes[mes].cantidad += 1
    }
  })

  const datosGananciasMes = Object.values(gananciasPorMes).sort((a, b) => a.mes.localeCompare(b.mes))

  // Calcular ganancias por cliente
  const gananciasPorCliente: { [key: string]: GananciasPorCliente } = {}
  itemsFiltrados.forEach(item => {
    const cliente = item.cliente_nombre || 'Sin cliente'
    if (!gananciasPorCliente[cliente]) {
      gananciasPorCliente[cliente] = { cliente, total: 0, cantidad: 0 }
    }
    gananciasPorCliente[cliente].total += item.ganancia || 0
    gananciasPorCliente[cliente].cantidad += 1
  })

  const datosGananciasCliente = Object.values(gananciasPorCliente)
    .sort((a, b) => b.total - a.total)

  const totalGanancia = itemsFiltrados.reduce((sum, item) => sum + (item.ganancia || 0), 0)
  const promedioPorVenta = itemsFiltrados.length > 0 ? totalGanancia / itemsFiltrados.length : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-500 text-lg">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">📈 Análisis de Ganancias</h1>

        {/* FILTROS */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-bold mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-bold mb-2">Año</label>
              <input
                type="number"
                min="2020"
                max="2030"
                value={filtroAnio}
                onChange={e => setFiltroAnio(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Mes (opcional)</label>
              <select
                value={filtroMes}
                onChange={e => setFiltroMes(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Todos los meses</option>
                <option value="01">Enero</option>
                <option value="02">Febrero</option>
                <option value="03">Marzo</option>
                <option value="04">Abril</option>
                <option value="05">Mayo</option>
                <option value="06">Junio</option>
                <option value="07">Julio</option>
                <option value="08">Agosto</option>
                <option value="09">Septiembre</option>
                <option value="10">Octubre</option>
                <option value="11">Noviembre</option>
                <option value="12">Diciembre</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Cliente (opcional)</label>
              <select
                value={filtroCliente}
                onChange={e => setFiltroCliente(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Todos los clientes</option>
                {clientes.map(cliente => (
                  <option key={cliente} value={cliente}>
                    {cliente}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">&nbsp;</label>
              <button
                onClick={() => {
                  setFiltroAnio(new Date().getFullYear().toString())
                  setFiltroMes('')
                  setFiltroCliente('')
                }}
                className="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Resetear
              </button>
            </div>
          </div>
        </div>

        {/* RESUMEN */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-green-100 border-2 border-green-300 rounded-lg p-6">
            <p className="text-gray-700 text-sm font-bold mb-2">Total de Ganancias</p>
            <p className="text-4xl font-bold text-green-700">${totalGanancia.toFixed(2)}</p>
          </div>

          <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-6">
            <p className="text-gray-700 text-sm font-bold mb-2">Cantidad de Ventas</p>
            <p className="text-4xl font-bold text-blue-700">{itemsFiltrados.length}</p>
          </div>

          <div className="bg-purple-100 border-2 border-purple-300 rounded-lg p-6">
            <p className="text-gray-700 text-sm font-bold mb-2">Promedio por Venta</p>
            <p className="text-4xl font-bold text-purple-700">${promedioPorVenta.toFixed(2)}</p>
          </div>
        </div>

        {/* GRÁFICO POR MES */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6">📊 Ganancias por Mes</h2>

          {datosGananciasMes.length > 0 ? (
            <div className="overflow-x-auto">
              {/* Gráfico ASCII simple con líneas */}
              <div className="mb-6">
                {datosGananciasMes.length > 0 && (
                  <div className="space-y-4">
                    {(() => {
                      const maxGanancia = Math.max(...datosGananciasMes.map(d => d.total))
                      const scale = maxGanancia / 50 // Escala para 50 caracteres

                      return datosGananciasMes.map((dato, idx) => (
                        <div key={dato.mes}>
                          <div className="flex items-center gap-4">
                            <span className="font-bold w-20">{dato.mes}</span>
                            <div className="flex-1 bg-gray-200 rounded h-8 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-blue-400 to-blue-600 h-full flex items-center justify-end pr-3 text-white font-bold text-sm"
                                style={{ width: `${(dato.total / maxGanancia) * 100}%` }}
                              >
                                ${dato.total.toFixed(0)}
                              </div>
                            </div>
                            <span className="text-gray-600 text-sm w-12">({dato.cantidad})</span>
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                )}
              </div>

              {/* Tabla de datos */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-3 px-4 font-bold">Mes</th>
                    <th className="text-right py-3 px-4 font-bold">Ganancias</th>
                    <th className="text-right py-3 px-4 font-bold">Ventas</th>
                    <th className="text-right py-3 px-4 font-bold">Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {datosGananciasMes.map((dato, idx) => (
                    <tr key={dato.mes} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-3 px-4 font-semibold">{dato.mes}</td>
                      <td className="py-3 px-4 text-right font-bold text-green-600">${dato.total.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{dato.cantidad}</td>
                      <td className="py-3 px-4 text-right text-gray-600">${(dato.total / dato.cantidad).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">Sin datos para mostrar</p>
          )}
        </div>

        {/* GANANCIAS POR CLIENTE */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-6">👥 Ganancias por Cliente</h2>

          {datosGananciasCliente.length > 0 ? (
            <div className="overflow-x-auto">
              {/* Gráfico */}
              <div className="mb-6">
                {(() => {
                  const maxGanancia = Math.max(...datosGananciasCliente.map(d => d.total))

                  return datosGananciasCliente.map((dato, idx) => (
                    <div key={dato.cliente} className="mb-4">
                      <div className="flex items-center gap-4">
                        <span className="font-bold w-40 truncate text-sm">{dato.cliente}</span>
                        <div className="flex-1 bg-gray-200 rounded h-8 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-orange-400 to-orange-600 h-full flex items-center justify-end pr-3 text-white font-bold text-sm"
                            style={{ width: `${(dato.total / maxGanancia) * 100}%` }}
                          >
                            ${dato.total.toFixed(0)}
                          </div>
                        </div>
                        <span className="text-gray-600 text-sm w-12">({dato.cantidad})</span>
                      </div>
                    </div>
                  ))
                })()}
              </div>

              {/* Tabla de datos */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-3 px-4 font-bold">Cliente</th>
                    <th className="text-right py-3 px-4 font-bold">Ganancias</th>
                    <th className="text-right py-3 px-4 font-bold">Ventas</th>
                    <th className="text-right py-3 px-4 font-bold">Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {datosGananciasCliente.map((dato, idx) => (
                    <tr key={dato.cliente} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-3 px-4 font-semibold">{dato.cliente}</td>
                      <td className="py-3 px-4 text-right font-bold text-orange-600">${dato.total.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{dato.cantidad}</td>
                      <td className="py-3 px-4 text-right text-gray-600">${(dato.total / dato.cantidad).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">Sin datos para mostrar</p>
          )}
        </div>
      </div>
    </div>
  )
}
