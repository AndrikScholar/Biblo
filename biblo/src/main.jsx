import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fuentes servidas desde el propio proyecto: funcionan sin conexión.
import '@fontsource/im-fell-english/400.css'
import '@fontsource/im-fell-english/400-italic.css'
import '@fontsource/alegreya/400.css'
import '@fontsource/alegreya/400-italic.css'
import '@fontsource/alegreya/500.css'
import '@fontsource/courier-prime/400.css'
import '@fontsource/courier-prime/700.css'
import './index.css'
import Root from './Root.jsx'
import Offline from './components/Offline'
import { loadCatalog } from './data/books'

const root = createRoot(document.getElementById('root'))

loadCatalog().then(
  () =>
    root.render(
      <StrictMode>
        <Root />
      </StrictMode>,
    ),
  () => root.render(<Offline />),
)
