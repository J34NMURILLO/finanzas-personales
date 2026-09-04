import { sql } from '../db.js'
import { methodNotAllowed } from '../http.js'
import { runMonthlyClose } from '../monthly-close.js'

// Las filas las genera el motor de cierre mensual (ver monthly-close.js), no
// se cargan a mano. El POST dispara ese cierre manualmente desde la app: a
// diferencia de /api/cron (que corre desde la infraestructura de Vercel y por
// eso exige CRON_SECRET), esta ruta queda detrás de la protección del sitio.
export default async function monthlyPeriods(req, res) {
  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM monthly_periods ORDER BY anio_mes`
    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    const result = await runMonthlyClose()
    return res.status(200).json(result)
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
