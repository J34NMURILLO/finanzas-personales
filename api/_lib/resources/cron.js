import { sql } from '../db.js'
import { methodNotAllowed } from '../http.js'
import { runMonthlyClose } from '../monthly-close.js'

// Disparado por el cron de Vercel (vercel.json) una vez al día; también se
// puede llamar a mano para forzar el cierre o para probarlo. Es idempotente:
// si no hay ningún mes pendiente de cerrar, no hace nada.
export default async function cron(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.authorization
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'No autorizado' })
    }
  }

  const result = await runMonthlyClose()

  // Las sesiones de WhatsApp ya son inválidas después de 20 minutos (ver
  // whatsapp-sessions.js); esto solo barre las filas que quedaron tiradas.
  const [{ count: sesionesBorradas }] = await sql`
    DELETE FROM whatsapp_sessions WHERE updated_at < now() - interval '1 day' RETURNING 1
  `.then((rows) => [{ count: rows.length }])

  const [{ count: logsBorrados }] = await sql`
    DELETE FROM whatsapp_log WHERE created_at < now() - interval '30 days' RETURNING 1
  `.then((rows) => [{ count: rows.length }])

  return res.status(200).json({ ...result, sesionesBorradas, logsBorrados })
}
