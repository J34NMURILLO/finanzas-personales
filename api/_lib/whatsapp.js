const API_VERSION = 'v21.0'

// Manda un mensaje de texto simple por WhatsApp Cloud API. Nunca tira: un
// error acá no debe romper el procesamiento del mensaje entrante.
export async function enviarWhatsApp(destinatario, texto) {
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    console.error('Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID')
    return
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: destinatario,
        type: 'text',
        text: { body: texto },
      }),
    })
    if (!res.ok) {
      console.error('Error enviando WhatsApp:', res.status, await res.text())
    }
  } catch (err) {
    console.error('Error de red enviando WhatsApp:', err)
  }
}

// El número de origen puede llegar con formatos distintos según el cliente
// de WhatsApp del usuario; comparamos solo dígitos para no fallar por un +
// o un 0 de más.
function soloDigitos(s) {
  return String(s || '').replace(/\D/g, '')
}

// WHATSAPP_USERS: JSON tipo {"5491112345678":"Jean","5491198765432":"Katherine"}
export function aliasAutorizado(numero) {
  let usuarios = {}
  try {
    usuarios = JSON.parse(process.env.WHATSAPP_USERS || '{}')
  } catch {
    console.error('WHATSAPP_USERS no es un JSON válido')
  }
  const buscado = soloDigitos(numero)
  const match = Object.entries(usuarios).find(([tel]) => soloDigitos(tel) === buscado)
  return match?.[1] || null
}
