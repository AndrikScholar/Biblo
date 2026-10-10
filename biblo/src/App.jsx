import { useCallback, useState } from 'react'
import Topbar from './components/Topbar'
import Hero from './components/Hero'
import Bookcase from './components/Bookcase'
import BookModal from './components/BookModal'
import BillDeal from './components/BillDeal'
import CthulhuRising from './components/CthulhuRising'
import CartDrawer from './components/CartDrawer'
import AchievementToast from './components/AchievementToast'
import books from './data/books'
import './App.css'

const VISITED_KEY = 'biblo:visited-books'
const ACHIEVEMENT_KEY = 'biblo:achievement:trotamundos'
const CART_KEY = 'biblo:cart'

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // sin localStorage el progreso no persiste, pero el sitio sigue funcionando
  }
}

export default function App() {
  const [openBook, setOpenBook] = useState(null)
  const [origin, setOrigin] = useState(null)
  const [visited, setVisited] = useState(() => new Set(loadJSON(VISITED_KEY, [])))
  const [showAchievement, setShowAchievement] = useState(false)
  const [cart, setCart] = useState(() => loadJSON(CART_KEY, []))
  const [cartOpen, setCartOpen] = useState(false)
  // lomo bajo el cursor (o con el foco); null cuando no hay ninguno
  const [activeId, setActiveId] = useState(null)

  const cartCount = cart.reduce((n, i) => n + i.qty, 0)
  const inCart = (id) => cart.some((i) => i.id === id)

  function updateCart(next) {
    setCart(next)
    saveJSON(CART_KEY, next)
  }

  function addToCart(id) {
    const exists = cart.some((i) => i.id === id)
    updateCart(exists ? cart.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)) : [...cart, { id, qty: 1 }])
  }

  function handleOpen(book, rect) {
    setOrigin(rect || null)
    setOpenBook(book)
    setActiveId(null)

    if (visited.has(book.id)) return

    const next = new Set(visited)
    next.add(book.id)
    setVisited(next)
    saveJSON(VISITED_KEY, [...next])

    if (next.size === books.length && !loadJSON(ACHIEVEMENT_KEY, false)) {
      setShowAchievement(true)
      saveJSON(ACHIEVEMENT_KEY, true)
    }
  }

  const closeBook = useCallback(() => setOpenBook(null), [])
  const closeCart = useCallback(() => setCartOpen(false), [])
  const hideAchievement = useCallback(() => setShowAchievement(false), [])

  return (
    <div className="app">
      <Topbar visited={visited} cartCount={cartCount} onOpenCart={() => setCartOpen(true)} />
      <Hero />

      <main>
        <Bookcase
          activeId={activeId}
          onActivate={setActiveId}
          visited={visited}
          inCart={inCart}
          onOpen={handleOpen}
          onAdd={addToCart}
        />
      </main>

      <footer className="colophon">
        <p>
          Dicen que quien abre todos los volúmenes recibe algo a cambio. Llevas {visited.size} de {books.length}.
        </p>
        <p className="colophon__small">Biblo, la biblioteca viva. Libros y precios ficticios.</p>
      </footer>

      {openBook?.special === 'billDeal' && (
        <BillDeal
          onExit={closeBook}
          synopsisProps={{ inCart: inCart(openBook.id), onAdd: addToCart, direct: true }}
        />
      )}
      {openBook?.special === 'cthulhuRising' && (
        <CthulhuRising
          onExit={closeBook}
          synopsisProps={{ inCart: inCart(openBook.id), onAdd: addToCart, direct: true }}
        />
      )}
      {openBook && !openBook.special && (
        <BookModal
          book={openBook}
          origin={origin}
          onClose={closeBook}
          inCart={inCart(openBook.id)}
          onAdd={addToCart}
        />
      )}

      {cartOpen && <CartDrawer items={cart} onChange={updateCart} onClose={closeCart} />}

      {showAchievement && (
        <AchievementToast
          title="Trotamundos"
          description="Lograste encontrar todas las animaciones"
          onDone={hideAchievement}
        />
      )}
    </div>
  )
}
