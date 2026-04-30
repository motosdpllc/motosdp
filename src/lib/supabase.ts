import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types
export type Ubicacion = 
  | 'Proveedor' | 'En tránsito' | 'En tránsito a Daniel'
  | 'Daniel' | 'Pablo' | 'Blue Mail' | 'Tato'
  | 'Tránsito a Bs As' | 'En Mano' | 'Vendido' | 'Cancelado'

export type Destino = 
  | 'Argentina' | 'Stock EEUU' | 'Uso propio' 
  | 'Stock Argentina' | 'Stock Internacional'

export type EstadoPago = 'Saldado' | 'Debe' | 'Debemos'

export interface Item {
  id: string
  codigo?: string
  pagina?: string
  fecha_compra?: string
  producto: string
  marca?: string
  marca_code?: string
  anio?: string
  modelo?: string
  subcodigo?: string
  oem?: string
  nro_orden?: string
  tracking_compra?: string
  link_tracking_compra?: string
  eta?: string
  link_producto?: string
  importe?: number
  peso?: number
  largo?: number
  ancho?: number
  alto?: number
  tipo_envio?: string
  costo_envio?: number
  taxes?: number
  reembolsos?: number
  costo_total?: number
  precio_venta?: number
  ganancia?: number
  cliente_id?: string
  cliente_nombre?: string
  ubicacion?: Ubicacion
  destino?: Destino
  estado_pago?: EstadoPago
  plataforma?: string
  link_publicacion?: string
  tracking_venta?: string
  empresa_envio?: string
  fecha_despacho?: string
  link_tracking_venta?: string
  nro_venta?: string
  fecha_venta?: string
  cancelado_proveedor?: boolean
  recibido?: boolean
  fecha_recibido?: string
  created_at?: string
  updated_at?: string
}

export interface Cliente {
  id: string
  nombre: string
  telefono?: string
  direccion?: string
  codigo_postal?: string
  provincia?: string
  notas?: string
  created_at?: string
}

export interface Cotizacion {
  id: string
  nro: string
  fecha?: string
  cliente_id?: string
  cliente_nombre?: string
  destino?: string
  vin?: string
  show_links?: boolean
  precio_final?: number
  estado?: string
  items?: CotizacionItem[]
}

export interface CotizacionItem {
  id?: string
  cotizacion_id?: string
  descripcion?: string
  link?: string
  ubicacion_producto?: string
  costo?: number
  taxes_impo?: number
  peso_estimado?: number
  costo_envio?: number
  taxes_11?: number
  subtotal?: number
  orden?: number
}

export interface Alerta {
  id: string
  tipo: string
  mensaje: string
  cliente_id?: string
  item_id?: string
  tracking_huerfano?: string
  activa: boolean
  recordar_en?: string
  intervalo_minutos?: number
  completada: boolean
  created_at?: string
}

export interface PedidoCliente {
  id: string
  cliente_id?: string
  descripcion: string
  item_id?: string
  entregado: boolean
  fecha_pedido?: string
  fecha_entrega?: string
  notas?: string
}

// Helper functions
export async function getNextCounter(key: string): Promise<number> {
  const { data } = await supabase.rpc('increment_counter', { counter_key: key })
  return data || 1
}

export function fmt(n?: number | null): string {
  if (n === undefined || n === null) return '—'
  return '$' + Number(n).toFixed(2)
}

export function fmtDate(d?: string | null): string {
  if (!d) return '—'
  const p = d.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d
}

export function ubicColor(u?: string): string {
  if (!u) return 'bg-gray-100 text-gray-600'
  if (u.includes('ránsito')) return 'bg-amber-100 text-amber-700'
  if (u === 'En Mano') return 'bg-green-100 text-green-700'
  if (u === 'Vendido') return 'bg-gray-100 text-gray-500'
  if (u === 'Cancelado') return 'bg-red-100 text-red-700'
  if (['Daniel', 'Pablo', 'Blue Mail', 'Tato'].includes(u)) return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-600'
}
