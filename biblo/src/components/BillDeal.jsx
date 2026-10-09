import { useEffect, useRef, useState } from 'react'
import './BillDeal.css'
import BookModal from './BookModal'
import books from '../data/books'

// Reconstrucción en React de la escena "trato" que ya tenías en
// HTML/CSS/JS puro (index.html, style.css, script.js). Misma lógica,
// pero manejada con estado de React en vez de manipular el DOM directo.
//
// Requiere dos archivos estáticos en /public:
//   - trato.mp4   (ya lo copiamos nosotros)
//   - terror.mp3  (falta: agrégalo tú en /public/terror.mp3)
//
// Después de SÍ o NO, además del texto de resultado, ahora se abre la
// sinopsis del libro (el mismo modal que usan los demás). Mientras no
// tengas la sinopsis real de Bill, se usa como placeholder el texto y
// la atmósfera de otro libro del catálogo — cámbialo abajo en
// PLACEHOLDER_ID por el que prefieras mientras tanto.
const PLACEHOLDER_ID = 'orbita-muerta'
const placeholderBook = books.find((b) => b.id === PLACEHOLDER_ID)

export default function BillDeal({ onExit }) {
  const [result, setResult] = useState(null) // null | 'si' | 'no'
  const [fading, setFading] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [textVisible, setTextVisible] = useState(false)
  const [showSynopsis, setShowSynopsis] = useState(false)
  const [glitch, setGlitch] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    audioRef.current = new Audio('/terror.mp3')
  }, [])

  function elegir(choice) {
    setResult(choice)
    setFading(true)

    if (choice === 'no') {
      setGlitch(true)
      audioRef.current?.play().catch(() => {
        // si falta terror.mp3 o el navegador bloquea el audio, seguimos sin romper la animación
      })
    }

    setTimeout(() => {
      setShowResult(true)
      setTimeout(() => {
        setTextVisible(true)
        // tras leer el texto de resultado, pasamos a la sinopsis del libro
        setTimeout(() => {
          setGlitch(false)
          setShowSynopsis(true)
        }, 2500)
      }, 500)
    }, 500)
  }

  if (showSynopsis && placeholderBook) {
    return <BookModal book={placeholderBook} onClose={onExit} />
  }

  return (
    <div className={`bill-deal${glitch ? ' activar-glitch' : ''}`}>
      <button type="button" id="btn-volver" onClick={onExit}>
        Volver al inicio
      </button>

      {!showResult && (
        <div id="escena-principal" style={{ opacity: fading ? 0 : 1 }}>
          <div className="video-container">
            <video src="/trato.mp4" autoPlay loop muted playsInline />
            <div className="botones">
              <button type="button" className="btn-trato" id="btn-si" onClick={() => elegir('si')}>
                SÍ
              </button>
              <button type="button" className="btn-trato" id="btn-no" onClick={() => elegir('no')}>
                NO
              </button>
            </div>
          </div>
        </div>
      )}

      {showResult && result === 'no' && (
        <div className="pantalla-respuesta" style={{ display: 'flex' }}>
          <div className="texto-final rojo" style={{ opacity: textVisible ? 1 : 0 }}>
            Como si tuvieras
            <br />
            otra elección...
          </div>
        </div>
      )}

      {showResult && result === 'si' && (
        <div className="pantalla-respuesta" style={{ display: 'flex' }}>
          <div className="texto-final cyan" style={{ opacity: textVisible ? 1 : 0 }}>
            Excelente decisión
          </div>
        </div>
      )}
    </div>
  )
}