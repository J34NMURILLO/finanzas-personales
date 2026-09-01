import { sql } from '../db.js'
import { methodNotAllowed } from '../http.js'

export default async function accounts(req, res, id) {
  if (!id && req.method === 'GET') {
    const rows = await sql`SELECT * FROM accounts ORDER BY activa DESC, nombre`
    return res.status(200).json(rows)
  }

  if (!id && req.method === 'POST') {
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
    await sql`INSERT INTO payment_methods (tipo, account_id) VALUES ('cuenta', ${account.id})`
    return res.status(201).json(account)
  }

  if (id && req.method === 'PUT') {
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

  if (id && req.method === 'DELETE') {
    await sql`DELETE FROM payment_methods WHERE account_id = ${id}`
    const [row] = await sql`DELETE FROM accounts WHERE id = ${id} RETURNING id`
    if (!row) return res.status(404).json({ error: 'Cuenta no encontrada' })
    return res.status(204).end()
  }

  return methodNotAllowed(res, id ? ['PUT', 'DELETE'] : ['GET', 'POST'])
}
