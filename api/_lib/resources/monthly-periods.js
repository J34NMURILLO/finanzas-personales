import { sql } from '../db.js'
import { methodNotAllowed } from '../http.js'
import { runMonthlyClose } from '../monthly-close.js'
import { computeProjectedGasto, cargarCompromisos } from '../projection.js'

function toDateStr(fecha) {
  if (fecha instanceof Date) return fecha.toISOString().slice(0, 10)
  return fecha
}

// Los meses cerrados son historia y se leen tal cual. Los proyectados se
// recalculan en el momento: así, apenas cargás un gasto fijo o una cuota, la
// pantalla lo refleja sin esperar a que corra el cierre diario. El ingreso
// guardado se respeta porque puede haberlo editado el usuario a mano.
export default async function monthlyPeriods(req, res, id) {
  if (!id && req.method === 'GET') {
    const rows = await sql`SELECT * FROM monthly_periods ORDER BY anio_mes`
    const proyectados = rows.filter((r) => !r.cerrado)
    if (proyectados.length === 0) return res.status(200).json(rows)

    const compromisos = await cargarCompromisos()
    for (const row of proyectados) {
      const mes = toDateStr(row.anio_mes).slice(0, 7)
      const { total } = await computeProjectedGasto(mes, 'pago', compromisos)
      row.gastos_totales = total
      row.ahorro_real = Number(row.ingresos_totales) - total
    }
    return res.status(200).json(rows)
  }

  if (!id && req.method === 'POST') {
    const result = await runMonthlyClose()
    return res.status(200).json(result)
  }

  if (id && req.method === 'PUT') {
    const { ingresos_totales } = req.body || {}
    if (ingresos_totales == null || Number.isNaN(Number(ingresos_totales))) {
      return res.status(400).json({ error: 'ingresos_totales debe ser un número' })
    }
    const [periodo] = await sql`SELECT * FROM monthly_periods WHERE id = ${id}`
    if (!periodo) return res.status(404).json({ error: 'Período no encontrado' })
    if (periodo.cerrado) {
      return res.status(400).json({ error: 'Un mes ya cerrado no se puede editar' })
    }

    const ingresos = Number(ingresos_totales)
    const [row] = await sql`
      UPDATE monthly_periods
      SET ingresos_totales = ${ingresos}, ahorro_real = ${ingresos} - gastos_totales
      WHERE id = ${id}
      RETURNING *
    `
    return res.status(200).json(row)
  }

  return methodNotAllowed(res, id ? ['PUT'] : ['GET', 'POST'])
}
