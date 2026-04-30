'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const adminPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123'
    const danielPass = process.env.NEXT_PUBLIC_DANIEL_PASSWORD || 'daniel'

    if (password === adminPass) {
      localStorage.setItem('moto_role', 'admin')
      localStorage.setItem('moto_auth', 'true')
      router.push('/dashboard')
    } else if (password === danielPass) {
      localStorage.setItem('moto_role', 'daniel')
      localStorage.setItem('moto_auth', 'true')
      router.push('/daniel')
    } else {
      setError('Contraseña incorrecta')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏍️</div>
          <h1 className="text-2xl font-bold text-white">Motos DP LLC</h1>
          <p className="text-gray-400 mt-1">Sistema de gestión</p>
        </div>
        <form onSubmit={handleLogin} className="bg-white rounded-2xl p-6 shadow-xl">
          <div className="mb-4">
            <label className="label">Contraseña</label>
            <input
              type="password"
              className="input"
              placeholder="Ingresá tu contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="btn btn-primary w-full justify-center"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <p className="text-center text-gray-500 text-xs mt-4">
          Motos DP LLC © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
