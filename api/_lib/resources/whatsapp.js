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
    // Meta espera un 200 rápido y reintenta si no lo recibe a tiempo; el
    // trabajo real (Claude + base) sigue después, ya con la respuesta enviada.
    res.status(200).json({ ok: true })

    try {
      const mensaje = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
      if (!mensaje || mensaje.type !== 'text') return // status de entrega, no un mensaje

      const desde = mensaje.from
      const texto = mensaje.text.body
      const alias = aliasAutorizado(desde)

      if (!alias) {
        await enviarWhatsApp(desde, 'No reconozco este número. Pedile al admin que te autorice.')
        return
      }

      const resultado = await interpretarGasto([{ role: 'user', content: texto }], 'whatsapp_texto', alias)
      await enviarWhatsApp(desde, resultado.reply)
    } catch (err) {
      console.error('Error procesando mensaje de WhatsApp:', err)
    }
    return
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
