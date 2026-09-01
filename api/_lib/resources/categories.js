import { sql } from '../db.js'
import { methodNotAllowed } from '../http.js'

export default async function categories(req, res, id) {
  if (!id && req.method === 'GET') {
    const { tipo } = req.query
    const rows =
      tipo === 'gasto' || tipo === 'ingreso'
        ? await sql`SELECT * FROM categories WHERE tipo = ${tipo} ORDER BY nombre`
        : await sql`SELECT * FROM categories ORDER BY tipo, nombre`
    return res.status(200).json(rows)
  }

  if (!id && req.method === 'POST') {
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

  if (id && req.method === 'PUT') {
    const { nombre, tipo, color } = req.body || {}
    if (!nombre || !tipo) {
      return res.status(400).json({ error: 'nombre y tipo son requeridos' })
    }
    const [row] = await sql`
      UPDATE categories SET nombre = ${nombre}, tipo = ${tipo}, color = ${color || null}
      WHERE id = ${id}
      RETURNING *
    `
    if (!row) return res.status(404).json({ error: 'Categoría no encontrada' })
    return res.status(200).json(row)
  }

  if (id && req.method === 'DELETE') {
    const [row] = await sql`DELETE FROM categories WHERE id = ${id} RETURNING id`
    if (!row) return res.status(404).json({ error: 'Categoría no encontrada' })
    return res.status(204).end()
  }

  return methodNotAllowed(res, id ? ['PUT', 'DELETE'] : ['GET', 'POST'])
}
