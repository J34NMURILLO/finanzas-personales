import { sql } from '../_lib/db.js'
import { withErrorHandling, methodNotAllowed } from '../_lib/http.js'

export default withErrorHandling(async (req, res) => {
  const { id } = req.query

  if (req.method === 'PUT') {
    const { nombre, tipo, moneda, activa } = req.body || {}
    if (!nombre || !tipo) {
      return res.status(400).json({ error: 'nombre y tipo son requeridos' })
    }
    const [row] = await sql`
      UPDATE accounts SET nombre = ${nombre}, tipo = ${tipo}, moneda = ${moneda || 'ARS'}, activa = ${activa ?? true}
      WHERE id = ${id}
      RETURNING *
    `
    if (!row) return res.status(404).json({ error: 'Cuenta no encontrada' })
    return res.status(200).json(row)
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM payment_methods WHERE account_id = ${id}`
    const [row] = await sql`DELETE FROM accounts WHERE id = ${id} RETURNING id`
    if (!row) return res.status(404).json({ error: 'Cuenta no encontrada' })
    return res.status(204).end()
  }

  return methodNotAllowed(res, ['PUT', 'DELETE'])
})
