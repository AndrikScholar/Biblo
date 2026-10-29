import { useState } from 'react'
import { api } from '../api'

const ESTADOS = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
  'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero',
  'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla',
  'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas',
  'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
]

// Una dirección de envío nueva. `onSaved` recibe la fila guardada.
export default function AddressForm({ user, onSaved, onCancel }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      onSaved(await api('direcciones.php', Object.fromEntries(new FormData(e.currentTarget))))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <p className="form__title">¿A dónde te los enviamos?</p>

      <label className="field">
        <span>Quién recibe</span>
        <input name="destinatario" defaultValue={user?.nombre} autoComplete="name" required maxLength={120} />
      </label>
      <label className="field">
        <span>Calle</span>
        <input name="calle" autoComplete="address-line1" required maxLength={120} />
      </label>
      <div className="form__row">
        <label className="field">
          <span>Nº exterior</span>
          <input name="num_exterior" required maxLength={10} />
        </label>
        <label className="field">
          <span>Nº interior (opcional)</span>
          <input name="num_interior" maxLength={10} />
        </label>
      </div>
      <label className="field">
        <span>Colonia</span>
        <input name="colonia" required maxLength={80} />
      </label>
      <div className="form__row">
        <label className="field">
          <span>Código postal</span>
          <input
            name="codigo_postal"
            inputMode="numeric"
            autoComplete="postal-code"
            required
            pattern="\d{5}"
            maxLength={5}
            title="5 dígitos"
          />
        </label>
        <label className="field">
          <span>Teléfono</span>
          <input name="telefono" type="tel" autoComplete="tel-national" required maxLength={15} placeholder="10 dígitos" />
        </label>
      </div>
      <div className="form__row">
        <label className="field">
          <span>Ciudad o municipio</span>
          <input name="ciudad" autoComplete="address-level2" required maxLength={80} />
        </label>
        <label className="field">
          <span>Estado</span>
          <select name="estado" required defaultValue="">
            <option value="" disabled>
              Elige…
            </option>
            {ESTADOS.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Referencias (opcional)</span>
        <input name="referencias" maxLength={200} placeholder="Entre calles, color de la fachada…" />
      </label>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="drawer__checkout" disabled={busy}>
        Guardar dirección
      </button>
      {onCancel && (
        <p className="form__switch">
          <button type="button" className="link-btn" onClick={onCancel}>
            Usar una dirección guardada
          </button>
        </p>
      )}
    </form>
  )
}
