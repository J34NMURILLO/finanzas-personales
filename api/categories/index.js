import { sql } from '../_lib/db.js'
import { withErrorHandling, methodNotAllowed } from '../_lib/http.js'

export default withErrorHandling(async (req, res) => {
  if (req.method === 'GET') {
    const { tipo } = req.query
    const rows =
      tipo === 'gasto' || tipo === 'ingreso'
        ? await sql`SELECT * FROM categories WHERE tipo = ${tipo} ORDER BY nombre`
        : await sql`SELECT * FROM categories ORDER BY tipo, nombre`
    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    const { nombre, tipo, color } = req.body || {}
    if (!nombre || !tipo) {
      return res.status(400).json({ error: 'nombre y tipo son requeridos' })
    }
    if (!['gasto', 'ingreso'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser "gasto" o "ingreso"' })
    }
    const [row] = await sql`
      INSERT INTO categories (nombre, tipo, color)
      VALUES (${nombre}, ${tipo}, ${color || null})
      RETURNING *
    `
    return res.status(201).json(row)
  }

  return methodNotAllowed(res, ['GET', 'POST'])
})
