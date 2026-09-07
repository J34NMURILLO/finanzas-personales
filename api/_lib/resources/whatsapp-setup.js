import { methodNotAllowed } from '../http.js'

const API_VERSION = 'v21.0'

// Utilidad de configuración, no de uso diario: suscribe la cuenta de
// WhatsApp Business (WABA) a esta app para que Meta empiece a mandar los
// mensajes entrantes reales al webhook. Sin este paso, el webhook queda
// verificado y puede enviar mensajes, pero nunca recibe nada — Meta no lo
// expone como botón en el panel, solo por esta llamada a su API.
// Se llama una vez a mano (GET) y después no hace falta tocarla más.
export default async function whatsappSetup(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const token = process.env.WHATSAPP_TOKEN
  const wabaId = process.env.WHATSAPP_WABA_ID
  if (!token || !wabaId) {
    return res.status(400).json({ error: 'Faltan WHATSAPP_TOKEN o WHATSAPP_WABA_ID en las variables de entorno' })
  }

  if (req.query.accion === 'consultar') {
    const check = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${wabaId}/subscribed_apps`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    return res.status(check.status).json(await check.json())
  }

  const sub = await fetch(`https://graph.facebook.com/${API_VERSION}/${wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.status(sub.status).json(await sub.json())
}
