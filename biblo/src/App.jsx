import { useState } from 'react'
import Hero from './components/Hero'
import Shelf from './components/Shelf'
import BookModal from './components/BookModal'
import BillDeal from './components/BillDeal'
import AchievementToast from './components/AchievementToast'
import books, { SHELVES, booksByShelf } from './data/books'
import './App.css'

const VISITED_KEY = 'biblo:visited-books'
const ACHIEVEMENT_KEY = 'biblo:achievement:trotamundos'

function loadVisited() {
  try {
    return new Set(JSON.parse(localStorage.getItem(VISITED_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export default function App() {
  const [openBook, setOpenBook] = useState(null)
  const [visited, setVisited] = useState(loadVisited)
  const [showAchievement, setShowAchievement] = useState(false)

  function handleOpen(book) {
    setOpenBook(book)

    if (visited.has(book.id)) return

    const next = new Set(visited)
    next.add(book.id)
    setVisited(next)

    try {
      localStorage.setItem(VISITED_KEY, JSON.stringify([...next]))
    } catch {
      // sin localStorage el progreso no persiste, pero el sitio sigue funcionando
    }

    if (next.size === books.length) {
      let alreadyUnlocked = false
      try {
        alreadyUnlocked = localStorage.getItem(ACHIEVEMENT_KEY) === 'true'
      } catch {
        alreadyUnlocked = false
      }

      if (!alreadyUnlocked) {
        setShowAchievement(true)
        try {
          localStorage.setItem(ACHIEVEMENT_KEY, 'true')
        } catch {
          // sin localStorage el logro podría repetirse en otra visita
        }
      }
    }
  }

  return (
    <div className="app">
      <Hero />

      <main>
        {SHELVES.map((shelf) => (
          <Shelf
            key={shelf.id}
            shelf={shelf}
            books={booksByShelf(shelf.id)}
            onOpen={handleOpen}
          />
        ))}
      </main>

      {openBook?.special === 'billDeal' && <BillDeal onExit={() => setOpenBook(null)} />}
      {openBook && !openBook.special && (
        <BookModal book={openBook} onClose={() => setOpenBook(null)} />
      )}

      {showAchievement && (
        <AchievementToast
          title="Trotamundos"
          description="Lograste encontrar todas las animaciones"
          onDone={() => setShowAchievement(false)}
        />
      )}
    </div>
  )
}