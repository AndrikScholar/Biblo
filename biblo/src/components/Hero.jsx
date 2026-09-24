export default function Hero() {
  return (
    <header className="hero">
      <div className="hero__mark">
        <svg viewBox="0 0 64 64" className="hero__owl" aria-hidden="true">
          <circle cx="22" cy="27" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="42" cy="27" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="22" cy="27" r="2.4" fill="currentColor" />
          <circle cx="42" cy="27" r="2.4" fill="currentColor" />
          <path d="M31 30 L32 35 L33 30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path
            d="M12 20 C14 12 20 8 32 8 C44 8 50 12 52 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M14 40 C20 46 44 46 50 40 C48 50 40 55 32 55 C24 55 16 50 14 40 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
        <span className="hero__wordmark">Biblo</span>
      </div>

      <h1 className="hero__title">La biblioteca viva</h1>

      <p className="hero__desc">
        Cada libro guarda un mundo. Abre uno y su atmósfera te envolverá: nieve, arena,
        fuego, esporas o lluvia saliendo de las páginas.
      </p>

      <p className="hero__cta">
        <span aria-hidden="true">✦</span> Elige un volumen y ábrelo
      </p>
    </header>
  )
}
