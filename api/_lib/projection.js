import { sql } from './db.js'
import { getCicloTarjeta, addMonths, monthsBetween, offsetVencimiento } from './billing-cycle.js'

function toDateStr(fecha) {
  if (fecha instanceof Date) return fecha.toISOString().slice(0, 10)
  return fecha
}

// Todo se imputa al mes en que la plata sale del bolsillo (mes de pago).
// Para un gasto con tarjeta eso son dos corrimientos posibles respecto del
// mes calendario en que ocurre: uno si el día cae después del cierre, y otro
// si el vencimiento del resumen cae el mes siguiente al cierre.
function offsetPagoGastoFijo(diaDelMes, cierreDia, vencimientoDia) {
  if (cierreDia == null) return 0
  const cruzaCierre = diaDelMes > cierreDia ? 1 : 0
  return cruzaCierre + offsetVencimiento(cierreDia, vencimientoDia ?? cierreDia)
}

// Número de cuota (1-indexado) que se paga en `mes`, o null si en ese mes no
// cae ninguna cuota de esta compra.
export function cuotaParaMesDePago(mes, fechaInicio, cierreDia, vencimientoDia, cuotasTotales, cuotaActual) {
  const inicioStr = toDateStr(fechaInicio)

  let cicloInicio = inicioStr.slice(0, 7)
  let vOffset = 0
  if (cierreDia != null) {
    const { anio, mes: mesCiclo } = getCicloTarjeta(inicioStr, cierreDia)
    cicloInicio = `${anio}-${String(mesCiclo).padStart(2, '0')}`
    vOffset = offsetVencimiento(cierreDia, vencimientoDia ?? cierreDia)
  }

  const cicloDelMes = addMonths(mes, -vOffset)
  const k = monthsBetween(cicloInicio, cicloDelMes) + 1

  if (k < 1 || k > cuotasTotales) return null
  if (k < cuotaActual) return null // cuota ya pagada
  return k
}

// El usuario piensa en "cuándo pago la próxima cuota", no en "cuándo compré".
// Estas dos funciones traducen entre esa fecha de pago y el fecha_inicio que
// guarda la base, teniendo en cuenta el ciclo de la tarjeta.
export function fechaInicioDesdeProximaCuota(proximaCuota, cuotaActual, cierreDia, vencimientoDia) {
  const mesPago = toDateStr(proximaCuota).slice(0, 7)
  const vOffset = cierreDia == null ? 0 : offsetVencimiento(cierreDia, vencimientoDia ?? cierreDia)
  const cicloInicio = addMonths(addMonths(mesPago, -vOffset), -((cuotaActual || 1) - 1))
  return `${cicloInicio}-01`
}

export function proximaCuotaDesdeFechaInicio(fechaInicio, cuotaActual, cierreDia, vencimientoDia) {
  const inicioStr = toDateStr(fechaInicio)
  let cicloInicio = inicioStr.slice(0, 7)
  let vOffset = 0
  if (cierreDia != null) {
    const { anio, mes } = getCicloTarjeta(inicioStr, cierreDia)
    cicloInicio = `${anio}-${String(mes).padStart(2, '0')}`
    vOffset = offsetVencimiento(cierreDia, vencimientoDia ?? cierreDia)
  }
  const mesPago = addMonths(addMonths(cicloInicio, (cuotaActual || 1) - 1), vOffset)
  const dia = vencimientoDia ?? Number(inicioStr.slice(8, 10))
  return `${mesPago}-${String(Math.min(dia || 1, 28)).padStart(2, '0')}`
}

// Gastos comprometidos de `mes` ('YYYY-MM'): gastos fijos activos + cuotas
// pendientes que se pagan ese mes. No incluye las transacciones sueltas ya
// cargadas (esas se suman aparte, en reports.js).
export async function computeProjectedGasto(mes) {
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
    const offset = offsetPagoGastoFijo(fe.dia_del_mes, fe.cierre_dia, fe.vencimiento_dia)
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
    const k = cuotaParaMesDePago(
      mes,
      ie.fecha_inicio,
      ie.cierre_dia,
      ie.vencimiento_dia,
      ie.cuotas_totales,
      ie.cuota_actual,
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
