import { methodNotAllowed } from '../http.js'
import { obtenerLog } from '../whatsapp-log.js'

export default async function whatsappLog(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])
  const rows = await obtenerLog()
  return res.status(200).json(rows)
}
