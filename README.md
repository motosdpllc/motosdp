# 🏍️ Motos DP LLC — Sistema de Gestión

Sistema completo de gestión de repuestos de motos con Next.js + Supabase.

## Setup paso a paso

### 1. Supabase — crear las tablas

1. Andá a [supabase.com](https://supabase.com) → tu proyecto → **SQL Editor**
2. Copiá el contenido de `supabase/schema.sql` y ejecutalo
3. Copiá el contenido de `supabase/functions.sql` y ejecutalo también

### 2. Subir el código a GitHub

1. Andá a [github.com](https://github.com) → **New repository**
2. Nombre: `motosdp` → Create repository
3. Seguí las instrucciones que te da GitHub para subir archivos

**O si querés hacerlo fácil:** en GitHub, creá el repo y arrastrá todos los archivos de esta carpeta.

### 3. Variables de entorno

Creá un archivo `.env.local` con:
```
NEXT_PUBLIC_SUPABASE_URL=https://zwxpotfiujscswcnbxmu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_ADMIN_PASSWORD=tu_password_segura
NEXT_PUBLIC_DANIEL_PASSWORD=daniel
```

### 4. Deploy en Vercel

1. Andá a [vercel.com](https://vercel.com) → **Add New Project**
2. Importá el repositorio de GitHub
3. En **Environment Variables** agregá las 4 variables del paso 3
4. Click **Deploy** → en 2 minutos tenés la URL

### 5. Listo 🎉

Tu sistema va a estar en `https://motosdp.vercel.app` (o similar)

---

## Accesos

- **Admin (vos):** abrís la URL y ponés tu contraseña
- **Daniel:** abrís la URL y ponés `daniel` (o lo que hayas configurado)

## Features

- ✅ Inventario completo con código auto-generado
- ✅ Escaneo de código de barras (cámara + lector USB)
- ✅ Compras, ventas, cotizaciones con PDF
- ✅ Pedidos por cliente — sabés qué falta entregar
- ✅ Alertas y recordatorios (15min / 30min / 1h / mañana)
- ✅ Tracking masivo
- ✅ Vista Daniel — solo ingresa trackings
- ✅ Alerta por WhatsApp cuando Daniel ingresa un tracking sin match
- ✅ Configuración desde el sistema

## Estructura de carpetas

```
src/
  app/
    page.tsx              ← Login
    dashboard/
      page.tsx            ← Dashboard principal
      scanner/page.tsx    ← Escaneo de códigos
      nuevo/page.tsx      ← Nuevo ítem / editar
      ventas/page.tsx     ← Nueva venta
      cotizaciones/       ← Cotizaciones con PDF
      pedidos/page.tsx    ← Pedidos por cliente
      clientes/page.tsx   ← Base de clientes
      inventario/page.tsx ← Tabla inventario completa
      tracking/page.tsx   ← Carga masiva tracking
      alertas/page.tsx    ← Alertas y recordatorios
      config/page.tsx     ← Configuración + huérfanos
    daniel/
      page.tsx            ← Vista simplificada Daniel
  components/
    Sidebar.tsx           ← Navegación
  lib/
    supabase.ts           ← Cliente + tipos
supabase/
  schema.sql              ← Crear tablas
  functions.sql           ← Funciones SQL
```
