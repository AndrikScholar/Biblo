import { OwlIcon } from './Icons'

// Sin la base de datos no hay catálogo: se avisa en vez de mostrar un
// estante vacío.
export default function Offline() {
  return (
    <main className="offline">
      <OwlIcon className="offline__owl" />
      <h1>La biblioteca está a oscuras</h1>
      <p>
        No se pudo cargar el catálogo. Enciende <strong>Apache</strong> y <strong>MySQL</strong> en el panel de
        XAMPP y vuelve a intentarlo.
      </p>
      <button type="button" className="drawer__checkout" onClick={() => location.reload()}>
        Reintentar
      </button>
    </main>
  )
}
