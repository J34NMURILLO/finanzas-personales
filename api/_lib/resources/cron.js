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
  return res.status(200).json(result)
}
