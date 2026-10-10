import { useCallback, useEffect, useRef, useState } from 'react'
import Atmosphere from './Atmosphere'
import BookCover from './BookCover'
import Tentacles from './Tentacles'
import CipherWheel from './CipherWheel'
import { ATMOSPHERES, formatPrice } from '../data/books'
import { CloseIcon, EyeIcon, PlusIcon, CheckIcon } from './Icons'

const CLOSE_MS = 520

// La escena de un libro abierto: su atmósfera a pantalla completa.
// `origin` es el rectángulo del lomo; la escena crece desde ahí.
// `direct`: viene de otra escena a pantalla completa, así que aparece sin la
// apertura circular (que dejaría ver la estantería un instante).
export default function BookModal({ book, origin, onClose, inCart = false, onAdd, direct = false }) {
  const [immersive, setImmersive] = useState(false)
  const [closing, setClosing] = useState(false)
  const closeRef = useRef(null)
  const atmosphere = ATMOSPHERES[book.atmosphere]

  const ox = origin ? origin.left + origin.width / 2 : window.innerWidth / 2
  const oy = origin ? origin.top + origin.height / 2 : window.innerHeight / 2

  const requestClose = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose()
      return
    }
    setClosing(true)
    setTimeout(onClose, CLOSE_MS)
  }, [onClose])

  useEffect(() => {
    const previous = document.activeElement
    closeRef.current?.focus({ preventScroll: true })
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e) {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
      previous?.focus?.({ preventScroll: true })
    }
  }, [requestClose])

  const byline = book.author
    ? `${book.author}${book.year ? `, ${book.year}` : ''}`
    : `Autor desconocido · ${book.provenance || 'procedencia incierta'}`

  return (
    <div
      className={`scene${direct ? ' is-direct' : ''}${closing ? ' is-closing' : ''}${immersive ? ' is-immersive' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scene-title"
      style={{ '--ox': `${ox}px`, '--oy': `${oy}px`, '--glow': atmosphere.glow }}
    >
      <Atmosphere kind={book.atmosphere} className="scene__atmosphere" />
      {book.edges === 'tentacles' && <Tentacles />}
      {book.edges === 'cipherWheel' && <CipherWheel />}

      <div className="scene__controls">
        <button
          type="button"
          className="scene__btn"
          aria-pressed={immersive}
          onClick={() => setImmersive((v) => !v)}
        >
          <EyeIcon width="16" height="16" />
          {immersive ? 'Mostrar ficha' : 'Inmersión'}
        </button>
        <button type="button" className="scene__btn" onClick={requestClose} ref={closeRef}>
          <CloseIcon width="16" height="16" />
          Cerrar
        </button>
      </div>

      <div className="scene__body">
        <div className="scene__book">
          <BookCover book={book} className="scene__cover" />
        </div>

        <div className="scene__text">
          <span className="scene__sig">{book.signature}</span>
          <h2 id="scene-title" className="scene__title">
            {book.title}
          </h2>
          <p className="scene__byline">{byline}</p>
          <p className="scene__ambient">{book.ambientLabel.charAt(0) + book.ambientLabel.slice(1).toLowerCase()}.</p>
          <p className="scene__desc">{book.description}</p>
          <blockquote className="scene__quote">{book.quote}</blockquote>

          <div className="scene__buy">
            <span className="scene__price">{formatPrice(book.price)}</span>
            <button type="button" className="scene__add" onClick={() => onAdd?.(book.id)}>
              <PlusIcon width="18" height="18" />
              {inCart ? 'Añadir otro' : 'Añadir al carrito'}
            </button>
            {inCart && (
              <span className="scene__incart">
                <CheckIcon width="16" height="16" /> Ya está en tu carrito
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
