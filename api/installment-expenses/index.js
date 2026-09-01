import { sql } from '../_lib/db.js'
import { withErrorHandling, methodNotAllowed } from '../_lib/http.js'

export default withErrorHandling(async (req, res) => {
  if (req.method === 'GET') {
    const rows = await sql`
      SELECT ie.*, c.nombre AS categoria_nombre, t.nombre AS tarjeta_nombre
      FROM installment_expenses ie
      LEFT JOIN categories c ON c.id = ie.categoria_id
      LEFT JOIN cards t ON t.id = ie.tarjeta_id
      ORDER BY (ie.cuota_actual > ie.cuotas_totales), ie.fecha_inicio DESC
    `
    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    const { nombre, monto_cuota, cuotas_totales, cuota_actual, tarjeta_id, categoria_id, fecha_inicio } = req.body || {}
    if (!nombre || !monto_cuota || !cuotas_totales || !fecha_inicio) {
      return res.status(400).json({ error: 'nombre, monto_cuota, cuotas_totales y fecha_inicio son requeridos' })
    }
    if (cuotas_totales < 1) {
      return res.status(400).json({ error: 'cuotas_totales debe ser al menos 1' })
    }
    const [row] = await sql`
      INSERT INTO installment_expenses (nombre, monto_cuota, cuotas_totales, cuota_actual, tarjeta_id, categoria_id, fecha_inicio)
      VALUES (${nombre}, ${monto_cuota}, ${cuotas_totales}, ${cuota_actual || 1}, ${tarjeta_id || null}, ${categoria_id || null}, ${fecha_inicio})
      RETURNING *
    `
    return res.status(201).json(row)
  }

  return methodNotAllowed(res, ['GET', 'POST'])
})
