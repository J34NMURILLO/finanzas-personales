import { sql } from '../db.js'
import { methodNotAllowed } from '../http.js'
import { cotizacionDelDia } from '../exchange.js'

const MONEDAS = ['ARS', 'USD']

export default async function fixedExpenses(req, res, id) {
  if (!id && req.method === 'GET') {
    const rows = await sql`
      SELECT fe.*, c.nombre AS categoria_nombre,
        COALESCE(cd.nombre, ac.nombre, 'Efectivo') AS payment_method_nombre
      FROM fixed_expenses fe
      LEFT JOIN categories c ON c.id = fe.categoria_id
      LEFT JOIN payment_methods pm ON pm.id = fe.payment_method_id
      LEFT JOIN cards cd ON cd.id = pm.card_id
      LEFT JOIN accounts ac ON ac.id = pm.account_id
      ORDER BY (fe.activo_hasta IS NOT NULL AND fe.activo_hasta < CURRENT_DATE), fe.dia_del_mes
    `

    // Los que están en dólares se muestran también convertidos a pesos con la
    // cotización de hoy, que es la que se va a usar el próximo vencimiento.
    const hayDolares = rows.some((r) => r.moneda === 'USD')
    const cotizacion = hayDolares ? await cotizacionDelDia() : null
    return res.status(200).json(
      rows.map((r) => ({
        ...r,
        cotizacion,
        monto_en_pesos:
          r.moneda === 'USD' ? Math.round(Number(r.monto) * cotizacion * 100) / 100 : Number(r.monto),
      })),
    )
  }

  if (!id && req.method === 'POST') {
    const { nombre, monto, moneda, dia_del_mes, categoria_id, payment_method_id, activo_desde, activo_hasta } =
      req.body || {}
    if (!nombre || !monto || !dia_del_mes || !activo_desde) {
      return res.status(400).json({ error: 'nombre, monto, dia_del_mes y activo_desde son requeridos' })
    }
    if (dia_del_mes < 1 || dia_del_mes > 31) {
      return res.status(400).json({ error: 'dia_del_mes debe estar entre 1 y 31' })
    }
    const divisa = MONEDAS.includes(moneda) ? moneda : 'ARS'
    const [row] = await sql`
      INSERT INTO fixed_expenses (nombre, monto, moneda, dia_del_mes, categoria_id, payment_method_id, activo_desde, activo_hasta)
      VALUES (${nombre}, ${monto}, ${divisa}, ${dia_del_mes}, ${categoria_id || null}, ${payment_method_id || null}, ${activo_desde}, ${activo_hasta || null})
      RETURNING *
    `
    return res.status(201).json(row)
  }

  if (id && req.method === 'PUT') {
    const { nombre, monto, moneda, dia_del_mes, categoria_id, payment_method_id, activo_desde, activo_hasta } =
      req.body || {}
    if (!nombre || !monto || !dia_del_mes || !activo_desde) {
      return res.status(400).json({ error: 'nombre, monto, dia_del_mes y activo_desde son requeridos' })
    }
    const divisa = MONEDAS.includes(moneda) ? moneda : 'ARS'
    const [row] = await sql`
      UPDATE fixed_expenses SET nombre = ${nombre}, monto = ${monto}, moneda = ${divisa}, dia_del_mes = ${dia_del_mes},
        categoria_id = ${categoria_id || null}, payment_method_id = ${payment_method_id || null},
        activo_desde = ${activo_desde}, activo_hasta = ${activo_hasta || null}
      WHERE id = ${id}
      RETURNING *
    `
    if (!row) return res.status(404).json({ error: 'Gasto fijo no encontrado' })
    return res.status(200).json(row)
  }

  if (id && req.method === 'DELETE') {
    const [row] = await sql`DELETE FROM fixed_expenses WHERE id = ${id} RETURNING id`
    if (!row) return res.status(404).json({ error: 'Gasto fijo no encontrado' })
    return res.status(204).end()
  }

  return methodNotAllowed(res, id ? ['PUT', 'DELETE'] : ['GET', 'POST'])
}
