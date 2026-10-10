// Rueda de símbolos al estilo de Bill Cipher, girando muy despacio detrás de
// la ficha. Es enorme y está centrada, así que solo su anillo asoma por las
// esquinas de la pantalla, como un marco. Símbolos geométricos propios.
// Se activa con `edges: 'cipherWheel'` en books.js.

const R_OUT = 96
const R_IN = 68
const R_SYM = (R_OUT + R_IN) / 2

// Cada símbolo se dibuja en un recuadro de -8..8, apuntando hacia fuera.
const SYMBOLS = [
  // pino
  <g key="pino"><path d="M0 -8 L6 4 L-6 4 Z" /><path d="M0 4 V8" /></g>,
  // estrella fugaz
  <g key="estrella"><path d="M2 -6 L3.5 -1.5 L8 -1.5 L4.5 1.5 L6 6 L2 3 L-2 6 L-0.5 1.5 L-4 -1.5 L0.5 -1.5 Z" /><path d="M-3 -3 L-8 -7 M-4 0 L-8 -1" /></g>,
  // interrogación
  <g key="pregunta"><path d="M-4 -4 A4 4 0 1 1 1 0 Q0 1.5 0 4" /><circle cx="0" cy="7" r="0.6" /></g>,
  // gafas
  <g key="gafas"><circle cx="-4" cy="0" r="3.2" /><circle cx="4" cy="0" r="3.2" /><path d="M-0.8 0 H0.8 M-7.2 0 L-8 -2 M7.2 0 L8 -2" /></g>,
  // cristal de hielo
  <g key="hielo"><path d="M0 -8 V8 M-7 -4 L7 4 M-7 4 L7 -4 M-2 -6 L0 -4 L2 -6 M-2 6 L0 4 L2 6" /></g>,
  // corazón cosido
  <g key="corazon"><path d="M0 7 L-6.5 0 A3.6 3.6 0 0 1 0 -4.5 A3.6 3.6 0 0 1 6.5 0 Z" /><path d="M0 -4 V6 M-1.5 -2 H1.5 M-1.5 1 H1.5 M-1.5 4 H1.5" /></g>,
  // mano de seis dedos
  <g key="mano"><path d="M-5 8 V0 M-5 0 V-5 M-3 0 V-7 M-1 0 V-8 M1 0 V-8 M3 0 V-7 M5 0 V-5 M-5 8 H5 V0" /></g>,
  // luna
  <g key="luna"><path d="M2 -7 A7 7 0 1 0 2 7 A5.5 5.5 0 1 1 2 -7 Z" /></g>,
  // ojo
  <g key="ojo"><path d="M-8 0 Q0 -7 8 0 Q0 7 -8 0 Z" /><circle cx="0" cy="0" r="2.2" /></g>,
  // sombrero de copa
  <g key="sombrero"><path d="M-4 3 V-6 H4 V3 M-7 3 H7 M-4 0 H4" /></g>,
]

export default function CipherWheel() {
  const step = 360 / SYMBOLS.length

  return (
    <div className="cipher-wheel" aria-hidden="true">
      <svg viewBox="-100 -100 200 200">
        <g className="cipher-wheel__spin">
          <circle r={R_OUT} />
          <circle r={R_IN} />
          <circle r={R_OUT + 2.5} className="cipher-wheel__thin" />
          <circle r={R_IN - 2.5} className="cipher-wheel__thin" />
          {SYMBOLS.map((symbol, i) => {
            const a = i * step
            return (
              <g key={i} transform={`rotate(${a})`}>
                {/* separador entre casillas */}
                <path d={`M0 ${-R_IN} V${-R_OUT}`} transform={`rotate(${step / 2})`} />
                <g transform={`translate(0 ${-R_SYM}) scale(1.05)`}>{symbol}</g>
              </g>
            )
          })}
          {/* triángulo con ojo en el centro, apenas visible tras la ficha */}
          <g className="cipher-wheel__core">
            <path d="M0 -26 L23 14 L-23 14 Z" />
            <path d="M-9 1 Q0 -7 9 1 Q0 9 -9 1 Z" />
            <circle cx="0" cy="1" r="2.4" />
          </g>
        </g>
      </svg>
    </div>
  )
}
