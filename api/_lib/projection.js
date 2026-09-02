import { sql } from './db.js'
import { getCicloTarjeta, addMonths, monthsBetween } from './billing-cycle.js'

function toDateStr(fecha) {
  if (fecha instanceof Date) return fecha.toISOString().slice(0, 10)
  return fecha
}

// Para un gasto fijo con tarjeta, la ocurrencia de un mes calendario cae en
// el ciclo de ese mes o el siguiente según dia_del_mes vs cierre_dia. Para
// saber qué mes calendario "cae" en el mes de cierre `mes`, invertimos esa
// relación (es 1 a 1 porque dia_del_mes es fijo).
function mesCalendarioParaCiclo(mes, diaDelMes, cierreDia) {
  if (cierreDia == null) return mes
  return diaDelMes > cierreDia ? addMonths(mes, -1) : mes
}

// Número de cuota (1-indexado) que le corresponde a `mes` para una compra en
// cuotas, dado el ciclo de cierre en el que arrancó (o el mes calendario de
// inicio si no tiene tarjeta asociada).
function cuotaParaMes(mes, fechaInicio, cierreDia) {
  const inicioStr = toDateStr(fechaInicio)
  let cicloInicio = inicioStr.slice(0, 7)
  if (cierreDia != null) {
    const { anio, mes: mesCiclo } = getCicloTarjeta(inicioStr, cierreDia)
    cicloInicio = `${anio}-${String(mesCiclo).padStart(2, '0')}`
  }
  return monthsBetween(cicloInicio, mes) + 1
}

// Gasto proyectado para `mes` ('YYYY-MM') a partir de gastos fijos activos y
// cuotas de tarjeta activas. No incluye transacciones reales ya cargadas.
export async function computeProjectedGasto(mes) {
  const [fixedExpenses, installments] = await Promise.all([
    sql`
      SELECT fe.id, fe.nombre, fe.monto, fe.dia_del_mes, fe.activo_desde, fe.activo_hasta,
        cd.cierre_dia
      FROM fixed_expenses fe
      LEFT JOIN payment_methods pm ON pm.id = fe.payment_method_id
      LEFT JOIN cards cd ON cd.id = pm.card_id
    `,
    sql`
      SELECT ie.id, ie.nombre, ie.monto_cuota, ie.cuotas_totales, ie.cuota_actual, ie.fecha_inicio,
        c.cierre_dia
      FROM installment_expenses ie
      LEFT JOIN cards c ON c.id = ie.tarjeta_id
    `,
  ])

  const detalle = []
  let total = 0

  for (const fe of fixedExpenses) {
    const calMes = mesCalendarioParaCiclo(mes, fe.dia_del_mes, fe.cierre_dia)
    const activoDesde = toDateStr(fe.activo_desde).slice(0, 7)
    const activoHasta = fe.activo_hasta ? toDateStr(fe.activo_hasta).slice(0, 7) : null
    if (calMes < activoDesde) continue
    if (activoHasta && calMes > activoHasta) continue

    const monto = Number(fe.monto)
    total += monto
    detalle.push({ tipo: 'fijo', id: fe.id, nombre: fe.nombre, monto })
  }

  for (const ie of installments) {
    const k = cuotaParaMes(mes, ie.fecha_inicio, ie.cierre_dia)
    if (k < 1 || k > ie.cuotas_totales) continue
    if (k < ie.cuota_actual) continue // ya pagada

    const monto = Number(ie.monto_cuota)
    total += monto
    detalle.push({ tipo: 'cuota', id: ie.id, nombre: ie.nombre, monto, cuota: k, de: ie.cuotas_totales })
  }

  return { mes, total, detalle }
}

export { cuotaParaMes }
