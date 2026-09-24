import { useState } from 'react'
import Hero from './components/Hero'
import Shelf from './components/Shelf'
import BookModal from './components/BookModal'
import { SHELVES, booksByShelf } from './data/books'
import './App.css'

export default function App() {
  const [openBook, setOpenBook] = useState(null)

  return (
    <div className="app">
      <Hero />

      <main>
        {SHELVES.map((shelf) => (
          <Shelf
            key={shelf.id}
            shelf={shelf}
            books={booksByShelf(shelf.id)}
            onOpen={setOpenBook}
          />
        ))}
      </main>

      {openBook && <BookModal book={openBook} onClose={() => setOpenBook(null)} />}
    </div>
  )
}
