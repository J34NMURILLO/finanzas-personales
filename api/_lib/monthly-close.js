import { sql } from './db.js'
import { mesEfectivo, addMonths } from './billing-cycle.js'
import { computeProjectedGasto, cuotaParaMes } from './projection.js'

const MESES_PROYECCION = 12
const MESES_RETENCION = 24

function toDateStr(fecha) {
  if (fecha instanceof Date) return fecha.toISOString().slice(0, 10)
  return fecha
}

async function ingresosGastosReales(mes) {
  const desde = `${mes}-01`
  const hasta = `${addMonths(mes, 1)}-01`
  const [incomeRows, txRows] = await Promise.all([
    sql`SELECT monto FROM income WHERE fecha >= ${desde} AND fecha < ${hasta}`,
    sql`
      SELECT t.monto, t.fecha, cd.cierre_dia
      FROM transactions t
      LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
      LEFT JOIN cards cd ON cd.id = pm.card_id
      WHERE t.fecha >= ${addMonths(mes, -1) + '-01'} AND t.fecha < ${hasta}
    `,
  ])
  const ingresos = incomeRows.reduce((acc, r) => acc + Number(r.monto), 0)
  const gastos = txRows
    .filter((t) => mesEfectivo(t.fecha, t.cierre_dia) === mes)
    .reduce((acc, r) => acc + Number(r.monto), 0)
  return { ingresos, gastos }
}

async function upsertPeriodo(mes, { ingresos, gastos, cerrado }) {
  const anioMes = `${mes}-01`
  const [existente] = await sql`SELECT id, cerrado FROM monthly_periods WHERE anio_mes = ${anioMes}`
  const ahorro = ingresos - gastos

  if (existente) {
    // Un período ya cerrado nunca se pisa con una proyección.
    if (existente.cerrado && !cerrado) return
    await sql`
      UPDATE monthly_periods
      SET ingresos_totales = ${ingresos}, gastos_totales = ${gastos}, ahorro_real = ${ahorro}, cerrado = ${cerrado}
      WHERE id = ${existente.id}
    `
  } else {
    await sql`
      INSERT INTO monthly_periods (anio_mes, ingresos_totales, gastos_totales, ahorro_real, cerrado)
      VALUES (${anioMes}, ${ingresos}, ${gastos}, ${ahorro}, ${cerrado})
    `
  }
}

// Avanza cuota_actual de las compras en cuotas cuya cuota vigente
// corresponde justo al mes que se está cerrando.
async function avanzarCuotas(mes) {
  const installments = await sql`
    SELECT ie.id, ie.cuota_actual, ie.cuotas_totales, ie.fecha_inicio, c.cierre_dia
    FROM installment_expenses ie
    LEFT JOIN cards c ON c.id = ie.tarjeta_id
    WHERE ie.cuota_actual <= ie.cuotas_totales
  `
  for (const ie of installments) {
    const k = cuotaParaMes(mes, ie.fecha_inicio, ie.cierre_dia)
    if (k === ie.cuota_actual) {
      await sql`UPDATE installment_expenses SET cuota_actual = ${ie.cuota_actual + 1} WHERE id = ${ie.id}`
    }
  }
}

// Cuenta transacciones más viejas que la ventana de retención. La purga real
// (exportar a CSV y borrar) requiere un destino de almacenamiento (Vercel
// Blob) que todavía no está configurado — por ahora solo se reporta.
async function chequearRetencion(mes) {
  const cutoff = `${addMonths(mes, -(MESES_RETENCION - 1))}-01`
  const [{ count }] = await sql`SELECT count(*) FROM transactions WHERE fecha < ${cutoff}`
  const cantidad = Number(count)
  if (cantidad === 0) return null
  return {
    cantidad,
    cutoff,
    purgado: false,
    motivo: 'Faltan configurar BLOB_READ_WRITE_TOKEN (Vercel Blob) para exportar a CSV antes de purgar.',
  }
}

async function cerrarMes(mes) {
  const { ingresos, gastos } = await ingresosGastosReales(mes)
  await upsertPeriodo(mes, { ingresos, gastos, cerrado: true })
  await avanzarCuotas(mes)
  const retencion = await chequearRetencion(mes)
  return { mes, ingresos, gastos, ahorro: ingresos - gastos, retencion }
}

// Refresca la ventana proyectada completa (los MESES_PROYECCION meses
// siguientes al último mes cerrado) a partir del estado actual de gastos
// fijos y cuotas. Se corre siempre, no solo cuando hay un mes nuevo para
// cerrar, para que un alta/baja de un gasto fijo se refleje sin esperar
// al próximo cierre real.
async function refrescarProyeccion() {
  const [ultimoCerrado] = await sql`
    SELECT anio_mes, ingresos_totales FROM monthly_periods WHERE cerrado = true ORDER BY anio_mes DESC LIMIT 1
  `
  if (!ultimoCerrado) return []

  const baseMes = toDateStr(ultimoCerrado.anio_mes).slice(0, 7)
  const ingresosBase = Number(ultimoCerrado.ingresos_totales)

  const proyectados = []
  for (let i = 1; i <= MESES_PROYECCION; i++) {
    const mes = addMonths(baseMes, i)
    const { total: gastos } = await computeProjectedGasto(mes)
    await upsertPeriodo(mes, { ingresos: ingresosBase, gastos, cerrado: false })
    proyectados.push({ mes, ingresos: ingresosBase, gastos })
  }
  return proyectados
}

// Cierra todos los meses calendario completos que todavía no estén
// marcados como cerrados, desde el último cierre (o el mes anterior al
// actual si nunca se cerró nada) hasta el mes calendario anterior a hoy, y
// siempre refresca la ventana de proyección de los próximos 12 meses.
// Idempotente: correrlo de nuevo el mismo día no duplica ni retrocede nada.
export async function runMonthlyClose() {
  const mesActual = new Date().toISOString().slice(0, 7)
  const mesLimite = addMonths(mesActual, -1)

  const [ultimoCerrado] = await sql`
    SELECT anio_mes FROM monthly_periods WHERE cerrado = true ORDER BY anio_mes DESC LIMIT 1
  `
  let cursor = ultimoCerrado ? addMonths(toDateStr(ultimoCerrado.anio_mes).slice(0, 7), 1) : mesLimite

  const cerrados = []
  while (cursor <= mesLimite) {
    cerrados.push(await cerrarMes(cursor))
    cursor = addMonths(cursor, 1)
  }

  const proyectados = await refrescarProyeccion()

  return { ok: true, cerrados, proyectados }
}
