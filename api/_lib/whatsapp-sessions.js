import { sql } from './db.js'

// WhatsApp manda cada mensaje suelto; para que el bot pueda preguntar algo
// ("¿con qué tarjeta?") y entender la respuesta del mensaje siguiente, hay
// que guardar en qué punto de la conversación está cada número. Una sesión
// vieja (nadie contestó) no debe mezclarse con un gasto nuevo sin relación.
const MINUTOS_VIGENCIA = 20

export async function obtenerSesion(telefono) {
  const vencimiento = new Date(Date.now() - MINUTOS_VIGENCIA * 60_000).toISOString()
  const [fila] = await sql`
    SELECT messages FROM whatsapp_sessions
    WHERE telefono = ${telefono} AND updated_at > ${vencimiento}
  `
  return fila?.messages || []
}

export async function guardarSesion(telefono, alias, messages) {
  await sql`
    INSERT INTO whatsapp_sessions (telefono, alias, messages, updated_at)
    VALUES (${telefono}, ${alias}, ${JSON.stringify(messages)}::jsonb, now())
    ON CONFLICT (telefono) DO UPDATE SET alias = ${alias}, messages = ${JSON.stringify(messages)}::jsonb, updated_at = now()
  `
}

export async function borrarSesion(telefono) {
  await sql`DELETE FROM whatsapp_sessions WHERE telefono = ${telefono}`
}
