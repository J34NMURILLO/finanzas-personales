import { useEffect, useState } from 'react'
import { api } from '../lib/api'

const RESULTADO_LABEL = {
  gasto_registrado: { label: 'Gasto registrado', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  consulta: { label: 'Consulta', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  pregunta: { label: 'Pregunta', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  no_autorizado: { label: 'No autorizado', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  error: { label: 'Error', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

function Badge({ resultado }) {
  const r = RESULTADO_LABEL[resultado] || { label: resultado || '—', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.cls}`}>{r.label}</span>
}

function Expandible({ texto, maxLen = 120 }) {
  const [abierto, setAbierto] = useState(false)
  if (texto.length <= maxLen) return <span>{texto}</span>
  return (
    <span>
      {abierto ? texto : texto.slice(0, maxLen) + '…'}
      <button
        onClick={() => setAbierto(!abierto)}
        className="ml-1 text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
      >
        {abierto ? 'menos' : 'ver más'}
      </button>
    </span>
  )
}

function formatFecha(iso) {
  const d = new Date(iso)
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function WhatsappLog() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => {
    api.get('/whatsapp-log').then(setRows).finally(() => setLoading(false))
  }, [])

  const aliases = ['todos', ...new Set(rows.map((r) => r.alias).filter((a) => a !== 'desconocido'))]
  const visibles = filtro === 'todos' ? rows : rows.filter((r) => r.alias === filtro)

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">WhatsApp — historial</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Últimos 30 días · {rows.length} mensajes</p>
        </div>
        <div className="flex gap-2">
          {aliases.map((a) => (
            <button
              key={a}
              onClick={() => setFiltro(a)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filtro === a
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              {a.charAt(0).toUpperCase() + a.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-gray-400 text-sm">Cargando…</p>}

      {!loading && visibles.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <p className="text-4xl mb-3">💬</p>
          <p>Todavía no hay mensajes registrados</p>
        </div>
      )}

      {!loading && visibles.length > 0 && (
        <div className="space-y-3">
          {visibles.map((row) => (
            <div
              key={row.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{row.alias}</span>
                  <Badge resultado={row.resultado} />
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{formatFecha(row.created_at)}</span>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-xs text-gray-400 w-16 shrink-0 pt-0.5">Mensaje</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    <Expandible texto={row.mensaje} />
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs text-gray-400 w-16 shrink-0 pt-0.5">Bot</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                    <Expandible texto={row.respuesta} />
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
