import { sql } from '../db.js'
import { methodNotAllowed } from '../http.js'

// Solo lectura: las filas las genera el motor de cierre mensual (ver
// monthly-close.js), no se cargan a mano.
export default async function monthlyPeriods(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const rows = await sql`SELECT * FROM monthly_periods ORDER BY anio_mes`
  return res.status(200).json(rows)
}
