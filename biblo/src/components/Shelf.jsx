import BookCard from './BookCard'

export default function Shelf({ shelf, books, onOpen }) {
  return (
    <section className="shelf" aria-labelledby={`shelf-${shelf.id}`}>
      <div className="shelf__header">
        <h2 id={`shelf-${shelf.id}`}>{shelf.name}</h2>
        <span className="shelf__rule" />
        {shelf.tags.length > 0 && (
          <span className="shelf__tags">{shelf.tags.join(' · ')}</span>
        )}
      </div>

      <div className="shelf__row">
        <div className="shelf__books">
          {books.map((book) => (
            <BookCard key={book.id} book={book} onOpen={onOpen} />
          ))}
        </div>

        {shelf.note && (
          <aside className="shelf__note">
            <span className="shelf__note-label">Nota de sala</span>
            <p>{shelf.note}</p>
          </aside>
        )}
      </div>
    </section>
  )
}
