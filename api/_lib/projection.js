import { sql } from './db.js'
import { getCicloTarjeta, getFechaVencimiento, addMonths, monthsBetween, offsetVencimiento } from './billing-cycle.js'

function toDateStr(fecha) {
  if (fecha instanceof Date) return fecha.toISOString().slice(0, 10)
  return fecha
}

// Hay dos preguntas distintas y cada pantalla usa la que le sirve:
//   'devengado' -> ¿en qué mes se hizo el gasto? (a qué resumen de la tarjeta
//                  entra). Es lo que muestra el Resumen del mes.
//   'pago'      -> ¿en qué mes sale la plata? (vencimiento de ese resumen).
//                  Es lo que consume el sueldo y usa la Proyección.
// La diferencia entre las dos es un mes cuando el vencimiento cae después del
// cierre; para efectivo y cuentas son la misma cosa.
function offsetCriterio(criterio, cierreDia, vencimientoDia) {
  if (cierreDia == null || criterio !== 'pago') return 0
  return offsetVencimiento(cierreDia, vencimientoDia ?? cierreDia)
}

function cicloDeCompra(fechaInicio, cierreDia) {
  const inicioStr = toDateStr(fechaInicio)
  if (cierreDia == null) return inicioStr.slice(0, 7)
  const { anio, mes } = getCicloTarjeta(inicioStr, cierreDia)
  return `${anio}-${String(mes).padStart(2, '0')}`
}

// Número de cuota (1-indexado) que corresponde a `mes` según el criterio, o
// null si en ese mes no cae ninguna cuota pendiente de esta compra.
export function cuotaParaMes(
  mes,
  fechaInicio,
  cierreDia,
  vencimientoDia,
  cuotasTotales,
  cuotaActual,
  criterio = 'pago',
) {
  const cicloInicio = cicloDeCompra(fechaInicio, cierreDia)
  const cicloDelMes = addMonths(mes, -offsetCriterio(criterio, cierreDia, vencimientoDia))
  const k = monthsBetween(cicloInicio, cicloDelMes) + 1

  if (k < 1 || k > cuotasTotales) return null
  if (k < cuotaActual) return null // cuota ya pagada
  return k
}

// El usuario carga "en qué mes cae la cuota actual"; la base guarda la fecha
// de la compra original. El día no se pregunta: lo define la tarjeta.
export function fechaInicioDesdeMesCuotaActual(mesCuotaActual, cuotaActual) {
  const cicloInicio = addMonths(mesCuotaActual.slice(0, 7), -((cuotaActual || 1) - 1))
  return `${cicloInicio}-01`
}

export function mesCuotaActualDesdeFechaInicio(fechaInicio, cuotaActual, cierreDia) {
  return addMonths(cicloDeCompra(fechaInicio, cierreDia), (cuotaActual || 1) - 1)
}

// Fecha concreta en que se paga la cuota vigente, heredada de la tarjeta.
export function fechaPagoCuotaActual(fechaInicio, cuotaActual, cierreDia, vencimientoDia) {
  const cicloCuota = mesCuotaActualDesdeFechaInicio(fechaInicio, cuotaActual, cierreDia)
  const [anio, mes] = cicloCuota.split('-').map(Number)
  if (cierreDia == null) return `${cicloCuota}-01`
  return getFechaVencimiento(anio, mes, vencimientoDia ?? cierreDia, cierreDia)
}

// Gastos comprometidos de `mes`: gastos fijos activos + cuotas pendientes.
// No incluye las transacciones sueltas ya cargadas (se suman en reports.js).
export async function computeProjectedGasto(mes, criterio = 'pago') {
  const [fixedExpenses, installments] = await Promise.all([
    sql`
      SELECT fe.id, fe.nombre, fe.monto, fe.dia_del_mes, fe.activo_desde, fe.activo_hasta,
        fe.categoria_id, cat.nombre AS categoria_nombre, cat.color AS categoria_color,
        cd.cierre_dia, cd.vencimiento_dia,
        COALESCE(cd.nombre, ac.nombre, 'Efectivo') AS medio_nombre, cd.id AS card_id
      FROM fixed_expenses fe
      LEFT JOIN categories cat ON cat.id = fe.categoria_id
      LEFT JOIN payment_methods pm ON pm.id = fe.payment_method_id
      LEFT JOIN cards cd ON cd.id = pm.card_id
      LEFT JOIN accounts ac ON ac.id = pm.account_id
    `,
    sql`
      SELECT ie.id, ie.nombre, ie.monto_cuota, ie.cuotas_totales, ie.cuota_actual, ie.fecha_inicio,
        ie.categoria_id, cat.nombre AS categoria_nombre, cat.color AS categoria_color,
        c.cierre_dia, c.vencimiento_dia, c.nombre AS medio_nombre, c.id AS card_id
      FROM installment_expenses ie
      LEFT JOIN categories cat ON cat.id = ie.categoria_id
      LEFT JOIN cards c ON c.id = ie.tarjeta_id
    `,
  ])

  const detalle = []
  let total = 0

  for (const fe of fixedExpenses) {
    // Un gasto fijo con tarjeta que cae después del cierre entra al resumen
    // del mes siguiente; si además el vencimiento corre un mes, se paga un
    // mes más tarde todavía.
    const cruzaCierre = fe.cierre_dia != null && fe.dia_del_mes > fe.cierre_dia ? 1 : 0
    const offset = cruzaCierre + offsetCriterio(criterio, fe.cierre_dia, fe.vencimiento_dia)
    const mesCalendario = addMonths(mes, -offset)

    const activoDesde = toDateStr(fe.activo_desde).slice(0, 7)
    const activoHasta = fe.activo_hasta ? toDateStr(fe.activo_hasta).slice(0, 7) : null
    if (mesCalendario < activoDesde) continue
    if (activoHasta && mesCalendario > activoHasta) continue

    const monto = Number(fe.monto)
    total += monto
    detalle.push({
      tipo: 'fijo',
      id: fe.id,
      nombre: fe.nombre,
      monto,
      categoria_id: fe.categoria_id,
      categoria_nombre: fe.categoria_nombre,
      categoria_color: fe.categoria_color,
      medio_nombre: fe.medio_nombre,
      card_id: fe.card_id,
    })
  }

  for (const ie of installments) {
    const k = cuotaParaMes(
      mes,
      ie.fecha_inicio,
      ie.cierre_dia,
      ie.vencimiento_dia,
      ie.cuotas_totales,
      ie.cuota_actual,
      criterio,
    )
    if (k == null) continue

    const monto = Number(ie.monto_cuota)
    total += monto
    detalle.push({
      tipo: 'cuota',
      id: ie.id,
      nombre: `${ie.nombre} (cuota ${k}/${ie.cuotas_totales})`,
      monto,
      categoria_id: ie.categoria_id,
      categoria_nombre: ie.categoria_nombre,
      categoria_color: ie.categoria_color,
      medio_nombre: ie.medio_nombre,
      card_id: ie.card_id,
    })
  }

  return { mes, total, detalle }
}
