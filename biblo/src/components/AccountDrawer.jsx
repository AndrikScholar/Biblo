import { useEffect, useState } from 'react'
import Drawer from './Drawer'
import AuthForm from './AuthForm'
import { formatPrice } from '../data/books'
import { addressLine, api, formatDate } from '../api'

const STATUS = { preparando: 'Preparando', enviado: 'En camino', entregado: 'Entregado' }

export default function AccountDrawer({ user, onUser, onClose }) {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    api('pedidos.php').then(setOrders, (err) => setError(err.message))
  }, [user])

  async function logout() {
    await api('cuenta.php', { accion: 'salir' }).catch(() => {})
    onUser(null)
    setOrders(null)
  }

  return (
    <Drawer id="account-title" title="Tu cuenta" closeLabel="Cerrar tu cuenta" onClose={onClose}>
      {!user ? (
        <div className="drawer__body">
          <AuthForm onDone={onUser} />
        </div>
      ) : (
        <div className="drawer__body">
          <p className="form__title">Hola, {user.nombre}</p>
          <p className="drawer__aside">{user.email}</p>

          <h3 className="account__heading">Mis pedidos</h3>
          {error && (
            <p className="form__error" role="alert">
              {error}
            </p>
          )}
          {orders === null && !error && <p className="drawer__aside">Buscando tus pedidos…</p>}
          {orders?.length === 0 && <p className="drawer__aside">Todavía no has pedido ningún volumen.</p>}
          {orders?.length > 0 && (
            <ul className="orders">
              {orders.map((o) => (
                <li key={o.id} className="order">
                  <div className="order__head">
                    <span>
                      Pedido nº {o.id} · {formatDate(o.creado_en)}
                    </span>
                    <span className={`order__status order__status--${o.estado}`}>{STATUS[o.estado]}</span>
                  </div>
                  <ul className="order__books">
                    {o.libros.map((l) => (
                      <li key={l.libro_id}>
                        {l.cantidad} × {l.titulo}
                      </li>
                    ))}
                  </ul>
                  <p className="order__ship">
                    {o.estado === 'entregado' ? 'Entregado en ' : `Llega hacia el ${formatDate(o.entrega_estimada)} a `}
                    {addressLine({ ...o, estado: o.estado_dir })}
                  </p>
                  <p className="order__total">{formatPrice(o.total)}</p>
                </li>
              ))}
            </ul>
          )}

          <p className="form__switch">
            <button type="button" className="link-btn" onClick={logout}>
              Cerrar sesión
            </button>
          </p>
        </div>
      )}
    </Drawer>
  )
}
