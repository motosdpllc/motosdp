'use client'
import { useState } from 'react'
import { DollarSign, Percent, ShoppingBag, ArrowRight, ExternalLink } from 'lucide-react'

export default function DropshippingPage() {
  // Estado para la calculadora de márgenes
  const [costo, setCosto] = useState<number>(0)
  const [precioVenta, setPrecioVenta] = useState<number>(0)
  const [envio, setEnvio] = useState<number>(0)

  // Cálculos rápidos (Comisión eBay aprox 13.5% + $0.30)
  const comisionEbay = precioVenta > 0 ? (precioVenta * 0.135) + 0.30 : 0
  const gastoTotal = costo + envio + comisionEbay
  const ganancia = precioVenta > 0 ? precioVenta - gastoTotal : 0
  const margen = precioVenta > 0 ? (ganancia / precioVenta) * 100 : 0

  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Módulo Dropshipping</h1>
        <p className="text-gray-500 text-sm">Simulación de márgenes y control de órdenes internacionales (eBay / Distribuidores)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA 1: CALCULADORA DE MÁRGENES */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-1">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Percent size={16} className="text-blue-500" /> Calculadora de Margen (eBay)
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Costo Distribuidor (USD)</label>
              <input 
                type="number" 
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Ej: 120"
                value={costo || ''} 
                onChange={(e) => setCosto(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Envío Interno EEUU / Label (USD)</label>
              <input 
                type="number" 
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Ej: 12"
                value={envio || ''} 
                onChange={(e) => setEnvio(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Precio de Venta en eBay (USD)</label>
              <input 
                type="number" 
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Ej: 200"
                value={precioVenta || ''} 
                onChange={(e) => setPrecioVenta(Number(e.target.value))}
              />
            </div>
          </div>

          {/* RESULTADOS DE LA SIMULACIÓN */}
          <div className="mt-6 p-4 bg-gray-50 rounded-xl space-y-2 border border-gray-100">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Comisión eBay (Est. 13.5%):</span>
              <span>- USD {comisionEbay.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Costo Total Operación:</span>
              <span>USD {gastoTotal.toFixed(2)}</span>
            </div>
            <hr className="border-gray-200 my-2" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">Ganancia Neta:</span>
              <span className={`text-lg font-bold ${ganancia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                USD {ganancia.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Margen de Retorno:</span>
              <span>{margen.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* COLUMNA 2: CONTROL DE ÓRDENES EN CURSO */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <ShoppingBag size={16} className="text-orange-500" /> Órdenes Pendientes de Compra al Mayorista
            </h2>
            <p className="text-xs text-gray-400 mb-4">Artículos vendidos en eBay que debés procesar con tus distribuidores:</p>
            
            {/* Maqueta de órdenes para arrancar */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-amber-50 border border-amber-100 rounded-xl gap-2">
                <div>
                  <div className="text-sm font-semibold text-gray-800">Kit Transmisión Suzuki DR350 (JT Sprockets)</div>
                  <div className="text-xs text-gray-500">Vendido en eBay por USD 145.00 ➡️ Comprar en Turn14</div>
                </div>
                <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-medium self-start sm:self-center">Pendiente Pedido</span>
              </div>

              <div className="flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-gray-50 border border-gray-100 rounded-xl gap-2">
                <div>
                  <div className="text-sm font-semibold text-gray-700">Cilindro y Pistón Honda TRX400EX (Namura)</div>
                  <div className="text-xs text-gray-500">Orden #20943 ➡️ Comprado en Rocky Mountain (Tracking en viaje)</div>
                </div>
                <span className="text-xs bg-green-100 text-green-800 px-2.5 py-1 rounded-full font-medium self-start sm:self-center">Procesado</span>
              </div>
            </div>
          </div>

          {/* ACCESOS DIRECTOS A PROVEEDORES */}
          <div>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Enlaces de Consulta Rápida Stock</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a href="https://www.turn14.com" target="_blank" rel="noreferrer" className="flex justify-between items-center p-3 border border-gray-200 rounded-xl text-sm hover:border-gray-400 transition-all text-gray-700 font-medium bg-gray-50">
                <span>Portal Turn14 Wholesale</span>
                <ExternalLink size={14} className="text-gray-400" />
              </a>
              <a href="https://www.rockymountainatvmc.com" target="_blank" rel="noreferrer" className="flex justify-between items-center p-3 border border-gray-200 rounded-xl text-sm hover:border-gray-400 transition-all text-gray-700 font-medium bg-gray-50">
                <span>Rocky Mountain ATV/MC</span>
                <ExternalLink size={14} className="text-gray-400" />
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}