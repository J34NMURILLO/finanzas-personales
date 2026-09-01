import Anthropic from '@anthropic-ai/sdk'
import { sql } from '../_lib/db.js'
import { withErrorHandling, methodNotAllowed } from '../_lib/http.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const REGISTRAR_GASTO_TOOL = {
  name: 'registrar_gasto',
  description:
    'Registra un gasto ya identificado con confianza en la base de datos. Solo debe llamarse cuando el monto, la categoría y el método de pago están claros (explícitos o inequívocos por contexto). Si algo es ambiguo, no llames a esta herramienta: preguntá primero.',
  input_schema: {
    type: 'object',
    properties: {
      monto: { type: 'number', description: 'Monto del gasto, positivo, en la moneda local' },
      categoria_id: { type: 'integer', description: 'ID de la categoría elegida de la lista provista' },
      payment_method_id: { type: 'integer', description: 'ID del método de pago elegido de la lista provista' },
      fecha: { type: 'string', description: 'Fecha del gasto en formato YYYY-MM-DD' },
      descripcion: { type: 'string', description: 'Descripción breve y libre del gasto tal como la escribió el usuario' },
    },
    required: ['monto', 'categoria_id', 'payment_method_id', 'fecha', 'descripcion'],
  },
}

export default withErrorHandling(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const { messages } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages es requerido y debe tener al menos un mensaje' })
  }

  const [categories, paymentMethods] = await Promise.all([
    sql`SELECT id, nombre FROM categories WHERE tipo = 'gasto' ORDER BY nombre`,
    sql`
      SELECT pm.id, COALESCE(c.nombre, a.nombre, 'Efectivo') AS nombre
      FROM payment_methods pm
      LEFT JOIN cards c ON c.id = pm.card_id
      LEFT JOIN accounts a ON a.id = pm.account_id
      WHERE COALESCE(c.activa, a.activa, true)
      ORDER BY nombre
    `,
  ])

  if (categories.length === 0 || paymentMethods.length === 0) {
    return res.status(200).json({
      reply:
        'Todavía no hay categorías de gasto o métodos de pago cargados. Configurá al menos una categoría, una cuenta o tarjeta antes de cargar gastos por chat.',
      transaction: null,
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  const systemPrompt = `Sos el asistente de carga de gastos de una app de finanzas personales. Hoy es ${today}.
Tu única tarea es interpretar mensajes en español donde el usuario cuenta un gasto que hizo, y cargarlo con la herramienta "registrar_gasto".

Categorías de gasto disponibles (usá el id exacto):
${categories.map((c) => `- id=${c.id}: ${c.nombre}`).join('\n')}

Métodos de pago disponibles (usá el id exacto):
${paymentMethods.map((p) => `- id=${p.id}: ${p.nombre}`).join('\n')}

Reglas:
- Si el monto, la categoría y el método de pago están claros, llamá a "registrar_gasto" directamente, sin confirmar antes.
- Si el método de pago no se menciona, preguntá con cuál fue (no asumas).
- Si la categoría no es obvia a partir de la descripción, preguntá o proponé la que te parezca más probable y pedí confirmación.
- Si falta el monto, preguntalo.
- Si el usuario no está describiendo un gasto (saluda, pregunta otra cosa, etc.), respondé brevemente y no llames a la herramienta.
- Las preguntas deben ser cortas, directas y en español rioplatense informal.
- Nunca inventes un categoria_id o payment_method_id que no esté en las listas de arriba.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system: systemPrompt,
    tools: [REGISTRAR_GASTO_TOOL],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })

  const toolUse = response.content.find((block) => block.type === 'tool_use')
  const textBlock = response.content.find((block) => block.type === 'text')

  if (!toolUse) {
    return res.status(200).json({ reply: textBlock?.text || '¿Podés repetirlo de otra forma?', transaction: null })
  }

  const { monto, categoria_id, payment_method_id, fecha, descripcion } = toolUse.input

  const categoriaValida = categories.some((c) => c.id === categoria_id)
  const paymentMethodValido = paymentMethods.some((p) => p.id === payment_method_id)
  if (!categoriaValida || !paymentMethodValido || !monto || monto <= 0) {
    return res.status(200).json({
      reply: 'Hubo un problema interpretando el gasto. ¿Podés escribirlo de nuevo con más detalle?',
      transaction: null,
    })
  }

  const [transaction] = await sql`
    INSERT INTO transactions (fecha, monto, categoria_id, payment_method_id, origen, descripcion)
    VALUES (${fecha || today}, ${monto}, ${categoria_id}, ${payment_method_id}, 'web_chat', ${descripcion || null})
    RETURNING *
  `

  const categoriaNombre = categories.find((c) => c.id === categoria_id)?.nombre
  const paymentMethodNombre = paymentMethods.find((p) => p.id === payment_method_id)?.nombre

  return res.status(200).json({
    reply: `Listo, cargué $${monto} en ${categoriaNombre} con ${paymentMethodNombre} el ${transaction.fecha}.`,
    transaction,
  })
})
