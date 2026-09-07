import { sql } from './db.js'
import { mesEfectivo, addMonths } from './billing-cycle.js'
import { computeProjectedGasto } from './projection.js'

// Resumen rápido de un mes para responder por WhatsApp: mismo criterio que
// el Resumen web (gasto = mes en que se hizo, no en que se paga), pero
// condensado a lo que entra cómodo en un mensaje de chat.
export async function resumenMes(mes) {
  const fechaDesdeQuery = `${addMonths(mes, -2)}-01`
  const fechaHastaQuery = `${addMonths(mes, 1)}-01`

  const [transactions, incomeRows] = await Promise.all([
    sql`
      SELECT t.monto, t.fecha, c.nombre AS categoria_nombre, cd.cierre_dia
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.categoria_id
      LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
      LEFT JOIN cards cd ON cd.id = pm.card_id
      WHERE t.fecha >= ${fechaDesdeQuery} AND t.fecha < ${fechaHastaQuery}
    `,
    sql`SELECT monto FROM income WHERE fecha >= ${`${mes}-01`} AND fecha < ${fechaHastaQuery}`,
  ])

  const porCategoria = new Map()
  let gastoSuelto = 0
  for (const t of transactions) {
    if (mesEfectivo(t.fecha, t.cierre_dia) !== mes) continue
    const monto = Number(t.monto)
    gastoSuelto += monto
    const key = t.categoria_nombre || 'Sin categoría'
    porCategoria.set(key, (porCategoria.get(key) || 0) + monto)
  }

  const { total: gastoComprometido, detalle } = await computeProjectedGasto(mes, 'devengado')
  for (const item of detalle) {
    const key = item.categoria_nombre || 'Sin categoría'
    porCategoria.set(key, (porCategoria.get(key) || 0) + item.monto)
  }

  const gastoTotal = gastoSuelto + gastoComprometido
  const ingresoTotal = incomeRows.reduce((acc, r) => acc + Number(r.monto), 0)
  const topCategorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  return { mes, ingresoTotal, gastoTotal, remanente: ingresoTotal - gastoTotal, topCategorias }
}

export function formatearResumenWhatsApp(r) {
  const fmt = (n) => `$${Math.round(n).toLocaleString('es-AR')}`
  const lineas = [
    `📊 Resumen de ${r.mes}`,
    `Ingresos: ${fmt(r.ingresoTotal)}`,
    `Gastos: ${fmt(r.gastoTotal)}`,
    r.remanente >= 0 ? `Te queda: ${fmt(r.remanente)}` : `Te falta: ${fmt(-r.remanente)}`,
  ]
  if (r.topCategorias.length > 0) {
    lineas.push('', 'Por categoría:')
    lineas.push(...r.topCategorias.map(([cat, monto]) => `• ${cat}: ${fmt(monto)}`))
  }
  return lineas.join('\n')
}
