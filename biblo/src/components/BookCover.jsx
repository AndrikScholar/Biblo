import { ATMOSPHERES } from '../data/books'

// Portada de un volumen: foto si existe, si no una portada tipográfica
// pintada con la atmósfera del libro.
export default function BookCover({ book, className = '' }) {
  const atmosphere = ATMOSPHERES[book.atmosphere]

  if (book.cover) {
    return (
      <span className={`cover cover--photo ${className}`}>
        <img src={book.cover} alt="" />
      </span>
    )
  }

  return (
    <span className={`cover ${className}`} style={{ background: atmosphere.bg, color: atmosphere.glow }}>
      <span className="cover__frame" />
      <span className="cover__title">{book.title}</span>
      <span className="cover__mark">Biblo</span>
    </span>
  )
}
