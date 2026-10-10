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
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
