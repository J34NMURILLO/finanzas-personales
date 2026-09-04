import { sql } from '../db.js'
import { methodNotAllowed } from '../http.js'
import { runMonthlyClose } from '../monthly-close.js'

// Las filas las genera el motor de cierre mensual (ver monthly-close.js). El
// POST dispara ese cierre a mano desde la app: a diferencia de /api/cron (que
// corre desde la infraestructura de Vercel y por eso exige CRON_SECRET), esta
// ruta queda detrás de la protección del sitio. El PUT permite corregir el
// ingreso proyectado de un mes, que varía y no siempre está declarado.
export default async function monthlyPeriods(req, res, id) {
  if (!id && req.method === 'GET') {
    const rows = await sql`SELECT * FROM monthly_periods ORDER BY anio_mes`
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
