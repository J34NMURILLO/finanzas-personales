import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../lib/api'

function formatMoney(n) {
  return `$${Number(n || 0).toLocaleString('es-AR')}`
}

function formatMes(anioMes) {
  const [y, m] = anioMes.slice(0, 7).split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
}

export default function Projection() {
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState(null)

  function load() {
    setLoading(true)
    setError('')
    return api
      .get('/monthly-periods')
      .then(setPeriods)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function runClose() {
    setRunning(true)
    setRunResult(null)
    setError('')
    try {
      const result = await api.post('/monthly-periods')
      setRunResult(result)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  const chartData = periods.map((p) => ({
    mes: formatMes(p.anio_mes),
    Ingresos: p.cerrado ? Number(p.ingresos_totales) : 0,
    Gastos: p.cerrado ? Number(p.gastos_totales) : 0,
    'Gasto proyectado': p.cerrado ? 0 : Number(p.gastos_totales),
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Proyección</h1>
        <button
          onClick={runClose}
          disabled={running}
          className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {running ? 'Ejecutando...' : 'Ejecutar cierre ahora'}
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        El cierre mensual corre solo todos los días (cron de Vercel). Este botón lo fuerza a mano — es
        idempotente, no rompe nada si lo apretás de más.
      </p>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {runResult && (
        <div className="mb-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-sm rounded-lg px-4 py-2">
          {runResult.cerrados.length === 0
            ? 'No había ningún mes pendiente de cerrar.'
            : `Se cerraron ${runResult.cerrados.length} mes(es): ${runResult.cerrados.map((c) => c.mes).join(', ')}.`}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 dark:text-gray-500">Cargando...</div>
      ) : periods.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center text-sm text-gray-400 dark:text-gray-500">
          Todavía no hay ningún período cerrado ni proyectado. Ejecutá el cierre para generar el primero.
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm mb-6">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Legend />
                <Bar dataKey="Ingresos" fill="#22c55e" />
                <Bar dataKey="Gastos" fill="#ef4444" />
                <Bar dataKey="Gasto proyectado" fill="#f97316" fillOpacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Mes</th>
                  <th className="text-left px-4 py-3 font-medium">Ingresos</th>
                  <th className="text-left px-4 py-3 font-medium">Gastos</th>
                  <th className="text-left px-4 py-3 font-medium">Te queda</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {periods.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatMes(p.anio_mes)}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatMoney(p.ingresos_totales)}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatMoney(p.gastos_totales)}</td>
                    <td
                      className={`px-4 py-3 font-medium ${Number(p.ahorro_real) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}
                    >
                      {formatMoney(p.ahorro_real)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          p.cerrado
                            ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'
                        }`}
                      >
                        {p.cerrado ? 'Cerrado' : 'Proyectado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
