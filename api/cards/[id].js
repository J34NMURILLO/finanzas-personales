import { sql } from '../_lib/db.js'
import { withErrorHandling, methodNotAllowed } from '../_lib/http.js'

export default withErrorHandling(async (req, res) => {
  const { id } = req.query

  if (req.method === 'PUT') {
    const { nombre, cierre_dia, vencimiento_dia, limite, activa } = req.body || {}
    if (!nombre || !cierre_dia || !vencimiento_dia) {
      return res.status(400).json({ error: 'nombre, cierre_dia y vencimiento_dia son requeridos' })
    }
    const [row] = await sql`
      UPDATE cards SET nombre = ${nombre}, cierre_dia = ${cierre_dia}, vencimiento_dia = ${vencimiento_dia},
        limite = ${limite || null}, activa = ${activa ?? true}
      WHERE id = ${id}
      RETURNING *
    `
    if (!row) return res.status(404).json({ error: 'Tarjeta no encontrada' })
    return res.status(200).json(row)
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM payment_methods WHERE card_id = ${id}`
    const [row] = await sql`DELETE FROM cards WHERE id = ${id} RETURNING id`
    if (!row) return res.status(404).json({ error: 'Tarjeta no encontrada' })
    return res.status(204).end()
  }

  return methodNotAllowed(res, ['PUT', 'DELETE'])
})
