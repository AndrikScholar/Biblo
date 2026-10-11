// El asteroide B-612 asomando por la esquina inferior derecha de la ficha de
// El Principito: gira despacio con su rosa bajo la campana de cristal, sus
// tres volcanes (uno humea) y los brotes de baobab que hay que arrancar.
// Estilo plano con contorno, como la portada. Se activa con `edges: 'asteroid'`.

const R = 60 // radio del planeta en el viewBox

// Algo plantado en la superficie: se gira al ángulo `a` y se apoya en el borde
function OnSurface({ a, children }) {
  return <g transform={`rotate(${a}) translate(0 ${-R + 1})`}>{children}</g>
}

function Volcano({ smoke = false }) {
  return (
    <g>
      <path d="M-9 0 L-5 -9 H5 L9 0 Z" fill="#7d8193" />
      <ellipse cx="0" cy="-9" rx="5" ry="1.6" fill="#3a3e52" />
      {smoke && (
        <g className="asteroid__smoke" fill="#d9dbe4">
          <circle cx="0" cy="-15" r="2.6" />
          <circle cx="2.5" cy="-21" r="3.3" />
          <circle cx="0.5" cy="-28" r="4" />
        </g>
      )}
    </g>
  )
}

function Rose() {
  return (
    <g>
      <path d="M0 0 V-15" stroke="#3f8f4a" strokeWidth="1.4" fill="none" />
      <path d="M0 -6 Q-5 -9 -6 -5 Q-3 -4 0 -6 Z M0 -9 Q5 -12 6 -8 Q3 -7 0 -9 Z" fill="#4fa35a" />
      <circle cx="0" cy="-18" r="4.2" fill="#d8323a" />
      <path d="M-2 -18 Q0 -21 2 -18 Q0 -16 -2 -18" fill="none" stroke="#8e1b22" strokeWidth="0.8" />
      {/* campana de cristal */}
      <path d="M-9 0 V-17 A9 9 0 0 1 9 -17 V0" fill="rgba(220, 235, 255, 0.12)" stroke="rgba(235, 245, 255, 0.75)" strokeWidth="0.9" />
      <path d="M-5.5 -19 A6 6 0 0 1 -1 -24" fill="none" stroke="rgba(255, 255, 255, 0.8)" strokeWidth="0.9" strokeLinecap="round" />
    </g>
  )
}

function Sprout() {
  return <path d="M0 0 V-6 M0 -4 Q-4 -7 -5 -4 M0 -5 Q4 -9 5 -5" stroke="#3f8f4a" strokeWidth="1.3" fill="none" strokeLinecap="round" />
}

export default function Asteroid() {
  return (
    <div className="asteroid" aria-hidden="true">
      <svg viewBox="-100 -100 200 200">
        <g className="asteroid__spin">
          <circle r={R} fill="#c9cbd3" stroke="#1d2140" strokeWidth="1.6" />
          {/* sombra del lado de la noche */}
          <path d={`M0 ${-R} A${R} ${R} 0 0 1 0 ${R} A${R * 0.62} ${R} 0 0 0 0 ${-R}`} fill="rgba(29, 33, 64, 0.22)" />
          {/* cráteres */}
          <ellipse cx="-22" cy="-14" rx="8" ry="5" fill="#b3b6c2" stroke="#8e92a3" strokeWidth="0.8" />
          <ellipse cx="18" cy="20" rx="10" ry="6" fill="#b3b6c2" stroke="#8e92a3" strokeWidth="0.8" />
          <ellipse cx="-14" cy="30" rx="5" ry="3" fill="#b3b6c2" stroke="#8e92a3" strokeWidth="0.8" />

          <OnSurface a={-38}><Rose /></OnSurface>
          <OnSurface a={20}><Volcano smoke /></OnSurface>
          <OnSurface a={52}><Volcano /></OnSurface>
          <OnSurface a={160}><Volcano /></OnSurface>
          <OnSurface a={-95}><Sprout /></OnSurface>
          <OnSurface a={110}><Sprout /></OnSurface>
        </g>
      </svg>
    </div>
  )
}
