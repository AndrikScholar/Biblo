import { useEffect, useRef, useState } from 'react'
import Atmosphere from './Atmosphere'
import { ATMOSPHERES } from '../data/books'

export default function BookModal({ book, onClose }) {
  const [focus, setFocus] = useState(null) // null | 'ficha' | 'inmersion'
  const closeRef = useRef(null)
  const atmosphere = ATMOSPHERES[book.atmosphere]

  useEffect(() => {
    closeRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const byline = book.author
    ? `${book.author}${book.year ? `, ${book.year}` : ''} · signatura ${book.signature}`
    : `Autor desconocido · ${book.provenance || 'procedencia incierta'} · signatura ${book.signature}`

  const cardByline = book.author
    ? [book.author.toUpperCase(), book.year].filter(Boolean).join(' · ')
    : (book.provenance || 'procedencia incierta').toUpperCase()

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className={`modal-panel${focus ? ` focus-${focus}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <Atmosphere kind={book.atmosphere} />

        <button type="button" className="modal-close" onClick={onClose} ref={closeRef}>
          <span aria-hidden="true">×</span> Cerrar
        </button>

        <div className="modal-body">
          <div className="modal-cardcluster">
            <div className="cover-swatch" style={{ background: atmosphere.bg }}>
              <span className="cover-swatch__watermark">Biblo</span>
            </div>
            <div className="index-card">
              <span className="index-card__signature">{book.signature}</span>
              <h3 className="index-card__title">{book.title}</h3>
              <span className="index-card__rule" />
              <p className="index-card__desc">{book.description}</p>
              <span className="index-card__byline">{cardByline}</span>
            </div>
          </div>

          <div className="modal-textcluster">
            <p className="modal-ambient">
              <span aria-hidden="true">✦</span> {book.ambientLabel}
            </p>
            <h2 id="modal-title" className="modal-title">
              {book.title}
            </h2>
            <p className="modal-byline">{byline}</p>
            <p className="modal-quote">{book.quote}</p>
          </div>
        </div>

        <div className="modal-toggle" role="group" aria-label="Modo de vista">
          <button
            type="button"
            aria-pressed={focus === 'ficha'}
            aria-label="Enfocar la ficha"
            onClick={() => setFocus(focus === 'ficha' ? null : 'ficha')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <rect x="4" y="5" width="16" height="14" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <line x1="7" y1="9" x2="17" y2="9" stroke="currentColor" strokeWidth="1.6" />
              <line x1="7" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          <button
            type="button"
            aria-pressed={focus === 'inmersion'}
            aria-label="Enfocar la inmersión"
            onClick={() => setFocus(focus === 'inmersion' ? null : 'inmersion')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M2 12 C5 6 9 4 12 4 C15 4 19 6 22 12 C19 18 15 20 12 20 C9 20 5 18 2 12 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
