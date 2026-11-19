import books from '../data/books'

// el número sale del catálogo: al añadir un libro, la frase se actualiza sola
const WORDS = ['Ningún', 'Un', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez', 'Once', 'Doce', 'Trece', 'Catorce', 'Quince']

export default function Hero() {
  const n = books.length
  const word = WORDS[n] ?? String(n)
  const lower = word.toLowerCase()
  return (
    <header className="hero">
      <h1 className="hero__title">
        La biblioteca <em>viva</em>
      </h1>
      <p className="hero__desc">
        {n === 1 ? 'Un libro, un mundo.' : `${word} libros, ${lower} mundos.`} Saca uno del estante y deja que su
        atmósfera escape de las páginas.
      </p>
    </header>
  )
}
