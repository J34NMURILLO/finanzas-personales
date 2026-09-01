import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { api } from '../lib/api'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function formatMoney(n) {
  return `$${Number(n || 0).toLocaleString('es-AR')}`
}

const GASTO_COLOR = '#ef4444'
const AHORRO_COLOR = '#22c55e'
const DEFICIT_COLOR = '#f97316'

export default function Dashboard() {
  const [desde, setDesde] = useState(currentMonth)
  const [hasta, setHasta] = useState(currentMonth)
  const [tarjetaId, setTarjetaId] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ desde, hasta })
    if (tarjetaId) params.set('tarjeta_id', tarjetaId)
    api
      .get(`/reports?${params.toString()}`)
      .then(setReport)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [desde, hasta, tarjetaId])

  function resetToCurrentMonth() {
    setDesde(currentMonth())
    setHasta(currentMonth())
    setTarjetaId('')
  }

  const ahorroPositivo = (report?.totales.ahorro ?? 0) >= 0
  const ahorroChartData = useMemo(() => {
    if (!report) return []
    const { gastos, ahorro } = report.totales
    if (ahorro >= 0) {
      return [
        { name: 'Gastos', value: gastos, color: GASTO_COLOR },
        { name: 'Ahorro', value: ahorro, color: AHORRO_COLOR },
      ]
    }
    // déficit: gastó más de lo que ingresó
    return [
      { name: 'Ingresos', value: report.totales.ingresos, color: AHORRO_COLOR },
      { name: 'Déficit', value: -ahorro, color: DEFICIT_COLOR },
    ]
  }, [report])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Resumen</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Gasto real ya cargado (chat o manual), atribuido al ciclo de cierre de cada tarjeta.
      </p>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Desde</label>
          <input
            type="month"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Hasta</label>
          <input
            type="month"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tarjeta</label>
          <select
            value={tarjetaId}
            onChange={(e) => setTarjetaId(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todas / efectivo / cuentas</option>
            {report?.tarjetas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={resetToCurrentMonth}
          className="text-sm font-medium px-4 py-2 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
        >
          Mes actual
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 dark:text-gray-500">Cargando...</div>
      ) : report ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Gasto por categoría</h2>
            {report.porCategoria.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-10 text-center">Sin gastos en el período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={report.porCategoria}
                    dataKey="monto"
                    nameKey="nombre"
                    outerRadius={90}
                    label={(d) => `${d.nombre}`}
                  >
                    {report.porCategoria.map((c) => (
                      <Cell key={c.categoria_id ?? 'sin_categoria'} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {ahorroPositivo ? 'Gasto / Ahorro' : 'Ingreso / Déficit'}
            </h2>
            {tarjetaId ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-10 text-center">
                Con una tarjeta específica seleccionada no se calculan ingresos ni ahorro global.
              </p>
            ) : ahorroChartData.every((d) => d.value === 0) ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-10 text-center">Sin movimientos en el período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={ahorroChartData} dataKey="value" nameKey="name" outerRadius={90} label={(d) => d.name}>
                    {ahorroChartData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="grid grid-cols-3 gap-2 mt-2 text-center">
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-500">Ingresos</div>
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {formatMoney(report.totales.ingresos)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-500">Gastos</div>
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {formatMoney(report.totales.gastos)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-500">{ahorroPositivo ? 'Ahorro' : 'Déficit'}</div>
                <div
                  className={`text-sm font-semibold ${ahorroPositivo ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}
                >
                  {formatMoney(Math.abs(report.totales.ahorro))}
                </div>
              </div>
            </div>
          </div>

          {!tarjetaId && report.porTarjeta.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm lg:col-span-2">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Gasto por método de pago</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {report.porTarjeta.map((p) => (
                  <div key={p.payment_method_id} className="border border-gray-100 dark:border-gray-800 rounded-lg p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{p.nombre}</div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatMoney(p.monto)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="flex gap-3">
        <Link
          to="/chat"
          className="inline-block bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          Cargar un gasto por chat →
        </Link>
      </div>
    </div>
  )
}
