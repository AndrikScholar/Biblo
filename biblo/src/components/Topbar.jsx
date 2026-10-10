import { OwlIcon, BagIcon } from './Icons'
import books, { ATMOSPHERES } from '../data/books'

export default function Topbar({ visited, cartCount, onOpenCart }) {
  return (
    <div className="topbar">
      <a className="topbar__brand" href="#" aria-label="Biblo, inicio">
        <OwlIcon className="topbar__owl" />
        <span>Biblo</span>
      </a>

      <div className="topbar__right">
        <div className="progress" aria-label={`Mundos abiertos: ${visited.size} de ${books.length}`}>
          <span className="progress__label">
            Mundos abiertos <strong>{visited.size}/{books.length}</strong>
          </span>
          <span className="progress__track" aria-hidden="true">
            {books.map((b) => (
              <span
                key={b.id}
                className={`progress__pip${visited.has(b.id) ? ' is-on' : ''}`}
                style={visited.has(b.id) ? { background: ATMOSPHERES[b.atmosphere].glow } : undefined}
              />
            ))}
          </span>
        </div>

        <button type="button" className="cart-button" onClick={onOpenCart}>
          <BagIcon width="18" height="18" />
          <span>Carrito</span>
          <span className="cart-button__count" key={cartCount}>
            {cartCount}
          </span>
        </button>
      </div>
    </div>
  )
}
