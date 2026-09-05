import { sql } from '../db.js'
import { methodNotAllowed } from '../http.js'
import { mesEfectivo, mesDePago, addMonths } from '../billing-cycle.js'
import { aPesos } from '../exchange.js'

const MONEDAS = ['ARS', 'USD']

// Un gasto suelto es un hecho puntual: se convierte con la cotización del día
// en que se hizo y en la base queda el importe en pesos, que es lo que suman
// todos los cálculos. El importe original en dólares se guarda al lado.
async function convertir(monto, moneda, fecha) {
  const divisa = MONEDAS.includes(moneda) ? moneda : 'ARS'
  const { pesos, cotizacion } = await aPesos(monto, divisa, fecha)
  return { divisa, pesos, cotizacion }
}

// Gastos sueltos: los que no son fijos ni en cuotas. Se cargan por chat o a
// mano desde la pestaña Gastos sueltos.
export default async function transactions(req, res, id) {
  if (!id && req.method === 'GET') {
    const mes = /^\d{4}-\d{2}$/.test(req.query.mes || '') ? req.query.mes : null

    // Se traen con margen porque una compra con tarjeta se paga hasta dos
    // meses después; el filtro por mes se aplica sobre el mes de pago.
    const rows = mes
      ? await sql`
          SELECT t.*, c.nombre AS categoria_nombre,
            COALESCE(cd.nombre, ac.nombre, 'Efectivo') AS medio_nombre,
            cd.cierre_dia, cd.vencimiento_dia
          FROM transactions t
          LEFT JOIN categories c ON c.id = t.categoria_id
          LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
          LEFT JOIN cards cd ON cd.id = pm.card_id
          LEFT JOIN accounts ac ON ac.id = pm.account_id
          WHERE t.fecha >= ${`${addMonths(mes, -2)}-01`} AND t.fecha < ${`${addMonths(mes, 1)}-01`}
          ORDER BY t.fecha DESC, t.id DESC
        `
      : await sql`
          SELECT t.*, c.nombre AS categoria_nombre,
            COALESCE(cd.nombre, ac.nombre, 'Efectivo') AS medio_nombre,
            cd.cierre_dia, cd.vencimiento_dia
          FROM transactions t
          LEFT JOIN categories c ON c.id = t.categoria_id
          LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
          LEFT JOIN cards cd ON cd.id = pm.card_id
          LEFT JOIN accounts ac ON ac.id = pm.account_id
          ORDER BY t.fecha DESC, t.id DESC
          LIMIT 300
        `

    const conMes = rows.map((r) => ({
      ...r,
      mes_del_gasto: mesEfectivo(r.fecha, r.cierre_dia),
      mes_de_pago: mesDePago(r.fecha, r.cierre_dia, r.vencimiento_dia),
    }))

    return res.status(200).json(mes ? conMes.filter((r) => r.mes_del_gasto === mes) : conMes)
  }

  if (!id && req.method === 'POST') {
    const { fecha, monto, moneda, categoria_id, payment_method_id, descripcion } = req.body || {}
    if (!fecha || !monto) {
      return res.status(400).json({ error: 'fecha y monto son requeridos' })
    }
    const { divisa, pesos, cotizacion } = await convertir(monto, moneda, fecha)
    const [row] = await sql`
      INSERT INTO transactions (fecha, monto, moneda, monto_original, cotizacion, categoria_id, payment_method_id, origen, descripcion)
      VALUES (${fecha}, ${pesos}, ${divisa}, ${monto}, ${cotizacion}, ${categoria_id || null}, ${payment_method_id || null}, 'manual', ${descripcion || null})
      RETURNING *
    `
    return res.status(201).json(row)
  }

  if (id && req.method === 'PUT') {
    const { fecha, monto, moneda, categoria_id, payment_method_id, descripcion } = req.body || {}
    if (!fecha || !monto) {
      return res.status(400).json({ error: 'fecha y monto son requeridos' })
    }
    const { divisa, pesos, cotizacion } = await convertir(monto, moneda, fecha)
    const [row] = await sql`
      UPDATE transactions SET fecha = ${fecha}, monto = ${pesos}, moneda = ${divisa},
        monto_original = ${monto}, cotizacion = ${cotizacion},
        categoria_id = ${categoria_id || null}, payment_method_id = ${payment_method_id || null},
        descripcion = ${descripcion || null}
      WHERE id = ${id}
      RETURNING *
    `
    if (!row) return res.status(404).json({ error: 'Gasto no encontrado' })
    return res.status(200).json(row)
  }

  if (id && req.method === 'DELETE') {
    const [row] = await sql`DELETE FROM transactions WHERE id = ${id} RETURNING id`
    if (!row) return res.status(404).json({ error: 'Gasto no encontrado' })
    return res.status(204).end()
  }

  return methodNotAllowed(res, id ? ['PUT', 'DELETE'] : ['GET', 'POST'])
}
