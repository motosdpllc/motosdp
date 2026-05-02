'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingCart, FileText,
  Users, List, Zap, Settings, LogOut, Truck, Bell,
  ScanLine, TrendingUp, Wrench, Upload
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/scanner', label: 'Escanear recepción', icon: ScanLine },
  { divider: true, label: 'COMPRAS' },
  { href: '/dashboard/nuevo', label: '+ Nuevo ítem', icon: Package },
  { href: '/dashboard/importar', label: '↑ Importar masivo', icon: Upload },
  { divider: true, label: 'VENTAS' },
  { href: '/dashboard/ventas', label: '+ Nueva venta', icon: ShoppingCart },
  { href: '/dashboard/cotizaciones', label: 'Cotizaciones', icon: FileText },
  { divider: true, label: 'GESTIÓN' },
  { href: '/dashboard/pedidos', label: 'Pedidos clientes', icon: Truck },
  { href: '/dashboard/despiece', label: 'Despiece moto', icon: Wrench },
  { href: '/dashboard/clientes', label: 'Clientes', icon: Users },
  { href: '/dashboard/inventario', label: 'Inventario', icon: List },
  { href: '/dashboard/reportes', label: 'Reportes', icon: TrendingUp },
  { divider: true, label: 'HERRAMIENTAS' },
  { href: '/dashboard/tracking', label: 'Tracking masivo', icon: Zap },
  { href: '/dashboard/alertas', label: 'Alertas', icon: Bell },
  { href: '/dashboard/config', label: 'Configuración', icon: Settings },
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
    <aside className="w-56 min-h-screen bg-gray-900 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏍️</span>
          <div>
            <div className="text-white font-semibold text-sm">Motos DP LLC</div>
            <div className="text-gray-400 text-xs">Sistema de gestión</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto">
        {navItems.map((item, i) => {
          if ('divider' in item && item.divider) {
            return <div key={i} className="text-gray-600 text-xs font-semibold uppercase tracking-widest px-3 pt-4 pb-1">{item.label}</div>
          }
          const { href, label, icon: Icon } = item as any
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all mb-0.5 ${
                active ? 'bg-white text-gray-900 font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}>
              <Icon size={15} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-gray-800">
        <button onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 text-sm w-full transition-all">
          <LogOut size={15} />
          Salir
        </button>
      </div>
    </aside>
  )
}
