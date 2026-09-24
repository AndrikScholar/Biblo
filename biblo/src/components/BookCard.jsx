import { ATMOSPHERES } from '../data/books'

export default function BookCard({ book, onOpen }) {
  const atmosphere = ATMOSPHERES[book.atmosphere]

  return (
    <button
      type="button"
      className="book-card"
      onClick={() => onOpen(book)}
      aria-haspopup="dialog"
    >
      <span className="book-cover" style={{ background: atmosphere.bg }}>
        <span className="book-cover__frame" style={{ borderColor: atmosphere.glow }} />
        <span className="book-cover__title" style={{ color: atmosphere.glow }}>
          {book.title}
        </span>
      </span>
      <span className="book-caption">
        <span className="book-title">{book.title}</span>
        <span className="book-signature">{book.signature}</span>
      </span>
    </button>
  )
}
