import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types
export type Ubicacion =
  | 'Proveedor' | 'En tránsito' | 'En tránsito a Daniel'
  | 'Daniel' | 'Pablo' | 'Blue Mail' | 'Tato'
  | 'Tránsito a Bs As' | 'En Mano' | 'Stock EEUU' | 'Stock España' | 'Stock Argentina' | 'Entregado';

export type Destino =
  | 'Stock EEUU' | 'Stock España' | 'Stock Argentina' | 'Venta Argentina' | 'Venta Internacional' | 'Uso Propio' | 'Stock Internacional' | 'Vendido';

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
  proveedor_id?: string
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
  pub_ebay?: boolean
  pub_mercadolibre?: boolean
  pub_amazon?: boolean
  pub_wallapop?: boolean
  pub_facebook?: boolean
  pub_web_propia?: boolean
  pendiente_compra?: boolean // Nueva columna
  cantidad?: number // Nueva columna
  fecha_entregado?: string // Nueva columna
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
  fecha_envio_programado?: string
  hora_programada?: string
  enviar_automatico?: boolean
  mensaje_whatsapp?: string
  mostrar_links?: boolean
  mostrar_precios_individuales?: boolean
}

export interface CotizacionItem {
  id?: string
  cotizacion_id?: string
  cantidad: number
  codigo: string
  descripcion: string
  peso: number
  basoli: number
  partzilla: number
  otra: number
  precio_venta: number
  proveedor_elegido: 'basoli' | 'partzilla' | 'otra' | null
  proveedor_otro_nombre: string
  proveedor_otro_link: string
  estado?: string // Agregado el estado aquí
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
  cotizacion_item_id?: string // Nuevo campo
}

export interface PagoStripe {
  id: string
  cliente_id?: string
  nro_venta?: string
  monto: number
  fecha_pago: string
  descripcion?: string
  stripe_id?: string
  status: string
  created_at?: string
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
