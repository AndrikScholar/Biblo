import { useEffect, useRef } from 'react'
import { CloseIcon } from './Icons'

// Panel lateral de papel (carrito y cuenta): cierra con Esc o al pulsar
// fuera, y devuelve el foco a donde estaba al cerrarse.
export default function Drawer({ id, title, closeLabel, onClose, children }) {
  const closeRef = useRef(null)

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

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer__head">
          <h2 id={id}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} ref={closeRef} aria-label={closeLabel}>
            <CloseIcon width="20" height="20" />
          </button>
        </div>
        {children}
      </aside>
    </div>
  )
}
