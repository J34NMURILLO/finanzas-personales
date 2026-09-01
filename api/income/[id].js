import { sql } from '../_lib/db.js'
import { withErrorHandling, methodNotAllowed } from '../_lib/http.js'

export default withErrorHandling(async (req, res) => {
  const { id } = req.query

  if (req.method === 'PUT') {
    const { fecha, monto, tipo, cuenta_id, categoria_id } = req.body || {}
    if (!fecha || !monto || !tipo) {
      return res.status(400).json({ error: 'fecha, monto y tipo son requeridos' })
    }
    const [row] = await sql`
      UPDATE income SET fecha = ${fecha}, monto = ${monto}, tipo = ${tipo},
        cuenta_id = ${cuenta_id || null}, categoria_id = ${categoria_id || null}
      WHERE id = ${id}
      RETURNING *
    `
    if (!row) return res.status(404).json({ error: 'Ingreso no encontrado' })
    return res.status(200).json(row)
  }

  if (req.method === 'DELETE') {
    const [row] = await sql`DELETE FROM income WHERE id = ${id} RETURNING id`
    if (!row) return res.status(404).json({ error: 'Ingreso no encontrado' })
    return res.status(204).end()
  }

  return methodNotAllowed(res, ['PUT', 'DELETE'])
})
