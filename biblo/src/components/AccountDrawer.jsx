import { useEffect, useState } from 'react'
import Drawer from './Drawer'
import AuthForm from './AuthForm'
import { formatPrice } from '../data/books'
import { addressLine, api, formatDate } from '../api'

// lo que ve el cliente: el estado del pago y, si ya se pagó, el del envío
const STATUS = {
  pendiente: 'Pago pendiente',
  rechazado: 'Pago rechazado',
  en_preparacion: 'En preparación',
  enviado: 'En camino',
  entregado: 'Entregado',
}

const status = (o) => (o.estado_pago === 'pagado' ? o.estado_envio : o.estado_pago)

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
          {user.rol === 'admin' && (
            <a className="drawer__checkout account__admin" href="#admin" onClick={onClose}>
              Abrir el panel de administración
            </a>
          )}

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
                    <span className={`order__status order__status--${status(o)}`}>{STATUS[status(o)]}</span>
                  </div>
                  <ul className="order__books">
                    {o.libros.map((l) => (
                      <li key={l.libro_id}>
                        {l.cantidad} × {l.titulo}
                      </li>
                    ))}
                  </ul>
                  <p className="order__ship">
                    {o.estado_pago === 'rechazado'
                      ? `${o.pago?.motivo ?? 'El pago no se completó.'} No se hizo ningún cargo. Dirección: `
                      : o.estado_pago === 'pendiente'
                        ? 'Esperando el pago. Dirección: '
                        : o.estado_envio === 'entregado'
                          ? 'Entregado en '
                          : `Llega hacia el ${formatDate(o.entrega_estimada)} a `}
                    {addressLine(o)}
                  </p>
                  {o.pago && (
                    <p className="order__card">
                      {o.pago.marca} ···· {o.pago.ultimos4}
                    </p>
                  )}
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
