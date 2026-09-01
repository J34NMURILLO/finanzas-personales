import { sql } from '../_lib/db.js'
import { withErrorHandling, methodNotAllowed } from '../_lib/http.js'

export default withErrorHandling(async (req, res) => {
  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM cards ORDER BY activa DESC, nombre`
    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
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
    // Cada tarjeta habilita automáticamente un método de pago asociado
    await sql`
      INSERT INTO payment_methods (tipo, card_id)
      VALUES ('tarjeta', ${card.id})
    `
    return res.status(201).json(card)
  }

  return methodNotAllowed(res, ['GET', 'POST'])
})
