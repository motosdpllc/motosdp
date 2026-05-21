import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Sistema - Motos DP LLC',
  description: 'Gestión de repuestos de motos',
icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        {children}
      </body>
    </html>
  )
}
