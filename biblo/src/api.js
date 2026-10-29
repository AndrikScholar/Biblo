// La API en PHP que sirve XAMPP (carpeta api/ del repo, enlazada en
// C:\xampp\htdocs\biblo-api). `credentials: 'include'` manda la cookie de
// sesión de PHP aunque Apache esté en otro puerto que Vite.
const API_URL = 'http://localhost/biblo-api/'

export async function api(path, body) {
  const res = await fetch(API_URL + path, {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || 'No se pudo hablar con el servidor.')
  return data
}

export function stockLabel(stock) {
  if (stock === 0) return 'Agotado'
  return stock === 1 ? 'Queda 1 ejemplar' : `Quedan ${stock} ejemplares`
}

export function formatDate(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
}

export function addressLine(a) {
  const number = a.num_interior ? `${a.num_exterior}, int. ${a.num_interior}` : a.num_exterior
  return `${a.calle} ${number}, ${a.colonia}, C. P. ${a.codigo_postal}, ${a.ciudad}, ${a.estado}`
}
