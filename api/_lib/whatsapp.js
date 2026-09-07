const API_VERSION = 'v21.0'
const CODIGO_RECHAZADO = 131030 // "Recipient phone number not in allowed list"

// WhatsApp es inconsistente con el "9" que Argentina agrega a los celulares:
// un número puede llegar en los mensajes entrantes con el 9 (ej 549...) y
// estar registrado como destinatario permitido sin él (ej 54...), o al revés.
// Para no depender de acertarle, se prueban las dos variantes.
function variantesNumero(numero) {
  const digitos = String(numero).replace(/\D/g, '')
  if (!digitos.startsWith('549') && !digitos.startsWith('54')) return [digitos]
  const sin9 = digitos.startsWith('549') ? '54' + digitos.slice(3) : digitos
  const con9 = digitos.startsWith('549') ? digitos : '549' + digitos.slice(2)
  return [...new Set([digitos, con9, sin9])]
}

async function intentarEnviar(token, phoneNumberId, destinatario, texto) {
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
  const body = await res.json().catch(() => null)
  if (res.ok) return { ok: true, body }
  return { ok: false, status: res.status, code: body?.error?.code, body }
}

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
    let ultimoError = null
    for (const variante of variantesNumero(destinatario)) {
      const resultado = await intentarEnviar(token, phoneNumberId, variante, texto)
      if (resultado.ok) {
        console.log('WhatsApp enviado, aceptado por Meta:', JSON.stringify(resultado.body))
        return
      }
      ultimoError = resultado
      if (resultado.code !== CODIGO_RECHAZADO) break // otro tipo de error, no tiene sentido reintentar
    }
    console.error('Error enviando WhatsApp:', ultimoError?.status, JSON.stringify(ultimoError?.body))
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
