import { useEffect, useState } from 'react'
import AuthForm from './AuthForm'
import { OwlIcon } from './Icons'
import { formatPrice, loadCatalog } from '../data/books'
import { addressLine, api } from '../api'
import './Admin.css'

// Panel de administración (localhost:5173/#admin). La tienda nunca lo
// enlaza para los clientes; además la API comprueba el rol en cada llamada.

const GENRES = { terror: 'Terror', fantasía: 'Fantasía', aventura: 'Aventura' }
const SHIPPING = { en_preparacion: 'En preparación', enviado: 'Enviado', entregado: 'Entregado' }
const PAYMENT = { pendiente: 'Pendiente', pagado: 'Pagado', rechazado: 'Rechazado' }

const dateTime = (iso) =>
  new Date(iso.replace(' ', 'T')).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

export default function Admin() {
  const [user, setUser] = useState(undefined) // undefined mientras se comprueba la sesión
  const [tab, setTab] = useState('resumen')

  useEffect(() => {
    api('cuenta.php').then(setUser, () => setUser(null))
  }, [])

  async function logout() {
    await api('cuenta.php', { accion: 'salir' }).catch(() => {})
    setUser(null)
  }

  const isAdmin = user?.rol === 'admin'

  return (
    <div className="admin">
      <header className="topbar">
        <a className="topbar__brand" href="#" aria-label="Volver a la tienda">
          <OwlIcon className="topbar__owl" />
          <span>Biblo</span>
          <span className="admin__badge">Administración</span>
        </a>
        <div className="admin__who">
          {user && <span>{user.nombre}</span>}
          {user && (
            <button type="button" className="admin__ghost" onClick={logout}>
              Cerrar sesión
            </button>
          )}
          <a className="admin__ghost" href="#">
            Ver la tienda
          </a>
        </div>
      </header>

      <main className="admin__sheet">
        {user === undefined ? (
          <p className="drawer__aside">Comprobando la sesión…</p>
        ) : !user ? (
          <div className="admin__login">
            <AuthForm onDone={setUser} allowSignup={false} intro="Solo para la cuenta de administración de Biblo." />
          </div>
        ) : !isAdmin ? (
          <div className="admin__login">
            <p className="form__title">Esta cuenta no es de administración</p>
            <p className="form__intro">
              Has entrado como {user.email}. Cierra sesión y entra con una cuenta de administración.
            </p>
          </div>
        ) : (
          <>
            <nav className="admin__tabs" aria-label="Secciones del panel">
              {[
                ['resumen', 'Resumen'],
                ['libros', 'Catálogo'],
                ['pedidos', 'Pedidos'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`admin__tab${tab === id ? ' is-on' : ''}`}
                  aria-current={tab === id ? 'page' : undefined}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
            {tab === 'resumen' && <Metrics />}
            {tab === 'libros' && <Catalog />}
            {tab === 'pedidos' && <Orders />}
          </>
        )}
      </main>
    </div>
  )
}

// ---------- Resumen ----------

function Metrics() {
  const [m, setM] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('admin_metricas.php').then(setM, (err) => setError(err.message))
  }, [])

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!m) return <p className="drawer__aside">Calculando…</p>

  const top = m.mas_vendidos[0]?.unidades || 1
  return (
    <section>
      <h2 className="admin__title">Resumen de ventas</h2>
      <p className="drawer__aside">Solo cuentan los pedidos pagados.</p>
      <div className="stats">
        <Stat label="Ventas totales" value={formatPrice(m.ventas_totales)} main />
        <Stat label="Ticket promedio (AOV)" value={formatPrice(m.ticket_promedio)} main />
        <Stat label="Pedidos pagados" value={m.pedidos_pagados} />
        <Stat label="Libros vendidos" value={m.libros_vendidos} />
        <Stat label="Pagos pendientes" value={m.pedidos_pendientes} />
        <Stat label="Pagos rechazados" value={m.pedidos_rechazados} />
        <Stat label="Clientes registrados" value={m.clientes} />
        <Stat label="Libros agotados" value={m.agotados} />
      </div>

      <h3 className="admin__subtitle">Más vendidos</h3>
      {m.mas_vendidos.length === 0 ? (
        <p className="drawer__aside">Todavía no hay ventas.</p>
      ) : (
        <ol className="bestsellers">
          {m.mas_vendidos.map((b) => (
            <li key={b.titulo}>
              <span className="bestsellers__title">{b.titulo}</span>
              <span className="bestsellers__bar" style={{ '--w': `${(b.unidades / top) * 100}%` }} aria-hidden="true" />
              <span className="bestsellers__n">{b.unidades}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Stat({ label, value, main }) {
  return (
    <div className={`stat${main ? ' stat--main' : ''}`}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  )
}

// ---------- Catálogo (CRUD) ----------

const EMPTY_BOOK = {
  titulo: '',
  autor: '',
  anio: '',
  procedencia: '',
  genero: '',
  estante: 'b',
  signatura: '',
  portada: '',
  precio: '',
  stock: '0',
  descripcion: '',
  cita: '',
}

function Catalog() {
  const [list, setList] = useState(null)
  const [editing, setEditing] = useState(null) // null | libro (sin id = nuevo)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const reload = () => api('admin_libros.php').then(setList, (err) => setError(err.message))
  useEffect(() => {
    reload()
  }, [])

  async function remove(book) {
    if (!window.confirm(`¿Eliminar «${book.titulo}» del catálogo? No se puede deshacer.`)) return
    setError('')
    try {
      await api('admin_libros.php', { accion: 'eliminar', id: book.id })
      setNotice(`«${book.titulo}» se eliminó del catálogo.`)
      reload()
      loadCatalog().catch(() => {})
    } catch (err) {
      setError(err.message)
    }
  }

  if (editing) {
    return (
      <BookForm
        book={editing}
        onCancel={() => setEditing(null)}
        onSaved={(title) => {
          setEditing(null)
          setNotice(`«${title}» se guardó.`)
          reload()
          // la tienda lee el catálogo una vez: se refresca para que el cambio se vea al volver
          loadCatalog().catch(() => {})
        }}
      />
    )
  }

  return (
    <section>
      <div className="admin__head">
        <h2 className="admin__title">Catálogo</h2>
        <button
          type="button"
          className="drawer__checkout admin__primary"
          onClick={() => {
            setNotice('')
            setEditing(EMPTY_BOOK)
          }}
        >
          + Añadir libro
        </button>
      </div>
      {notice && <p className="admin__notice" role="status">{notice}</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      {!list ? (
        <p className="drawer__aside">Cargando el catálogo…</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Libro</th>
                <th>Género</th>
                <th>Estante</th>
                <th className="num">Precio</th>
                <th className="num">Stock</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span className="table__title">{b.titulo}</span>
                    <span className="table__sub">
                      {b.autor || 'Autor desconocido'} · {b.signatura}
                    </span>
                  </td>
                  <td>{GENRES[b.genero]}</td>
                  <td>{b.estante.toUpperCase()}</td>
                  <td className="num">{formatPrice(b.precio)}</td>
                  <td className={`num${b.stock === 0 ? ' is-out' : ''}`}>{b.stock === 0 ? 'Agotado' : b.stock}</td>
                  <td className="table__actions">
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        setNotice('')
                        setEditing(b)
                      }}
                    >
                      Editar
                    </button>
                    <button type="button" className="link-btn is-danger" onClick={() => remove(b)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function BookForm({ book, onCancel, onSaved }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isNew = !book.id

  async function submit(e) {
    e.preventDefault()
    const libro = { ...Object.fromEntries(new FormData(e.currentTarget)), id: book.id }
    setBusy(true)
    setError('')
    try {
      await api('admin_libros.php', { accion: 'guardar', libro })
      onSaved(libro.titulo)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const v = (field) => book[field] ?? ''

  return (
    <section>
      <h2 className="admin__title">{isNew ? 'Añadir libro' : `Editar «${book.titulo}»`}</h2>
      {isNew && (
        <p className="drawer__aside">
          Un libro nuevo aparece en el estante con un aspecto por defecto; su atmósfera e intro propias se
          añaden en el código (src/data/books.js).
        </p>
      )}
      <form className="form admin__form" onSubmit={submit}>
        <div className="admin__grid">
          <Field label="Título" name="titulo" defaultValue={v('titulo')} required maxLength={120} wide />
          <Field label="Autor (opcional)" name="autor" defaultValue={v('autor')} maxLength={120} />
          <Field label="Año (opcional)" name="anio" defaultValue={v('anio')} maxLength={20} />
          <Field
            label="Procedencia (si no hay autor)"
            name="procedencia"
            defaultValue={v('procedencia')}
            maxLength={120}
            placeholder="procedencia incierta"
          />
          <label className="field">
            <span>Género</span>
            <select name="genero" defaultValue={v('genero')} required>
              <option value="" disabled>
                Elige…
              </option>
              {Object.entries(GENRES).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Estantería</span>
            <select name="estante" defaultValue={v('estante')} required>
              <option value="a">A · Mundos que se desatan</option>
              <option value="b">B · Mundos que esperan</option>
            </select>
          </label>
          <Field label="Signatura" name="signatura" defaultValue={v('signatura')} required maxLength={20} placeholder="X-666 · CIP" />
          <Field label="Precio ($)" name="precio" type="number" min="0" step="0.01" defaultValue={v('precio')} required />
          <Field label="Stock (ejemplares)" name="stock" type="number" min="0" step="1" defaultValue={v('stock')} required />
          <Field
            label="Portada (opcional)"
            name="portada"
            defaultValue={v('portada')}
            maxLength={200}
            placeholder="/covers/mi-libro.jpg"
            wide
          />
          <label className="field admin__wide">
            <span>Sinopsis</span>
            <textarea name="descripcion" defaultValue={v('descripcion')} required rows={6} />
          </label>
          <label className="field admin__wide">
            <span>Cita (opcional)</span>
            <textarea name="cita" defaultValue={v('cita')} rows={2} />
          </label>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="admin__formActions">
          <button type="submit" className="drawer__checkout admin__primary" disabled={busy}>
            {isNew ? 'Añadir al catálogo' : 'Guardar cambios'}
          </button>
          <button type="button" className="link-btn" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  )
}

function Field({ label, wide, ...input }) {
  return (
    <label className={`field${wide ? ' admin__wide' : ''}`}>
      <span>{label}</span>
      <input {...input} />
    </label>
  )
}

// ---------- Pedidos ----------

function Orders() {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('admin_pedidos.php').then(setList, (err) => setError(err.message))
  }, [])

  async function changeShipping(order, estado_envio) {
    setError('')
    try {
      await api('admin_pedidos.php', { id: order.id, estado_envio })
      setList((prev) => prev.map((o) => (o.id === order.id ? { ...o, estado_envio } : o)))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section>
      <h2 className="admin__title">Pedidos</h2>
      {error && <ErrorNote>{error}</ErrorNote>}
      {!list ? (
        <p className="drawer__aside">Cargando los pedidos…</p>
      ) : list.length === 0 ? (
        <p className="drawer__aside">Todavía no hay pedidos.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente y envío</th>
                <th>Libros</th>
                <th className="num">Total</th>
                <th>Pago</th>
                <th>Envío</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td>
                    <span className="table__title">nº {o.id}</span>
                    <span className="table__sub">{dateTime(o.creado_en)}</span>
                  </td>
                  <td>
                    <span className="table__title">{o.cliente}</span>
                    <span className="table__sub">{o.email}</span>
                    <span className="table__sub">{addressLine(o)}</span>
                  </td>
                  <td>
                    {o.libros.map((l) => (
                      <span key={l.libro_id} className="table__line">
                        {l.cantidad} × {l.titulo}
                      </span>
                    ))}
                  </td>
                  <td className="num">{formatPrice(o.total)}</td>
                  <td>
                    <span className={`pill pill--${o.estado_pago}`}>{PAYMENT[o.estado_pago]}</span>
                    {o.pago && (
                      <span className="table__sub">
                        {o.pago.marca} ···· {o.pago.ultimos4}
                      </span>
                    )}
                    {o.pago?.motivo && <span className="table__sub">{o.pago.motivo}</span>}
                  </td>
                  <td>
                    {o.estado_pago === 'pagado' ? (
                      <select
                        className="admin__select"
                        value={o.estado_envio}
                        aria-label={`Estado de envío del pedido ${o.id}`}
                        onChange={(e) => changeShipping(o, e.target.value)}
                      >
                        {Object.entries(SHIPPING).map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="table__sub">Sin envío</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ErrorNote({ children }) {
  return (
    <p className="form__error" role="alert">
      {children}
    </p>
  )
}
