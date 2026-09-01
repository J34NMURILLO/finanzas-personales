import { sql } from '../_lib/db.js'
import { withErrorHandling, methodNotAllowed } from '../_lib/http.js'

export default withErrorHandling(async (req, res) => {
  const { id } = req.query

  if (req.method === 'PUT') {
    const { nombre, monto, dia_del_mes, categoria_id, payment_method_id, activo_desde, activo_hasta } = req.body || {}
    if (!nombre || !monto || !dia_del_mes || !activo_desde) {
      return res.status(400).json({ error: 'nombre, monto, dia_del_mes y activo_desde son requeridos' })
    }
    const [row] = await sql`
      UPDATE fixed_expenses SET nombre = ${nombre}, monto = ${monto}, dia_del_mes = ${dia_del_mes},
        categoria_id = ${categoria_id || null}, payment_method_id = ${payment_method_id || null},
        activo_desde = ${activo_desde}, activo_hasta = ${activo_hasta || null}
      WHERE id = ${id}
      RETURNING *
    `
    if (!row) return res.status(404).json({ error: 'Gasto fijo no encontrado' })
    return res.status(200).json(row)
  }

  if (req.method === 'DELETE') {
    const [row] = await sql`DELETE FROM fixed_expenses WHERE id = ${id} RETURNING id`
    if (!row) return res.status(404).json({ error: 'Gasto fijo no encontrado' })
    return res.status(204).end()
  }

  return methodNotAllowed(res, ['PUT', 'DELETE'])
})
