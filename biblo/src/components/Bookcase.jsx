import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ShelfSparks from './ShelfSparks'
import books, { ATMOSPHERES, SHELVES, booksByShelf, formatPrice } from '../data/books'
import { playHover } from '../sound'
import { OpenBookIcon, PlusIcon, CheckIcon } from './Icons'

function Spine({ book, active, visited, onActivate, onOpen, spineRef }) {
  const atmosphere = ATMOSPHERES[book.atmosphere]
  const style = {
    '--spine-f': book.spine.height,
    '--spine-w': `${book.spine.width}px`,
    '--glow': atmosphere.glow,
    background: book.cover
      ? `linear-gradient(90deg, rgba(10,4,4,.55), rgba(10,4,4,.15) 40%, rgba(10,4,4,.6)), url(${book.cover}) center / cover`
      : atmosphere.bg,
    color: atmosphere.glow,
  }

  return (
    <button
      type="button"
      ref={active ? spineRef : undefined}
      className={`spine${book.cover ? ' spine--photo' : ''}${active ? ' is-active' : ''}${visited ? ' is-visited' : ''}`}
      style={style}
      onMouseEnter={() => onActivate(book.id)}
      onFocus={(e) => {
        // solo con teclado: el foco que devuelve la escena al cerrarse no cuenta
        if (e.currentTarget.matches(':focus-visible')) onActivate(book.id)
      }}
      onClick={(e) => onOpen(book, e.currentTarget.getBoundingClientRect())}
      aria-haspopup="dialog"
      aria-label={`Abrir ${book.title}, ${formatPrice(book.price)}${visited ? ', ya explorado' : ''}`}
    >
      <span className="spine__band" />
      <span className="spine__title">{book.title}</span>
      <span className="spine__band spine__band--low" />
      <span className="spine__sig">{book.signature.split(' · ')[0]}</span>
    </button>
  )
}

export default function Bookcase({ activeId, onActivate, visited, inCart, onOpen, onAdd }) {
  const caseRef = useRef(null)
  const spineRef = useRef(null)
  const hideTimer = useRef(null)
  const [tagLeft, setTagLeft] = useState(null)
  const active = SHELVES.flatMap((s) => booksByShelf(s.id)).find((b) => b.id === activeId)
  const atmosphere = active ? ATMOSPHERES[active.atmosphere] : null

  // La ficha solo se ve mientras el cursor está en la estantería (o sobre
  // la propia ficha). Al salir se espera un momento, para poder bajar el
  // cursor hasta los botones de la ficha sin que desaparezca por el camino.
  function cancelHide() {
    clearTimeout(hideTimer.current)
  }

  function scheduleHide() {
    cancelHide()
    hideTimer.current = setTimeout(() => onActivate(null), 280)
  }

  function activate(id) {
    cancelHide()
    if (id !== activeId) playHover(books.findIndex((b) => b.id === id))
    onActivate(id)
  }

  function onBlur(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) onActivate(null)
  }

  useEffect(() => cancelHide, [])

  // la ficha cuelga sobre el lomo activo
  useLayoutEffect(() => {
    function place() {
      const el = spineRef.current
      const box = caseRef.current
      if (!el || !box) return
      const r = el.getBoundingClientRect()
      const b = box.getBoundingClientRect()
      setTagLeft(r.left - b.left + r.width / 2)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [activeId])

  return (
    <section className="case-wrap" aria-label="Estanterías">
      <div
        className="case"
        ref={caseRef}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
        onBlur={onBlur}
      >
        {active && (
          <div
            className="tag"
            style={tagLeft != null ? { '--tag-x': `${tagLeft}px` } : undefined}
            key={active.id}
          >
            <span className="tag__sig">{active.signature}</span>
            <h2 className="tag__title">{active.title}</h2>
            <div className="tag__row">
              <span className="tag__price">{formatPrice(active.price)}</span>
              <div className="tag__actions">
                <button type="button" className="tag__open" onClick={() => onOpen(active, spineRef.current?.getBoundingClientRect())}>
                  <OpenBookIcon width="16" height="16" /> Abrir
                </button>
                <button
                  type="button"
                  className="tag__add"
                  onClick={() => onAdd(active.id)}
                  aria-label={inCart(active.id) ? `Añadir otro ejemplar de ${active.title}` : `Añadir ${active.title} al carrito`}
                >
                  {inCart(active.id) ? <CheckIcon width="16" height="16" /> : <PlusIcon width="16" height="16" />}
                  {inCart(active.id) ? 'En el carrito' : 'Añadir'}
                </button>
              </div>
            </div>
          </div>
        )}

        {atmosphere && <ShelfSparks sourceRef={spineRef} color={atmosphere.particle} glow={atmosphere.glow} />}

        {SHELVES.map((shelf) => (
          <div className={`bay bay--${shelf.id}`} key={shelf.id}>
            <div className="bay__plate">
              <span className="bay__name">{shelf.name}</span>
              <span className="bay__sub">{shelf.subtitle}</span>
            </div>
            <div className="bay__books">
              {booksByShelf(shelf.id).map((book) => (
                <Spine
                  key={book.id}
                  book={book}
                  active={book.id === activeId}
                  visited={visited.has(book.id)}
                  onActivate={activate}
                  onOpen={onOpen}
                  spineRef={spineRef}
                />
              ))}
              {shelf.note && (
                <aside className="bay__note">
                  <span className="bay__note-label">Nota de sala</span>
                  <p>{shelf.note}</p>
                </aside>
              )}
            </div>
            <div className="bay__plank" />
          </div>
        ))}
      </div>
    </section>
  )
}
