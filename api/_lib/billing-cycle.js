// Atribuye una compra con tarjeta al mes de cierre (estado de cuenta) que le
// corresponde, no al mes calendario en que se hizo. Ej: cierre el día 28,
// compra el 29/09 => pertenece al cierre de octubre (no al de septiembre).

function daysInMonth(anio, mes) {
  return new Date(anio, mes, 0).getDate()
}

function clampDay(anio, mes, dia) {
  return Math.min(dia, daysInMonth(anio, mes))
}

function addMonth(anio, mes) {
  return mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 }
}

// El driver de Postgres devuelve las columnas `date` como objetos Date, no
// como 'YYYY-MM-DD'. Normalizamos siempre a string antes de operar.
function toDateStr(fecha) {
  if (fecha instanceof Date) return fecha.toISOString().slice(0, 10)
  return fecha
}

// fecha: 'YYYY-MM-DD' o Date. Devuelve { anio, mes } (mes 1-indexado) del ciclo de cierre.
export function getCicloTarjeta(fecha, cierreDia) {
  const [anio, mes, dia] = toDateStr(fecha).split('-').map(Number)
  const cierreDelMes = clampDay(anio, mes, cierreDia)
  return dia <= cierreDelMes ? { anio, mes } : addMonth(anio, mes)
}

// Fecha de vencimiento (pago) del ciclo que cierra en { anio, mes }.
export function getFechaVencimiento(cicloAnio, cicloMes, vencimientoDia, cierreDia) {
  const target = vencimientoDia <= cierreDia ? addMonth(cicloAnio, cicloMes) : { anio: cicloAnio, mes: cicloMes }
  const dia = clampDay(target.anio, target.mes, vencimientoDia)
  return `${target.anio}-${String(target.mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

// Mes efectivo ('YYYY-MM') al que se atribuye una transacción: el ciclo de
// cierre si es con tarjeta, o el mes calendario si es cuenta/efectivo.
export function mesEfectivo(fecha, cierreDia) {
  if (cierreDia == null) return toDateStr(fecha).slice(0, 7)
  const { anio, mes } = getCicloTarjeta(fecha, cierreDia)
  return `${anio}-${String(mes).padStart(2, '0')}`
}

// Suma/resta meses a un string 'YYYY-MM'.
export function addMonths(yyyyMm, delta) {
  const [y, m] = yyyyMm.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const anio = Math.floor(total / 12)
  const mes = (total % 12) + 1
  return `${anio}-${String(mes).padStart(2, '0')}`
}

// Diferencia en meses entre dos 'YYYY-MM' (b - a).
export function monthsBetween(a, b) {
  const [ya, ma] = a.split('-').map(Number)
  const [yb, mb] = b.split('-').map(Number)
  return (yb * 12 + mb) - (ya * 12 + ma)
}
