-- =============================================
-- MOTOSDP - Schema completo
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- CLIENTES
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  direccion text,
  codigo_postal text,
  provincia text,
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PROVEEDORES
create table if not exists proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  pais text,
  contacto text,
  notas text,
  created_at timestamptz default now()
);

-- ITEMS (inventario completo)
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  pagina text,
  fecha_compra date,
  producto text not null,
  marca text,
  marca_code text,
  anio text,
  modelo text,
  subcodigo text,
  oem text,
  nro_orden text,
  tracking_compra text,
  link_tracking_compra text,
  eta date,
  link_producto text,
  importe numeric(10,2) default 0,
  peso numeric(10,3) default 0,
  largo numeric(10,2),
  ancho numeric(10,2),
  alto numeric(10,2),
  tipo_envio text default 'aereo',
  costo_envio numeric(10,2) default 0,
  taxes numeric(10,2) default 0,
  reembolsos numeric(10,2) default 0,
  costo_total numeric(10,2) default 0,
  precio_venta numeric(10,2),
  ganancia numeric(10,2),
  cliente_id uuid references clientes(id),
  cliente_nombre text,
  proveedor_id uuid references proveedores(id),
  ubicacion text default 'Proveedor',
  destino text,
  estado_pago text,
  plataforma text,
  link_publicacion text,
  tracking_venta text,
  empresa_envio text,
  fecha_despacho date,
  link_tracking_venta text,
  nro_venta text,
  fecha_venta date,
  cancelado_proveedor boolean default false,
  recibido boolean default false,
  fecha_recibido timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- COTIZACIONES
create table if not exists cotizaciones (
  id uuid primary key default gen_random_uuid(),
  nro text not null,
  fecha date,
  cliente_id uuid references clientes(id),
  cliente_nombre text,
  destino text,
  vin text,
  show_links boolean default true,
  precio_final numeric(10,2),
  estado text default 'borrador',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ITEMS DE COTIZACION
create table if not exists cotizacion_items (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid references cotizaciones(id) on delete cascade,
  descripcion text,
  link text,
  ubicacion_producto text,
  costo numeric(10,2) default 0,
  taxes_impo numeric(10,2) default 0,
  peso_estimado numeric(10,3) default 0,
  costo_envio numeric(10,2) default 0,
  taxes_11 numeric(10,2) default 0,
  subtotal numeric(10,2) default 0,
  orden integer default 0
);

-- PEDIDOS DE CLIENTES (nota de pedido)
create table if not exists pedidos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  descripcion text not null,
  item_id uuid references items(id),
  entregado boolean default false,
  fecha_pedido date default current_date,
  fecha_entrega timestamptz,
  notas text,
  created_at timestamptz default now()
);

-- ALERTAS Y RECORDATORIOS
create table if not exists alertas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null, -- 'comprar', 'tracking_huerfano', 'cancelado_proveedor', 'custom'
  mensaje text not null,
  cliente_id uuid references clientes(id),
  item_id uuid references items(id),
  tracking_huerfano text,
  activa boolean default true,
  recordar_en timestamptz,
  intervalo_minutos integer,
  completada boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TRACKINGS HUÉRFANOS (ingresados por Daniel sin match)
create table if not exists trackings_huerfanos (
  id uuid primary key default gen_random_uuid(),
  tracking text not null,
  ingresado_por text default 'daniel',
  asignado boolean default false,
  item_id uuid references items(id),
  created_at timestamptz default now()
);

-- COUNTERS (para numeración automática)
create table if not exists counters (
  key text primary key,
  value integer default 0
);

-- Insert default counters
insert into counters (key, value) values
  ('cot', 0), ('venta_AR', 0), ('venta_EB', 0), ('venta_US', 0), ('venta_INT', 0)
on conflict (key) do nothing;

-- CONFIG DEL SISTEMA
create table if not exists config (
  key text primary key,
  value text
);

insert into config (key, value) values
  ('wa_admin', '5491135903620'),
  ('nombre_negocio', 'Motos DP LLC'),
  ('slogan', 'Repuestos de motos')
on conflict (key) do nothing;

-- FUNCIÓN para actualizar updated_at automáticamente
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- TRIGGERS
create trigger items_updated_at before update on items
  for each row execute function update_updated_at();

create trigger clientes_updated_at before update on clientes
  for each row execute function update_updated_at();

create trigger cotizaciones_updated_at before update on cotizaciones
  for each row execute function update_updated_at();

create trigger alertas_updated_at before update on alertas
  for each row execute function update_updated_at();

-- INDEXES para búsquedas rápidas
create index if not exists items_oem_idx on items(oem);
create index if not exists items_tracking_idx on items(tracking_compra);
create index if not exists items_orden_idx on items(nro_orden);
create index if not exists items_codigo_idx on items(codigo);
create index if not exists items_cliente_idx on items(cliente_id);
create index if not exists alertas_activa_idx on alertas(activa, recordar_en);

-- RLS (Row Level Security) - desactivado para simplicidad inicial
-- Se puede activar después cuando tengas auth configurado
alter table items disable row level security;
alter table clientes disable row level security;
alter table cotizaciones disable row level security;
alter table cotizacion_items disable row level security;
alter table pedidos_cliente disable row level security;
alter table alertas disable row level security;
alter table trackings_huerfanos disable row level security;
alter table counters disable row level security;
alter table config disable row level security;
alter table proveedores disable row level security;
