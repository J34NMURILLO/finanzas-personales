import Anthropic from '@anthropic-ai/sdk'
import { sql } from './db.js'
import { resumenMes, formatearResumenWhatsApp } from './resumen-whatsapp.js'

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

const CONSULTAR_RESUMEN_TOOL = {
  name: 'consultar_resumen',
  description:
    'Devuelve un resumen de ingresos, gastos y las categorías donde más se gastó en un mes. Solo disponible para el administrador.',
  input_schema: {
    type: 'object',
    properties: {
      mes: { type: 'string', description: 'Mes a consultar en formato YYYY-MM. Si no se especifica, se usa el mes actual.' },
    },
  },
}

// Interpreta una conversación (web o WhatsApp, misma lógica para las dos) y,
// si hay confianza suficiente, carga el gasto o responde un resumen.
// `origen` queda grabado en la transacción para poder distinguir de dónde
// vino. `esAdmin` habilita o no la herramienta de resumen: a quien no es
// admin ni se le ofrece como opción, no es solo una instrucción de texto.
export async function interpretarGasto(messages, origen, quien = null, esAdmin = false) {
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
    return {
      reply:
        'Todavía no hay categorías de gasto o métodos de pago cargados. Configurá al menos una categoría, una cuenta o tarjeta antes de cargar gastos por chat.',
      transaction: null,
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const tools = esAdmin ? [REGISTRAR_GASTO_TOOL, CONSULTAR_RESUMEN_TOOL] : [REGISTRAR_GASTO_TOOL]

  const systemPrompt = `Sos el asistente de una app de finanzas personales${quien ? `, hablando con ${quien}` : ''}. Hoy es ${today}.
Tu tarea es interpretar mensajes en español donde te cuentan un gasto que hicieron, y cargarlo con la herramienta "registrar_gasto".

Categorías de gasto disponibles (usá el id exacto):
${categories.map((c) => `- id=${c.id}: ${c.nombre}`).join('\n')}

Métodos de pago disponibles (usá el id exacto):
${paymentMethods.map((p) => `- id=${p.id}: ${p.nombre}`).join('\n')}

Reglas para cargar gastos:
- Si el monto, la categoría y el método de pago están claros, llamá a "registrar_gasto" directamente, sin confirmar antes.
- Si el método de pago no se menciona, preguntá con cuál fue (no asumas).
- Si la categoría no es obvia a partir de la descripción, preguntá o proponé la que te parezca más probable y pedí confirmación.
- Si falta el monto, preguntalo.
- Nunca inventes un categoria_id o payment_method_id que no esté en las listas de arriba.
- Las preguntas deben ser cortas, directas y en español rioplatense informal.
${
  esAdmin
    ? '\nTambién podés llamar a "consultar_resumen" si piden un resumen, un balance, cuánto llevan gastado o cómo viene el mes.'
    : '\nSolo podés cargar gastos, no dar resúmenes ni balances. Si piden eso, respondé amablemente que por ahora solo cargás gastos y que le consulten a Jean.'
}
- Si no están describiendo un gasto ni pidiendo algo que puedas resolver, respondé brevemente y no llames a ninguna herramienta.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system: systemPrompt,
    tools,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })

  const toolUse = response.content.find((block) => block.type === 'tool_use')
  const textBlock = response.content.find((block) => block.type === 'text')

  if (!toolUse) {
    return { reply: textBlock?.text || '¿Podés repetirlo de otra forma?', transaction: null }
  }

  if (toolUse.name === 'consultar_resumen') {
    const mes = /^\d{4}-\d{2}$/.test(toolUse.input?.mes || '') ? toolUse.input.mes : today.slice(0, 7)
    const resumen = await resumenMes(mes)
    // esConsulta: no es un gasto a medio cargar, no hace falta arrastrar
    // este intercambio a la conversación siguiente.
    return { reply: formatearResumenWhatsApp(resumen), transaction: null, esConsulta: true }
  }

  const { monto, categoria_id, payment_method_id, fecha, descripcion } = toolUse.input

  const categoriaValida = categories.some((c) => c.id === categoria_id)
  const paymentMethodValido = paymentMethods.some((p) => p.id === payment_method_id)
  if (!categoriaValida || !paymentMethodValido || !monto || monto <= 0) {
    return { reply: 'Hubo un problema interpretando el gasto. ¿Podés escribirlo de nuevo con más detalle?', transaction: null }
  }

  const [transaction] = await sql`
    INSERT INTO transactions (fecha, monto, categoria_id, payment_method_id, origen, descripcion)
    VALUES (${fecha || today}, ${monto}, ${categoria_id}, ${payment_method_id}, ${origen}, ${descripcion || null})
    RETURNING *
  `

  const categoriaNombre = categories.find((c) => c.id === categoria_id)?.nombre
  const paymentMethodNombre = paymentMethods.find((p) => p.id === payment_method_id)?.nombre

  return {
    reply: `Listo, cargué $${monto} en ${categoriaNombre} con ${paymentMethodNombre} el ${fecha || today}.`,
    transaction,
  }
}
