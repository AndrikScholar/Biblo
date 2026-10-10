import { useEffect, useRef, useState } from 'react'
import BookCover from './BookCover'
import books, { formatPrice } from '../data/books'
import { CloseIcon, MinusIcon, PlusIcon } from './Icons'

export default function CartDrawer({ items, onChange, onClose }) {
  const [ordered, setOrdered] = useState(false)
  const closeRef = useRef(null)
  const lines = items
    .map((item) => ({ ...item, book: books.find((b) => b.id === item.id) }))
    .filter((line) => line.book)
  const total = lines.reduce((sum, l) => sum + l.book.price * l.qty, 0)

  useEffect(() => {
    const previous = document.activeElement
    closeRef.current?.focus()
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previous?.focus?.()
    }
  }, [onClose])

  function checkout() {
    setOrdered(true)
    onChange([])
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer__head">
          <h2 id="drawer-title">Tu carrito</h2>
          <button type="button" className="icon-btn" onClick={onClose} ref={closeRef} aria-label="Cerrar carrito">
            <CloseIcon width="20" height="20" />
          </button>
        </div>

        {ordered ? (
          <div className="drawer__empty">
            <p className="drawer__empty-title">Pedido registrado.</p>
            <p>Tus volúmenes viajan hacia ti. (Es una demostración: Biblo no procesa pagos reales).</p>
          </div>
        ) : lines.length === 0 ? (
          <div className="drawer__empty">
            <p className="drawer__empty-title">El carrito está vacío.</p>
            <p>Saca un libro del estante y pulsa «Añadir» para llevártelo.</p>
          </div>
        ) : (
          <>
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
                        onClick={() => onChange(items.map((i) => (i.id === book.id ? { ...i, qty: i.qty + 1 } : i)))}
                      >
                        <PlusIcon width="14" height="14" />
                      </button>
                    </div>
                  </div>
                  <span className="line__price">{formatPrice(book.price * qty)}</span>
                </li>
              ))}
            </ul>

            <div className="drawer__foot">
              <div className="drawer__total">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
              <button type="button" className="drawer__checkout" onClick={checkout}>
                Finalizar compra
              </button>
              <p className="drawer__note">Tienda de demostración: no se realizan cobros.</p>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
