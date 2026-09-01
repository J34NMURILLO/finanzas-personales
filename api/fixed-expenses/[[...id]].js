import { sql } from '../_lib/db.js'
import { withErrorHandling, methodNotAllowed } from '../_lib/http.js'

export default withErrorHandling(async (req, res) => {
  const id = req.query.id?.[0]

  if (!id && req.method === 'GET') {
    const rows = await sql`
      SELECT fe.*, c.nombre AS categoria_nombre,
        COALESCE(cd.nombre, ac.nombre, 'Efectivo') AS payment_method_nombre
      FROM fixed_expenses fe
      LEFT JOIN categories c ON c.id = fe.categoria_id
      LEFT JOIN payment_methods pm ON pm.id = fe.payment_method_id
      LEFT JOIN cards cd ON cd.id = pm.card_id
      LEFT JOIN accounts ac ON ac.id = pm.account_id
      ORDER BY (fe.activo_hasta IS NOT NULL AND fe.activo_hasta < CURRENT_DATE), fe.dia_del_mes
    `
    return res.status(200).json(rows)
  }

  if (!id && req.method === 'POST') {
    const { nombre, monto, dia_del_mes, categoria_id, payment_method_id, activo_desde, activo_hasta } = req.body || {}
    if (!nombre || !monto || !dia_del_mes || !activo_desde) {
      return res.status(400).json({ error: 'nombre, monto, dia_del_mes y activo_desde son requeridos' })
    }
    if (dia_del_mes < 1 || dia_del_mes > 31) {
      return res.status(400).json({ error: 'dia_del_mes debe estar entre 1 y 31' })
    }
    const [row] = await sql`
      INSERT INTO fixed_expenses (nombre, monto, dia_del_mes, categoria_id, payment_method_id, activo_desde, activo_hasta)
      VALUES (${nombre}, ${monto}, ${dia_del_mes}, ${categoria_id || null}, ${payment_method_id || null}, ${activo_desde}, ${activo_hasta || null})
      RETURNING *
    `
    return res.status(201).json(row)
  }

  if (id && req.method === 'PUT') {
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

  if (id && req.method === 'DELETE') {
    const [row] = await sql`DELETE FROM fixed_expenses WHERE id = ${id} RETURNING id`
    if (!row) return res.status(404).json({ error: 'Gasto fijo no encontrado' })
    return res.status(204).end()
  }

  return methodNotAllowed(res, id ? ['PUT', 'DELETE'] : ['GET', 'POST'])
})
