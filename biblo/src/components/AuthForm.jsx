import { useState } from 'react'
import { api } from '../api'

// Entrar o crear una cuenta. `onDone` recibe el usuario ya con sesión.
// `allowSignup`: el panel de administración solo deja entrar.
export default function AuthForm({ onDone, intro, allowSignup = true }) {
  const [mode, setMode] = useState('entrar') // 'entrar' | 'registro'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const signup = mode === 'registro'

  async function submit(e) {
    e.preventDefault()
    const fields = Object.fromEntries(new FormData(e.currentTarget))
    setBusy(true)
    setError('')
    try {
      onDone(await api('cuenta.php', { accion: mode, ...fields }))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit} key={mode}>
      <p className="form__title">{signup ? 'Crea tu cuenta' : 'Entra en tu cuenta'}</p>
      {intro && <p className="form__intro">{intro}</p>}

      {signup && (
        <label className="field">
          <span>Nombre</span>
          <input name="nombre" autoComplete="name" required maxLength={80} />
        </label>
      )}
      <label className="field">
        <span>Correo electrónico</span>
        <input name="email" type="email" autoComplete="email" required maxLength={160} />
      </label>
      <label className="field">
        <span>Contraseña{signup && ' (mínimo 8 caracteres)'}</span>
        <input
          name="contrasena"
          type="password"
          autoComplete={signup ? 'new-password' : 'current-password'}
          required
          minLength={signup ? 8 : undefined}
        />
      </label>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="drawer__checkout" disabled={busy}>
        {signup ? 'Crear cuenta' : 'Entrar'}
      </button>
      {allowSignup && (
        <p className="form__switch">
          {signup ? '¿Ya tienes cuenta? ' : '¿Todavía no tienes cuenta? '}
          <button type="button" className="link-btn" onClick={() => setMode(signup ? 'entrar' : 'registro')}>
            {signup ? 'Entra' : 'Créala aquí'}
          </button>
        </p>
      )}
    </form>
  )
}
