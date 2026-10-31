import { useEffect, useState } from 'react'
import App from './App.jsx'
import Admin from './components/Admin'
import Legal from './components/Legal'

// Rutas por "#" (sin librería de rutas ni cambios en Vite):
//   #admin       panel de administración
//   #privacidad  aviso de privacidad
//   #terminos    términos y condiciones
//   cualquier otro, la tienda
export default function Root() {
  const [hash, setHash] = useState(location.hash)

  useEffect(() => {
    function onHashChange() {
      setHash(location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (hash === '#admin') return <Admin />
  if (hash === '#privacidad' || hash === '#terminos') return <Legal page={hash.slice(1)} />
  return <App />
}
