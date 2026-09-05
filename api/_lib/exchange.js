// Cotización del dólar oficial (el que publica el Banco Nación). No hay una
// API oficial del BNA, así que se usan dos fuentes públicas que la replican:
// una para el valor del día y otra que además tiene el histórico por fecha,
// necesario para convertir un gasto viejo con la cotización de ese día.
const URL_HOY = 'https://dolarapi.com/v1/dolares/oficial'
const URL_HISTORICO = 'https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial'

const TTL_MS = 60 * 60 * 1000 // 1 hora
const cache = new Map()

function hoy() {
  return new Date().toISOString().slice(0, 10)
}

function guardar(clave, valor) {
  cache.set(clave, { valor, vence: Date.now() + TTL_MS })
  return valor
}

function leer(clave) {
  const item = cache.get(clave)
  if (!item || item.vence < Date.now()) return null
  return item.valor
}

// Se usa el valor de venta: es el que pagás cuando comprás en dólares.
function ventaDe(item) {
  const venta = Number(item?.venta)
  return Number.isFinite(venta) && venta > 0 ? venta : null
}

async function traer(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`La fuente de cotización respondió ${res.status}`)
  return res.json()
}

export async function cotizacionDelDia() {
  const cacheado = leer('hoy')
  if (cacheado) return cacheado
  const venta = ventaDe(await traer(URL_HOY))
  if (!venta) throw new Error('No se pudo leer la cotización del día')
  return guardar('hoy', venta)
}

// Cotización de una fecha puntual. Si esa fecha no está en el histórico
// (fin de semana, feriado o es hoy), se toma la última anterior disponible.
export async function cotizacionDeFecha(fecha) {
  const dia = String(fecha).slice(0, 10)
  if (dia >= hoy()) return cotizacionDelDia()

  const cacheado = leer(dia)
  if (cacheado) return cacheado

  const historico = await traer(URL_HISTORICO)
  const previas = historico.filter((c) => c.fecha <= dia).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  const venta = ventaDe(previas[0])
  if (!venta) return cotizacionDelDia()
  return guardar(dia, venta)
}

// Convierte a pesos. Si ya está en pesos no toca nada ni sale a la red.
export async function aPesos(monto, moneda, fecha = null) {
  const valor = Number(monto)
  if (moneda !== 'USD') return { pesos: valor, cotizacion: null }
  const cotizacion = fecha ? await cotizacionDeFecha(fecha) : await cotizacionDelDia()
  return { pesos: Math.round(valor * cotizacion * 100) / 100, cotizacion }
}
