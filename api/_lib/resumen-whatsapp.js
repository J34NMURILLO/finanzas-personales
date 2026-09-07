import { sql } from './db.js'
import { mesEfectivo, mesDePago, addMonths } from './billing-cycle.js'
import { computeProjectedGasto, cargarCompromisos } from './projection.js'

// Mismo criterio que el Resumen web: lo gastado en `mes` (transacciones +
// gastos fijos + cuotas, por el mes en que se hicieron, no en que se pagan),
// más cómo viene el sueldo del mes siguiente una vez pagado todo lo que
// vence ahí. Sin recortar categorías — la versión anterior cortaba a las
// primeras 5 y escondía cuotas que caían en categorías más chicas.
export async function resumenMes(mes) {
  const mesSiguiente = addMonths(mes, 1)
  const fechaDesdeQuery = `${addMonths(mes, -2)}-01`
  const fechaHastaQuery = `${addMonths(mesSiguiente, 1)}-01`

  const [transactions, incomeRows] = await Promise.all([
    sql`
      SELECT t.monto, t.fecha, t.categoria_id, c.nombre AS categoria_nombre,
        pm.card_id, cd.cierre_dia, cd.vencimiento_dia
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.categoria_id
      LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
      LEFT JOIN cards cd ON cd.id = pm.card_id
      WHERE t.fecha >= ${fechaDesdeQuery} AND t.fecha < ${fechaHastaQuery}
    `,
    sql`SELECT fecha, monto FROM income WHERE fecha >= ${`${mes}-01`} AND fecha < ${fechaHastaQuery}`,
  ])

  const mesDe = (fecha) => (fecha instanceof Date ? fecha.toISOString().slice(0, 7) : String(fecha).slice(0, 7))

  const porCategoria = new Map()
  let gastoSuelto = 0
  for (const t of transactions) {
    if (mesEfectivo(t.fecha, t.cierre_dia) !== mes) continue
    const monto = Number(t.monto)
    gastoSuelto += monto
    const key = t.categoria_nombre || 'Sin categoría'
    porCategoria.set(key, (porCategoria.get(key) || 0) + monto)
  }

  const compromisos = await cargarCompromisos()
  const { total: gastoComprometido, detalle } = await computeProjectedGasto(mes, 'devengado', compromisos)
  for (const item of detalle) {
    const key = item.categoria_nombre || 'Sin categoría'
    porCategoria.set(key, (porCategoria.get(key) || 0) + item.monto)
  }

  const gastoDelMes = gastoSuelto + gastoComprometido

  // Mes siguiente: qué vence ahí (mes_de_pago), no qué se devengó ese mes.
  const gastosSiguienteSueltos = transactions
    .filter((t) => mesDePago(t.fecha, t.cierre_dia, t.vencimiento_dia) === mesSiguiente)
    .reduce((acc, t) => acc + Number(t.monto), 0)
  const { total: gastosSiguienteComprometidos } = await computeProjectedGasto(mesSiguiente, 'pago', compromisos)
  const ingresoSiguiente = incomeRows
    .filter((r) => mesDe(r.fecha) === mesSiguiente)
    .reduce((acc, r) => acc + Number(r.monto), 0)
  const gastoSiguiente = gastosSiguienteSueltos + gastosSiguienteComprometidos

  return {
    mes,
    gastoDelMes,
    porCategoria: [...porCategoria.entries()].sort((a, b) => b[1] - a[1]),
    mesSiguiente: {
      mes: mesSiguiente,
      ingresos: ingresoSiguiente,
      gastos: gastoSiguiente,
      remanente: ingresoSiguiente - gastoSiguiente,
    },
  }
}

export function formatearResumenWhatsApp(r) {
  const fmt = (n) => `$${Math.round(n).toLocaleString('es-AR')}`
  const lineas = [`📊 Gastado en ${r.mes}: ${fmt(r.gastoDelMes)}`, '']

  if (r.porCategoria.length > 0) {
    lineas.push('Por categoría:')
    lineas.push(...r.porCategoria.map(([cat, monto]) => `• ${cat}: ${fmt(monto)}`))
    lineas.push('')
  }

  const ms = r.mesSiguiente
  lineas.push(`💰 Sueldo de ${ms.mes}: ${ms.ingresos > 0 ? fmt(ms.ingresos) : 'todavía no lo declaraste'}`)
  lineas.push(`Ya comprometido para ese mes: ${fmt(ms.gastos)}`)
  lineas.push(
    ms.remanente >= 0 ? `Te va a quedar: ${fmt(ms.remanente)}` : `Te va a faltar: ${fmt(-ms.remanente)}`,
  )

  return lineas.join('\n')
}
