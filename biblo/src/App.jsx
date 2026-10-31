import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { CheckIcon } from './components/Icons'
import Topbar from './components/Topbar'
import Hero from './components/Hero'
import Bookcase from './components/Bookcase'
import BookModal from './components/BookModal'
import BillDeal from './components/BillDeal'
// la escena 3D (Three.js) se descarga aparte, solo cuando hace falta
const loadRising = () => import('./components/CthulhuRising')
const CthulhuRising = lazy(loadRising)
const loadBalloon = () => import('./components/RedBalloon')
const RedBalloon = lazy(loadBalloon)
import CartDrawer from './components/CartDrawer'
import AccountDrawer from './components/AccountDrawer'
import DesertToAsteroid from './components/DesertToAsteroid'
import Wonderland from './components/Wonderland'
import { prepareAliceMusic } from './components/aliceMusic'
import QuijoteRide from './components/QuijoteRide'
import { prepareQuijoteMusic } from './components/quijoteMusic'
import HogwartsLetter from './components/HogwartsLetter'
import CidRest from './components/CidRest'
import { prepareCidMusic } from './components/cidMusic'
import AchievementToast from './components/AchievementToast'
import books, { loadCatalog } from './data/books'
import { api } from './api'
import './App.css'

const VISITED_KEY = 'biblo:visited-books'
const ACHIEVEMENT_KEY = 'biblo:achievement:trotamundos'
const CART_KEY = 'biblo:cart'
// referencia viva al video precargado, para que el navegador no lo descarte
const preloaded = {}

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

  const [accountOpen, setAccountOpen] = useState(false)
  const [user, setUser] = useState(null)
  // sube tras cada compra, al refrescar el stock del catálogo (que se
  // actualiza dentro de `books`, fuera del estado de React)
  const [, setCatalogVersion] = useState(0)

  const cartCount = cart.reduce((n, i) => n + i.qty, 0)
  const inCart = (id) => cart.some((i) => i.id === id)
  const canAdd = (id) => (cart.find((i) => i.id === id)?.qty ?? 0) < (books.find((b) => b.id === id)?.stock ?? 0)
  const synopsisProps = openBook && { inCart: inCart(openBook.id), canAdd: canAdd(openBook.id), onAdd: addToCart, direct: true }

  useEffect(() => {
    api('cuenta.php').then(setUser, () => {})
  }, [])

  function updateCart(next) {
    setCart(next)
    saveJSON(CART_KEY, next)
  }

  async function handleOrdered({ keepCart = false } = {}) {
    if (!keepCart) updateCart([])
    await loadCatalog().catch(() => {})
    setCatalogVersion((v) => v + 1)
  }

  function addToCart(id) {
    if (!canAdd(id)) return
    const exists = cart.some((i) => i.id === id)
    updateCart(exists ? cart.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)) : [...cart, { id, qty: 1 }])
    setAdded((prev) => ({ id, n: (prev?.n || 0) + 1 }))
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

  // aviso breve al añadir al carrito
  const [added, setAdded] = useState(null) // { id, n }
  useEffect(() => {
    if (!added) return
    const timer = setTimeout(() => setAdded(null), 2600)
    return () => clearTimeout(timer)
  }, [added])

  // precarga en segundo plano lo pesado de las escenas especiales, para que
  // la primera vez que se abren no haya espera
  useEffect(() => {
    const timer = setTimeout(() => {
      for (const b of books) if (b.cover) new Image().src = b.cover
      loadRising()
      loadBalloon()
      prepareAliceMusic()
      prepareQuijoteMusic()
      prepareCidMusic()
      for (const url of ['/scenes/cthulhu.glb', '/scenes/globo.glb', '/scenes/sonrisa.glb', '/cajita-musical.mp3']) {
        fetch(url).catch(() => {})
      }
      const video = document.createElement('video')
      video.preload = 'auto'
      video.muted = true
      video.src = '/trato.mp4'
      preloaded.video = video
    }, 1200)
    return () => clearTimeout(timer)
  }, [])

  const closeBook = useCallback(() => setOpenBook(null), [])
  const closeCart = useCallback(() => setCartOpen(false), [])
  const closeAccount = useCallback(() => setAccountOpen(false), [])
  const hideAchievement = useCallback(() => setShowAchievement(false), [])

  return (
    <div className="app">
      <Topbar
        visited={visited}
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
        user={user}
        onOpenAccount={() => setAccountOpen(true)}
      />
      <Hero />

      <main>
        <Bookcase
          activeId={activeId}
          onActivate={setActiveId}
          visited={visited}
          inCart={inCart}
          canAdd={canAdd}
          onOpen={handleOpen}
          onAdd={addToCart}
        />
      </main>

      <footer className="colophon">
        <p>
          Dicen que quien abre todos los volúmenes recibe algo a cambio. Llevas {visited.size} de {books.length}.
        </p>
        <p className="colophon__small">Biblo, la biblioteca viva. Libros y precios ficticios.</p>
        <nav className="colophon__legal" aria-label="Información legal">
          <a href="#privacidad">Aviso de privacidad</a>
          <a href="#terminos">Términos y condiciones</a>
        </nav>
      </footer>

      {openBook?.special === 'billDeal' && (
        <BillDeal
          onExit={closeBook}
          synopsisProps={synopsisProps}
        />
      )}
      {openBook?.special === 'cthulhuRising' && (
        <Suspense fallback={<div className="rising" />}>
          <CthulhuRising
            onExit={closeBook}
            synopsisProps={synopsisProps}
          />
        </Suspense>
      )}
      {openBook?.special === 'redBalloon' && (
        <Suspense fallback={<div className="rising" />}>
          <RedBalloon
            onExit={closeBook}
            synopsisProps={synopsisProps}
          />
        </Suspense>
      )}
      {openBook?.special === 'desertToAsteroid' && (
        <DesertToAsteroid
          onExit={closeBook}
          synopsisProps={synopsisProps}
        />
      )}
      {openBook?.special === 'wonderland' && (
        <Wonderland
          onExit={closeBook}
          synopsisProps={synopsisProps}
        />
      )}
      {openBook?.special === 'quijoteRide' && (
        <QuijoteRide
          onExit={closeBook}
          synopsisProps={synopsisProps}
        />
      )}
      {openBook?.special === 'cidRest' && (
        <CidRest
          onExit={closeBook}
          synopsisProps={synopsisProps}
        />
      )}
      {openBook?.special === 'hogwartsLetter' && (
        <HogwartsLetter
          onExit={closeBook}
          synopsisProps={synopsisProps}
        />
      )}
      {openBook && !openBook.special && (
        <BookModal
          book={openBook}
          origin={origin}
          onClose={closeBook}
          inCart={inCart(openBook.id)}
          canAdd={canAdd(openBook.id)}
          onAdd={addToCart}
        />
      )}

      {added && (
        <div className="added-toast" role="status" key={added.n}>
          <CheckIcon width="18" height="18" />
          <span>
            Añadido: <strong>{books.find((b) => b.id === added.id)?.title}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              setAdded(null)
              setCartOpen(true)
            }}
          >
            Ver carrito
          </button>
        </div>
      )}

      {cartOpen && (
        <CartDrawer
          items={cart}
          onChange={updateCart}
          onClose={closeCart}
          user={user}
          onUser={setUser}
          onOrdered={handleOrdered}
        />
      )}
      {accountOpen && <AccountDrawer user={user} onUser={setUser} onClose={closeAccount} />}

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
