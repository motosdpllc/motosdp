'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Bypass total: te loguea directo como admin sin importar qué pongas
    localStorage.setItem('moto_role', 'admin')
    localStorage.setItem('moto_auth', 'true')
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏍️</div>
          <h1 className="text-2xl font-bold text-white">Motes DP LLC</h1>
          <p className="text-gray-400 mt-1">Sistema de gestión (Modo Local)</p>
        </div>
        <form onSubmit={handleLogin} className="bg-white rounded-2xl p-6 shadow-xl">
          <div className="mb-4">
            <label className="label">Contraseña (Escribí lo que sea o dale Ingresar)</label>
            <input
              type="password"
              className="input"
              placeholder="Hacé clic en Ingresar"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full justify-center"
          >
            {loading ? 'Ingresando...' : 'Ingresar Directo'}
          </button>
        </form>
        <p className="text-center text-gray-500 text-xs mt-4">
          Motos DP LLC © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}