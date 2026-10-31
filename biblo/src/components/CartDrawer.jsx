import { useState } from 'react'
import BookCover from './BookCover'
import Drawer from './Drawer'
import AuthForm from './AuthForm'
import AddressForm from './AddressForm'
import books, { formatPrice } from '../data/books'
import { addressLine, api, formatDate } from '../api'
import { MinusIcon, PlusIcon } from './Icons'

// número de tarjeta en grupos de 4 y vencimiento como MM/AA, mientras se escribe
const groupCard = (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ')
}
const formatExpiry = (e) => {
  const d = e.target.value.replace(/\D/g, '').slice(0, 4)
  e.target.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

// Pasos: 'cart' → 'auth' (si no hay sesión) → 'address' → 'pay' → 'done'
export default function CartDrawer({ items, onChange, onClose, user, onUser, onOrdered }) {
  const [step, setStep] = useState('cart')
  const [addresses, setAddresses] = useState(null) // null mientras cargan
  const [addressId, setAddressId] = useState(null)
  const [adding, setAdding] = useState(false)
  // pedido ya creado y aún 'pendiente': si el pago falla por un error del
  // formulario se reintenta sobre el mismo; si el banco lo rechaza, el
  // siguiente intento crea uno nuevo
  const [pendingId, setPendingId] = useState(null)
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

  function goTo(next) {
    setStep(next)
    setError('')
    // volver atrás puede cambiar el carrito o la dirección: el pedido pendiente ya no vale
    if (next !== 'pay') setPendingId(null)
  }

  async function pay(e) {
    e.preventDefault()
    const card = Object.fromEntries(new FormData(e.currentTarget))
    setBusy(true)
    setError('')
    try {
      let id = pendingId
      if (!id) {
        const created = await api('pedidos.php', {
          direccion_id: addressId,
          libros: lines.map((l) => ({ id: l.book.id, cantidad: l.qty })),
        })
        id = created.id
        setPendingId(id)
      }
      const result = await api('pagos.php', { pedido_id: id, ...card })
      if (result.resultado === 'rechazado') {
        setPendingId(null)
        setError(
          `Pago rechazado: ${result.motivo} El pedido nº ${id} queda como rechazado y no se te cobró nada. Puedes intentarlo con otra tarjeta.`
        )
        // pudo rechazarse por falta de stock: se refresca para que el carrito lo muestre
        onOrdered({ keepCart: true })
        return
      }
      setOrder({ id, entrega_estimada: result.entrega_estimada, address: addresses.find((a) => a.id === addressId) })
      setStep('done')
      onOrdered()
    } catch (err) {
      setError(err.message)
      onOrdered({ keepCart: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer id="drawer-title" title="Tu carrito" closeLabel="Cerrar carrito" onClose={onClose}>
      {step === 'done' ? (
        <div className="drawer__empty">
          <p className="drawer__empty-title">Pago aprobado. Pedido nº {order.id}.</p>
          <p>
            Tus volúmenes viajan hacia <strong>{addressLine(order.address)}</strong>. Llegarán hacia el{' '}
            {formatDate(order.entrega_estimada)}.
          </p>
          <p className="drawer__aside">Puedes seguir el envío en «Tu cuenta». (Es una demostración: Biblo no procesa pagos reales).</p>
        </div>
      ) : step === 'pay' ? (
        <div className="drawer__body">
          <form className="form" id="pay-form" onSubmit={pay}>
            <p className="form__title">Pago con tarjeta</p>
            <p className="sandbox">
              <strong>Modo de pruebas.</strong> No se hace ningún cargo y la tarjeta no se guarda. Usa{' '}
              <code>4242 4242 4242 4242</code> para un pago aprobado o <code>4000 0000 0000 0002</code> para uno
              rechazado, con cualquier fecha futura y cualquier CVV. No escribas una tarjeta real.
            </p>
            <label className="field">
              <span>Nombre en la tarjeta</span>
              <input name="titular" autoComplete="cc-name" defaultValue={user?.nombre} required maxLength={80} />
            </label>
            <label className="field">
              <span>Número de tarjeta</span>
              <input
                name="numero"
                inputMode="numeric"
                autoComplete="cc-number"
                required
                maxLength={23}
                placeholder="0000 0000 0000 0000"
                onInput={groupCard}
              />
            </label>
            <div className="form__row">
              <label className="field">
                <span>Vencimiento</span>
                <input
                  name="vencimiento"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  required
                  maxLength={5}
                  placeholder="MM/AA"
                  onInput={formatExpiry}
                />
              </label>
              <label className="field">
                <span>CVV</span>
                <input
                  name="cvv"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  required
                  pattern="\d{3,4}"
                  maxLength={4}
                  title="3 o 4 dígitos"
                />
              </label>
            </div>
            {error && (
              <p className="form__error" role="alert">
                {error}
              </p>
            )}
          </form>
          <p className="drawer__aside pay__ship">
            Enviar a: {addressLine(addresses.find((a) => a.id === addressId))}
          </p>
          <p className="form__switch">
            <button type="button" className="link-btn" onClick={() => goTo('address')}>
              ← Cambiar la dirección
            </button>
          </p>
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
          <BackToCart onClick={() => goTo('cart')} />
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
          <BackToCart onClick={() => goTo('cart')} />
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
                  <button
                    type="button"
                    className="link-btn line__remove"
                    aria-label={`Quitar ${book.title} del carrito`}
                    onClick={() => onChange(items.filter((i) => i.id !== book.id))}
                  >
                    Quitar
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

      {(step === 'cart' && lines.length > 0) || (step === 'address' && addresses && !adding) || step === 'pay' ? (
        <div className="drawer__foot">
          <div className="drawer__total">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
          {/* cada paso con su propio botón (key): si React reutilizara el mismo,
              el clic de «Continuar al pago» acabaría enviando el formulario de pago */}
          {step === 'cart' ? (
            <button
              key="checkout"
              type="button"
              className="drawer__checkout"
              disabled={overStock}
              onClick={() => (user ? goToAddress() : goTo('auth'))}
            >
              Finalizar compra
            </button>
          ) : step === 'address' ? (
            <button
              key="to-pay"
              type="button"
              className="drawer__checkout"
              disabled={!addressId}
              onClick={() => goTo('pay')}
            >
              Continuar al pago
            </button>
          ) : (
            <button key="pay" type="submit" form="pay-form" className="drawer__checkout" disabled={busy}>
              {busy ? 'Procesando el pago…' : `Pagar ${formatPrice(total)}`}
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
