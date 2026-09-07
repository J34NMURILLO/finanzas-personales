import { methodNotAllowed } from '../http.js'
import { interpretarGasto } from '../interpret-gasto.js'
import { enviarWhatsApp, aliasAutorizado } from '../whatsapp.js'

// Meta llama a esta misma URL para dos cosas distintas:
//   GET  -> handshake de verificación, una vez, al configurar el webhook.
//   POST -> cada mensaje entrante, en producción.
export default async function whatsapp(req, res) {
  if (req.method === 'GET') {
    const modo = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (modo === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).end(String(challenge))
      return
    }
    res.status(403).end('Token de verificación inválido')
    return
  }

  if (req.method === 'POST') {
    // Importante: se procesa todo ANTES de responder. En un intento anterior
    // se respondía 200 primero y se seguía trabajando "en segundo plano",
    // pero la función quedaba cortada apenas se mandaba la respuesta y ese
    // trabajo nunca terminaba. Meta tolera unos segundos de espera, así que
    // no hace falta ese atajo.
    try {
      const valor = req.body?.entry?.[0]?.changes?.[0]?.value
      const estado = valor?.statuses?.[0]
      if (estado) {
        // Aviso asíncrono de Meta sobre un mensaje que mandamos nosotros:
        // sent / delivered / read / failed. Acá se ve el motivo real si algo
        // no llega, cosa que la llamada de envío no siempre sabe todavía.
        console.log('WhatsApp estado de entrega:', JSON.stringify(estado))
        return res.status(200).json({ ok: true })
      }

      const mensaje = valor?.messages?.[0]
      if (!mensaje || mensaje.type !== 'text') {
        console.log('WhatsApp webhook: evento sin mensaje de texto ni estado, se ignora')
        return res.status(200).json({ ok: true })
      }

      const desde = mensaje.from
      const texto = mensaje.text.body
      const alias = aliasAutorizado(desde)
      console.log(`WhatsApp webhook: mensaje de ${desde} (alias=${alias || 'NINGUNO'})`)

      if (!alias) {
        await enviarWhatsApp(desde, 'No reconozco este número. Pedile al admin que te autorice.')
        return res.status(200).json({ ok: true })
      }

      const resultado = await interpretarGasto([{ role: 'user', content: texto }], 'whatsapp_texto', alias)
      console.log('WhatsApp webhook: respuesta generada, transaction_id=', resultado.transaction?.id ?? null)
      await enviarWhatsApp(desde, resultado.reply)
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('Error procesando mensaje de WhatsApp:', err)
      // Igual 200: si le devolvemos error, Meta reintenta el mismo mensaje.
      return res.status(200).json({ ok: true, error: true })
    }
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
