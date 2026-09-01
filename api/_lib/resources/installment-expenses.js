import { sql } from '../db.js'
import { methodNotAllowed } from '../http.js'

export default async function installmentExpenses(req, res, id) {
  if (!id && req.method === 'GET') {
    const rows = await sql`
      SELECT ie.*, c.nombre AS categoria_nombre, t.nombre AS tarjeta_nombre
      FROM installment_expenses ie
      LEFT JOIN categories c ON c.id = ie.categoria_id
      LEFT JOIN cards t ON t.id = ie.tarjeta_id
      ORDER BY (ie.cuota_actual > ie.cuotas_totales), ie.fecha_inicio DESC
    `
    return res.status(200).json(rows)
  }

  if (!id && req.method === 'POST') {
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

  if (id && req.method === 'PUT') {
    const { nombre, monto_cuota, cuotas_totales, cuota_actual, tarjeta_id, categoria_id, fecha_inicio } = req.body || {}
    if (!nombre || !monto_cuota || !cuotas_totales || !fecha_inicio) {
      return res.status(400).json({ error: 'nombre, monto_cuota, cuotas_totales y fecha_inicio son requeridos' })
    }
    const [row] = await sql`
      UPDATE installment_expenses SET nombre = ${nombre}, monto_cuota = ${monto_cuota},
        cuotas_totales = ${cuotas_totales}, cuota_actual = ${cuota_actual || 1},
        tarjeta_id = ${tarjeta_id || null}, categoria_id = ${categoria_id || null}, fecha_inicio = ${fecha_inicio}
      WHERE id = ${id}
      RETURNING *
    `
    if (!row) return res.status(404).json({ error: 'Compra en cuotas no encontrada' })
    return res.status(200).json(row)
  }

  if (id && req.method === 'DELETE') {
    const [row] = await sql`DELETE FROM installment_expenses WHERE id = ${id} RETURNING id`
    if (!row) return res.status(404).json({ error: 'Compra en cuotas no encontrada' })
    return res.status(204).end()
  }

  return methodNotAllowed(res, id ? ['PUT', 'DELETE'] : ['GET', 'POST'])
}
