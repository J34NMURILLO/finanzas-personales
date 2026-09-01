import { sql } from '../_lib/db.js'
import { withErrorHandling, methodNotAllowed } from '../_lib/http.js'

export default withErrorHandling(async (req, res) => {
  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM accounts ORDER BY activa DESC, nombre`
    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    const { nombre, tipo, moneda, activa } = req.body || {}
    if (!nombre || !tipo) {
      return res.status(400).json({ error: 'nombre y tipo son requeridos' })
    }
    if (!['banco', 'efectivo'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser "banco" o "efectivo"' })
    }
    const [account] = await sql`
      INSERT INTO accounts (nombre, tipo, moneda, activa)
      VALUES (${nombre}, ${tipo}, ${moneda || 'ARS'}, ${activa ?? true})
      RETURNING *
    `
    // Cada cuenta habilita automáticamente un método de pago asociado
    await sql`
      INSERT INTO payment_methods (tipo, account_id)
      VALUES ('cuenta', ${account.id})
    `
    return res.status(201).json(account)
  }

  return methodNotAllowed(res, ['GET', 'POST'])
})
