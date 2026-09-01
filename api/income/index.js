import { sql } from '../_lib/db.js'
import { withErrorHandling, methodNotAllowed } from '../_lib/http.js'

export default withErrorHandling(async (req, res) => {
  if (req.method === 'GET') {
    const rows = await sql`
      SELECT i.*, a.nombre AS cuenta_nombre, c.nombre AS categoria_nombre
      FROM income i
      LEFT JOIN accounts a ON a.id = i.cuenta_id
      LEFT JOIN categories c ON c.id = i.categoria_id
      ORDER BY i.fecha DESC, i.id DESC
    `
    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    const { fecha, monto, tipo, cuenta_id, categoria_id } = req.body || {}
    if (!fecha || !monto || !tipo) {
      return res.status(400).json({ error: 'fecha, monto y tipo son requeridos' })
    }
    if (!['efectivo', 'digital'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser "efectivo" o "digital"' })
    }
    const [row] = await sql`
      INSERT INTO income (fecha, monto, tipo, cuenta_id, categoria_id)
      VALUES (${fecha}, ${monto}, ${tipo}, ${cuenta_id || null}, ${categoria_id || null})
      RETURNING *
    `
    return res.status(201).json(row)
  }

  return methodNotAllowed(res, ['GET', 'POST'])
})
