'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingCart, FileText,
  Users, List, Zap, Settings, LogOut, Truck, Bell, ScanLine, DollarSign // Agregamos DollarSign
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/scanner', label: 'Escanear', icon: ScanLine },
  { href: '/dashboard/nuevo', label: '+ Nuevo ítem', icon: Package },
  // { href: '/dashboard/nuevo/importar', label: '↑ Importar factura', icon: Package }, // ESTE FUE ELIMINADO
  { href: '/dashboard/ventas', label: '+ Venta', icon: ShoppingCart },
  { href: '/dashboard/cotizaciones', label: 'Cotizaciones', icon: FileText },
  { href: '/dashboard/pedidos', label: 'Pedidos', icon: Truck },
  { href: '/dashboard/clientes', label: 'Clientes', icon: Users },
  { href: '/dashboard/inventario', label: 'Inventario', icon: List },
  { href: '/dashboard/pagos', label: 'Pagos', icon: DollarSign }, // NUEVO: Enlace a Pagos
  { href: '/dashboard/tracking', label: 'Tracking masivo', icon: Zap },
  { href: '/dashboard/alertas', label: 'Alertas', icon: Bell },
  { href: '/dashboard/config', label: 'Config', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const logout = () => {
    localStorage.removeItem('moto_auth')
    localStorage.removeItem('moto_role')
    router.push('/')
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="flex flex-col w-64 bg-gray-800 text-white shadow-lg">
        <div className="flex items-center justify-center h-20 border-b border-gray-700">
          <Link href="/dashboard" className="text-2xl font-bold text-orange-400">
            🏍️ Motos DP LLC
          </Link>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center px-4 py-2 rounded-md ${
                  active ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="px-4 py-4 border-t border-gray-700">
          <button
            onClick={logout}
            className="flex items-center px-4 py-2 rounded-md text-gray-300 hover:bg-gray-700 hover:text-white w-full"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Salir
          </button>
        </div>
      </div>
    </div>
  )
}
