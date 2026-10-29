import { useState } from 'react'
import BookCover from './BookCover'
import Drawer from './Drawer'
import AuthForm from './AuthForm'
import AddressForm from './AddressForm'
import books, { formatPrice } from '../data/books'
import { addressLine, api, formatDate } from '../api'
import { MinusIcon, PlusIcon } from './Icons'

// Pasos: 'cart' → 'auth' (si no hay sesión) → 'address' → 'done'
export default function CartDrawer({ items, onChange, onClose, user, onUser, onOrdered }) {
  const [step, setStep] = useState('cart')
  const [addresses, setAddresses] = useState(null) // null mientras cargan
  const [addressId, setAddressId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const lines = items
    .map((item) => ({ ...item, book: books.find((b) => b.id === item.id) }))
    .filter((line) => line.book)
  const total = lines.reduce((sum, l) => sum + l.book.price * l.qty, 0)
  const overStock = lines.some((l) => l.qty > l.book.stock)

  async function goToAddress() {
    setStep('address')
    setError('')
    try {
      const list = await api('direcciones.php')
      setAddresses(list)
      setAddressId(list[0]?.id ?? null)
      setAdding(list.length === 0)
    } catch (err) {
      setError(err.message)
    }
  }

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      const result = await api('pedidos.php', {
        direccion_id: addressId,
        libros: lines.map((l) => ({ id: l.book.id, cantidad: l.qty })),
      })
      setOrder({ ...result, address: addresses.find((a) => a.id === addressId) })
      setStep('done')
      onOrdered()
    } catch (err) {
      setError(err.message)
      // el stock pudo cambiar mientras tanto: se refresca para que el carrito lo muestre
      onOrdered({ keepCart: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer id="drawer-title" title="Tu carrito" closeLabel="Cerrar carrito" onClose={onClose}>
      {step === 'done' ? (
        <div className="drawer__empty">
          <p className="drawer__empty-title">Pedido nº {order.id} registrado.</p>
          <p>
            Tus volúmenes viajan hacia <strong>{addressLine(order.address)}</strong>. Llegarán hacia el{' '}
            {formatDate(order.entrega_estimada)}.
          </p>
          <p className="drawer__aside">Puedes seguir el envío en «Tu cuenta». (Es una demostración: Biblo no procesa pagos reales).</p>
        </div>
      ) : step === 'auth' ? (
        <div className="drawer__body">
          <AuthForm
            intro="Para enviarte los libros necesitamos saber quién eres."
            onDone={(u) => {
              onUser(u)
              goToAddress()
            }}
          />
          <BackToCart onClick={() => setStep('cart')} />
        </div>
      ) : step === 'address' ? (
        <div className="drawer__body">
          {addresses === null && !error && <p className="drawer__aside">Buscando tus direcciones…</p>}
          {addresses && adding && (
            <AddressForm
              user={user}
              onSaved={(a) => {
                setAddresses([a, ...addresses])
                setAddressId(a.id)
                setAdding(false)
              }}
              onCancel={addresses.length ? () => setAdding(false) : null}
            />
          )}
          {addresses && !adding && (
            <fieldset className="addresses">
              <legend className="form__title">Enviar a</legend>
              {addresses.map((a) => (
                <label key={a.id} className="address">
                  <input
                    type="radio"
                    name="direccion"
                    checked={addressId === a.id}
                    onChange={() => setAddressId(a.id)}
                  />
                  <span>
                    <strong>{a.destinatario}</strong>
                    {addressLine(a)}
                    <small>Tel. {a.telefono}</small>
                  </span>
                </label>
              ))}
              <button type="button" className="link-btn" onClick={() => setAdding(true)}>
                + Otra dirección
              </button>
            </fieldset>
          )}
          {error && (
            <p className="form__error" role="alert">
              {error}
            </p>
          )}
          <BackToCart onClick={() => setStep('cart')} />
        </div>
      ) : lines.length === 0 ? (
        <div className="drawer__empty">
          <p className="drawer__empty-title">El carrito está vacío.</p>
          <p>Saca un libro del estante y pulsa «Añadir» para llevártelo.</p>
        </div>
      ) : (
        <ul className="drawer__list">
          {lines.map(({ book, qty }) => (
            <li key={book.id} className="line">
              <BookCover book={book} className="line__cover" />
              <div className="line__info">
                <span className="line__title">{book.title}</span>
                <span className="line__sig">{book.signature}</span>
                <div className="qty">
                  <button
                    type="button"
                    className="icon-btn icon-btn--small"
                    aria-label={`Quitar un ejemplar de ${book.title}`}
                    onClick={() =>
                      onChange(
                        items
                          .map((i) => (i.id === book.id ? { ...i, qty: i.qty - 1 } : i))
                          .filter((i) => i.qty > 0)
                      )
                    }
                  >
                    <MinusIcon width="14" height="14" />
                  </button>
                  <span className="qty__n" aria-label={`${qty} ejemplares`}>{qty}</span>
                  <button
                    type="button"
                    className="icon-btn icon-btn--small"
                    aria-label={`Añadir un ejemplar de ${book.title}`}
                    disabled={qty >= book.stock}
                    onClick={() => onChange(items.map((i) => (i.id === book.id ? { ...i, qty: i.qty + 1 } : i)))}
                  >
                    <PlusIcon width="14" height="14" />
                  </button>
                </div>
                {qty > book.stock && (
                  <span className="line__warn">
                    {book.stock === 0
                      ? 'Se agotó: quítalo para continuar'
                      : `Solo ${book.stock === 1 ? 'queda 1' : `quedan ${book.stock}`}`}
                  </span>
                )}
              </div>
              <span className="line__price">{formatPrice(book.price * qty)}</span>
            </li>
          ))}
        </ul>
      )}

      {(step === 'cart' && lines.length > 0) || (step === 'address' && addresses && !adding) ? (
        <div className="drawer__foot">
          <div className="drawer__total">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
          {step === 'cart' ? (
            <button
              type="button"
              className="drawer__checkout"
              disabled={overStock}
              onClick={() => (user ? goToAddress() : setStep('auth'))}
            >
              Finalizar compra
            </button>
          ) : (
            <button type="button" className="drawer__checkout" disabled={busy || !addressId} onClick={confirm}>
              Confirmar pedido
            </button>
          )}
          <p className="drawer__note">Tienda de demostración: no se realizan cobros.</p>
        </div>
      ) : null}
    </Drawer>
  )
}

function BackToCart({ onClick }) {
  return (
    <p className="form__switch">
      <button type="button" className="link-btn" onClick={onClick}>
        ← Volver al carrito
      </button>
    </p>
  )
}
