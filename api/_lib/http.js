export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '))
  return res.status(405).json({ error: `Método no permitido. Use: ${allowed.join(', ')}` })
}

export function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (err) {
      console.error(err)
      const message =
        err.code === '23503'
          ? 'No se puede completar la operación: hay registros relacionados que dependen de este.'
          : err.code === '23505'
            ? 'Ya existe un registro con esos datos.'
            : err.message || 'Error interno'
      return res.status(500).json({ error: message })
    }
  }
}
