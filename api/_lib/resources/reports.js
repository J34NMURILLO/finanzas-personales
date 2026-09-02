import { sql } from '../db.js'
import { methodNotAllowed } from '../http.js'
import { mesEfectivo, addMonths } from '../billing-cycle.js'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function monthRange(desde, hasta) {
  const meses = []
  let cursor = desde
  // tope de seguridad: no permitir rangos absurdamente largos
  for (let i = 0; i < 60 && cursor <= hasta; i++) {
    meses.push(cursor)
    cursor = addMonths(cursor, 1)
  }
  return meses
}

export default async function reports(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const mes = currentMonth()
  const desde = /^\d{4}-\d{2}$/.test(req.query.desde || '') ? req.query.desde : mes
  const hasta = /^\d{4}-\d{2}$/.test(req.query.hasta || '') ? req.query.hasta : desde
  const tarjetaId = req.query.tarjeta_id ? Number(req.query.tarjeta_id) : null

  if (hasta < desde) {
    return res.status(400).json({ error: '"hasta" no puede ser anterior a "desde"' })
  }

  const meses = monthRange(desde, hasta)

  // Ventana de consulta con margen: una compra de fin de mes puede
  // pertenecer al ciclo de tarjeta del mes siguiente. Límite superior
  // exclusivo para no depender de que el mes tenga 31 días.
  const fechaDesdeQuery = `${addMonths(desde, -1)}-01`
  const fechaHastaQuery = `${addMonths(hasta, 1)}-01`

  const [transactions, incomeRows, cards] = await Promise.all([
    sql`
      SELECT t.id, t.fecha, t.monto, t.categoria_id,
        c.nombre AS categoria_nombre, c.color AS categoria_color,
        pm.id AS payment_method_id, pm.card_id,
        COALESCE(cd.nombre, ac.nombre, 'Efectivo') AS payment_method_nombre,
        cd.cierre_dia
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.categoria_id
      LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
      LEFT JOIN cards cd ON cd.id = pm.card_id
      LEFT JOIN accounts ac ON ac.id = pm.account_id
      WHERE t.fecha >= ${fechaDesdeQuery} AND t.fecha < ${fechaHastaQuery}
    `,
    sql`
      SELECT fecha, monto FROM income
      WHERE fecha >= ${`${desde}-01`} AND fecha < ${fechaHastaQuery}
    `,
    sql`SELECT id, nombre FROM cards`,
  ])

  const mesesSet = new Set(meses)
  const cardNameById = new Map(cards.map((c) => [c.id, c.nombre]))

  const categoriaTotales = new Map()
  const tarjetaTotales = new Map()
  let gastos = 0

  for (const t of transactions) {
    const mesTx = mesEfectivo(t.fecha, t.cierre_dia)
    if (!mesesSet.has(mesTx)) continue
    if (tarjetaId && t.card_id !== tarjetaId) continue

    const monto = Number(t.monto)
    gastos += monto

    const catKey = t.categoria_id ?? 'sin_categoria'
    const catActual = categoriaTotales.get(catKey) || {
      categoria_id: t.categoria_id,
      nombre: t.categoria_nombre || 'Sin categoría',
      color: t.categoria_color || '#9ca3af',
      monto: 0,
    }
    catActual.monto += monto
    categoriaTotales.set(catKey, catActual)

    const pmKey = t.card_id ? `tarjeta:${t.card_id}` : t.payment_method_nombre
    const pmActual = tarjetaTotales.get(pmKey) || {
      payment_method_id: t.payment_method_id,
      card_id: t.card_id,
      nombre: t.payment_method_nombre,
      monto: 0,
    }
    pmActual.monto += monto
    tarjetaTotales.set(pmKey, pmActual)
  }

  const ingresos = tarjetaId
    ? 0
    : incomeRows.reduce((acc, r) => acc + Number(r.monto), 0)

  res.status(200).json({
    desde,
    hasta,
    meses,
    tarjetas: cards,
    porCategoria: [...categoriaTotales.values()].sort((a, b) => b.monto - a.monto),
    porTarjeta: [...tarjetaTotales.values()].sort((a, b) => b.monto - a.monto),
    totales: {
      ingresos,
      gastos,
      ahorro: ingresos - gastos,
    },
  })
}
