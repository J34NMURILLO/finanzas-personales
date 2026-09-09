import { sql } from './db.js'

export async function registrarLog({ telefono, alias, mensaje, respuesta, resultado, transactionId = null }) {
  await sql`
    INSERT INTO whatsapp_log (telefono, alias, mensaje, respuesta, resultado, transaction_id)
    VALUES (${telefono}, ${alias}, ${mensaje}, ${respuesta}, ${resultado}, ${transactionId})
  `
}

export async function obtenerLog() {
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  return sql`
    SELECT id, alias, mensaje, respuesta, resultado, transaction_id, created_at
    FROM whatsapp_log
    WHERE created_at >= ${desde}
    ORDER BY created_at DESC
    LIMIT 500
  `
}
