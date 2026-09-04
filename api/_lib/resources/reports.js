import { sql } from '../db.js'
import { methodNotAllowed } from '../http.js'
import { mesDePago, addMonths } from '../billing-cycle.js'
import { computeProjectedGasto } from '../projection.js'

const COLOR_FALLBACK = '#9ca3af'

// Un color inválido (ej: alguien escribió "verde") rompería el gráfico.
function colorValido(color) {
  return typeof color === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color.trim())
    ? color.trim()
    : COLOR_FALLBACK
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function monthRange(desde, hasta) {
  const meses = []
  let cursor = desde
  for (let i = 0; i < 60 && cursor <= hasta; i++) {
    meses.push(cursor)
    cursor = addMonths(cursor, 1)
  }
  return meses
}

export default async function reports(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const mesHoy = currentMonth()
  const desde = /^\d{4}-\d{2}$/.test(req.query.desde || '') ? req.query.desde : mesHoy
  const hasta = /^\d{4}-\d{2}$/.test(req.query.hasta || '') ? req.query.hasta : desde
  const tarjetaId = req.query.tarjeta_id ? Number(req.query.tarjeta_id) : null

  if (hasta < desde) {
    return res.status(400).json({ error: '"hasta" no puede ser anterior a "desde"' })
  }

  const meses = monthRange(desde, hasta)
  // Lo que se consume este mes se suele pagar el mes que viene, así que
  // también se calcula el mes siguiente para anticipar cómo queda ese sueldo.
  const mesSiguiente = addMonths(hasta, 1)

  // Margen hacia atrás: una compra con tarjeta se paga hasta dos meses
  // después del mes en que se hizo (cierre + vencimiento del mes siguiente).
  const fechaDesdeQuery = `${addMonths(desde, -2)}-01`
  const fechaHastaQuery = `${addMonths(mesSiguiente, 1)}-01`

  const [transactions, incomeRows, cards] = await Promise.all([
    sql`
      SELECT t.id, t.fecha, t.monto, t.descripcion, t.categoria_id,
        c.nombre AS categoria_nombre, c.color AS categoria_color,
        pm.id AS payment_method_id, pm.card_id,
        COALESCE(cd.nombre, ac.nombre, 'Efectivo') AS medio_nombre,
        cd.cierre_dia, cd.vencimiento_dia
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.categoria_id
      LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
      LEFT JOIN cards cd ON cd.id = pm.card_id
      LEFT JOIN accounts ac ON ac.id = pm.account_id
      WHERE t.fecha >= ${fechaDesdeQuery} AND t.fecha < ${fechaHastaQuery}
    `,
    sql`
      SELECT i.fecha, i.monto, i.tipo, c.nombre AS categoria_nombre
      FROM income i
      LEFT JOIN categories c ON c.id = i.categoria_id
      WHERE i.fecha >= ${`${desde}-01`} AND i.fecha < ${fechaHastaQuery}
    `,
    sql`SELECT id, nombre FROM cards ORDER BY nombre`,
  ])

  const mesesSet = new Set(meses)
  const categoriaTotales = new Map()
  const medioTotales = new Map()
  const detalle = []
  let gastos = 0

  function sumar(item) {
    if (tarjetaId && item.card_id !== tarjetaId) return
    gastos += item.monto
    detalle.push(item)

    const catKey = item.categoria_id ?? 'sin_categoria'
    const cat = categoriaTotales.get(catKey) || {
      categoria_id: item.categoria_id ?? null,
      nombre: item.categoria_nombre || 'Sin categoría',
      color: colorValido(item.categoria_color),
      monto: 0,
    }
    cat.monto += item.monto
    categoriaTotales.set(catKey, cat)

    const medioKey = item.card_id ? `tarjeta:${item.card_id}` : item.medio_nombre || 'Sin medio'
    const medio = medioTotales.get(medioKey) || {
      card_id: item.card_id ?? null,
      nombre: item.medio_nombre || 'Sin medio',
      monto: 0,
    }
    medio.monto += item.monto
    medioTotales.set(medioKey, medio)
  }

  // 1. Transacciones sueltas (chat / manuales), imputadas al mes de pago.
  for (const t of transactions) {
    const mes = mesDePago(t.fecha, t.cierre_dia, t.vencimiento_dia)
    if (!mesesSet.has(mes)) continue
    sumar({
      tipo: 'transaccion',
      id: `tx-${t.id}`,
      nombre: t.descripcion || t.categoria_nombre || 'Gasto',
      monto: Number(t.monto),
      mes,
      categoria_id: t.categoria_id,
      categoria_nombre: t.categoria_nombre,
      categoria_color: t.categoria_color,
      medio_nombre: t.medio_nombre,
      card_id: t.card_id,
    })
  }

  // 2. Gastos fijos y cuotas comprometidas de cada mes del rango.
  for (const mes of meses) {
    const { detalle: comprometidos } = await computeProjectedGasto(mes)
    for (const item of comprometidos) {
      sumar({ ...item, id: `${item.tipo}-${item.id}-${mes}`, mes })
    }
  }

  const ingresos = incomeRows.reduce((acc, r) => {
    const mes = r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 7) : String(r.fecha).slice(0, 7)
    return mesesSet.has(mes) ? acc + Number(r.monto) : acc
  }, 0)

  const ingresosDetalle = incomeRows
    .map((r) => ({
      mes: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 7) : String(r.fecha).slice(0, 7),
      monto: Number(r.monto),
      tipo: r.tipo,
      categoria_nombre: r.categoria_nombre,
    }))
    .filter((r) => mesesSet.has(r.mes))

  // Resumen del mes siguiente: cuánto va a quedar de ese sueldo una vez
  // pagado todo lo que ya está comprometido (incluido lo que se compró
  // ahora con tarjeta y recién se paga el mes que viene).
  const gastosSiguienteSueltos = transactions
    .filter((t) => mesDePago(t.fecha, t.cierre_dia, t.vencimiento_dia) === mesSiguiente)
    .reduce((acc, t) => acc + Number(t.monto), 0)
  const { total: gastosSiguienteComprometidos } = await computeProjectedGasto(mesSiguiente)
  const ingresosSiguiente = incomeRows
    .filter((r) => {
      const mes = r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 7) : String(r.fecha).slice(0, 7)
      return mes === mesSiguiente
    })
    .reduce((acc, r) => acc + Number(r.monto), 0)
  const gastosSiguiente = gastosSiguienteSueltos + gastosSiguienteComprometidos

  res.status(200).json({
    desde,
    hasta,
    meses,
    mesSiguiente: {
      mes: mesSiguiente,
      ingresos: ingresosSiguiente,
      gastos: gastosSiguiente,
      queda: ingresosSiguiente - gastosSiguiente,
      yaComprometidoDeEsteMes: gastosSiguienteSueltos,
    },
    tarjetas: cards,
    porCategoria: [...categoriaTotales.values()].sort((a, b) => b.monto - a.monto),
    porTarjeta: [...medioTotales.values()].sort((a, b) => b.monto - a.monto),
    detalle: detalle.sort((a, b) => b.monto - a.monto),
    ingresosDetalle,
    totales: {
      ingresos,
      gastos,
      ahorro: ingresos - gastos,
    },
  })
}
