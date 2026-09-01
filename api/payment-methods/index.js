import { sql } from '../_lib/db.js'
import { withErrorHandling, methodNotAllowed } from '../_lib/http.js'

// Solo lectura: los métodos de pago se crean/borran automáticamente
// junto con las cuentas y tarjetas (ver /api/accounts y /api/cards).
export default withErrorHandling(async (req, res) => {
  if (req.method === 'GET') {
    const rows = await sql`
      SELECT
        pm.id,
        pm.tipo,
        pm.card_id,
        pm.account_id,
        COALESCE(c.nombre, a.nombre, 'Efectivo') AS nombre,
        c.activa AS card_activa,
        a.activa AS account_activa
      FROM payment_methods pm
      LEFT JOIN cards c ON c.id = pm.card_id
      LEFT JOIN accounts a ON a.id = pm.account_id
      ORDER BY pm.tipo, nombre
    `
    return res.status(200).json(rows)
  }

  return methodNotAllowed(res, ['GET'])
})
