import { sql } from '../_lib/db.js'
import { withErrorHandling, methodNotAllowed } from '../_lib/http.js'

export default withErrorHandling(async (req, res) => {
  const { id } = req.query

  if (req.method === 'PUT') {
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

  if (req.method === 'DELETE') {
    const [row] = await sql`DELETE FROM installment_expenses WHERE id = ${id} RETURNING id`
    if (!row) return res.status(404).json({ error: 'Compra en cuotas no encontrada' })
    return res.status(204).end()
  }

  return methodNotAllowed(res, ['PUT', 'DELETE'])
})
