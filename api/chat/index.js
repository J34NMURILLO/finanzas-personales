import { withErrorHandling, methodNotAllowed } from '../_lib/http.js'
import { interpretarGasto } from '../_lib/interpret-gasto.js'

export default withErrorHandling(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const { messages } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages es requerido y debe tener al menos un mensaje' })
  }

  const result = await interpretarGasto(messages, 'web_chat')
  return res.status(200).json(result)
})
