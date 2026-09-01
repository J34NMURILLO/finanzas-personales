import { sql } from '../db.js'
import { methodNotAllowed } from '../http.js'

export default async function cards(req, res, id) {
  if (!id && req.method === 'GET') {
    const rows = await sql`SELECT * FROM cards ORDER BY activa DESC, nombre`
    return res.status(200).json(rows)
  }

  if (!id && req.method === 'POST') {
    const { nombre, cierre_dia, vencimiento_dia, limite, activa } = req.body || {}
    if (!nombre || !cierre_dia || !vencimiento_dia) {
      return res.status(400).json({ error: 'nombre, cierre_dia y vencimiento_dia son requeridos' })
    }
    if (cierre_dia < 1 || cierre_dia > 31 || vencimiento_dia < 1 || vencimiento_dia > 31) {
      return res.status(400).json({ error: 'los días deben estar entre 1 y 31' })
    }
    const [card] = await sql`
      INSERT INTO cards (nombre, cierre_dia, vencimiento_dia, limite, activa)
      VALUES (${nombre}, ${cierre_dia}, ${vencimiento_dia}, ${limite || null}, ${activa ?? true})
      RETURNING *
    `
    await sql`INSERT INTO payment_methods (tipo, card_id) VALUES ('tarjeta', ${card.id})`
    return res.status(201).json(card)
  }

  if (id && req.method === 'PUT') {
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

  if (id && req.method === 'DELETE') {
    await sql`DELETE FROM payment_methods WHERE card_id = ${id}`
    const [row] = await sql`DELETE FROM cards WHERE id = ${id} RETURNING id`
    if (!row) return res.status(404).json({ error: 'Tarjeta no encontrada' })
    return res.status(204).end()
  }

  return methodNotAllowed(res, id ? ['PUT', 'DELETE'] : ['GET', 'POST'])
}
