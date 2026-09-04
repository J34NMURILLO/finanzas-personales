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

const ETIQUETA_TIPO = {
  transaccion: 'Gasto suelto',
  fijo: 'Gasto fijo',
  cuota: 'Cuota',
}

export default function Dashboard() {
  const [desde, setDesde] = useState(currentMonth)
  const [hasta, setHasta] = useState(currentMonth)
  const [tarjetaId, setTarjetaId] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Cambiar "desde" y "hasta" seguido dispara pedidos solapados; sin esta
    // guarda, la respuesta vieja (a veces un error) pisa a la nueva.
    let vigente = true
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ desde, hasta })
    if (tarjetaId) params.set('tarjeta_id', tarjetaId)
    api
      .get(`/reports?${params.toString()}`)
      .then((data) => {
        if (vigente) setReport(data)
      })
      .catch((err) => {
        if (vigente) setError(err.message)
      })
      .finally(() => {
        if (vigente) setLoading(false)
      })
    return () => {
      vigente = false
    }
  }, [desde, hasta, tarjetaId])

  function resetToCurrentMonth() {
    setDesde(currentMonth())
    setHasta(currentMonth())
    setTarjetaId('')
  }

  const ahorroPositivo = (report?.totales.ahorro ?? 0) >= 0
  const ahorroChartData = useMemo(() => {
    if (!report) return []
    const { gastos, ahorro, ingresos } = report.totales
    if (ahorro >= 0) {
      return [
        { name: 'Gastos', value: gastos, color: GASTO_COLOR },
        { name: 'Te queda', value: ahorro, color: AHORRO_COLOR },
      ]
    }
    return [
      { name: 'Ingresos', value: ingresos, color: AHORRO_COLOR },
      { name: 'Te falta', value: -ahorro, color: DEFICIT_COLOR },
    ]
  }, [report])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Resumen</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Cada gasto se imputa al mes en que lo pagás. Una compra con tarjeta cae en el mes en que vence el
        resumen donde entró, así ves con qué sueldo la vas a pagar.
      </p>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm mb-4 flex flex-wrap items-end gap-3">
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
            <option value="">Todo (tarjetas, cuentas y efectivo)</option>
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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500 dark:text-gray-400">Ingresos del período</div>
              <div className="text-2xl font-semibold text-green-600 dark:text-green-400">
                {formatMoney(report.totales.ingresos)}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500 dark:text-gray-400">Gastos a pagar</div>
              <div className="text-2xl font-semibold text-red-600 dark:text-red-400">
                {formatMoney(report.totales.gastos)}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {ahorroPositivo ? 'Te queda' : 'Te falta'}
              </div>
              <div
                className={`text-2xl font-semibold ${ahorroPositivo ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}
              >
                {formatMoney(Math.abs(report.totales.ahorro))}
              </div>
            </div>
          </div>

          {report.mesSiguiente && (
            <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-4 mb-4">
              <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                Cómo viene {report.mesSiguiente.mes}
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <span className="text-gray-600 dark:text-gray-300">
                  Sueldo: <strong>{formatMoney(report.mesSiguiente.ingresos)}</strong>
                </span>
                <span className="text-gray-600 dark:text-gray-300">
                  Ya comprometido: <strong>{formatMoney(report.mesSiguiente.gastos)}</strong>
                </span>
                <span
                  className={
                    report.mesSiguiente.queda >= 0
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-orange-700 dark:text-orange-400'
                  }
                >
                  {report.mesSiguiente.queda >= 0 ? 'Va a quedar' : 'Va a faltar'}:{' '}
                  <strong>{formatMoney(Math.abs(report.mesSiguiente.queda))}</strong>
                </span>
              </div>
              {report.mesSiguiente.yaComprometidoDeEsteMes > 0 && (
                <div className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-2">
                  Incluye {formatMoney(report.mesSiguiente.yaComprometidoDeEsteMes)} de compras con tarjeta que ya
                  hiciste y recién se pagan ese mes.
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Gasto por categoría</h2>
              {report.porCategoria.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-10 text-center">Sin gastos en el período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={report.porCategoria} dataKey="monto" nameKey="nombre" outerRadius={90}>
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
                {ahorroPositivo ? 'Gasto vs. lo que te queda' : 'Ingreso vs. lo que te falta'}
              </h2>
              {tarjetaId ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-10 text-center">
                  Filtrando por una tarjeta puntual no se calcula el remanente del sueldo.
                </p>
              ) : ahorroChartData.every((d) => d.value === 0) ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-10 text-center">
                  Sin movimientos en el período.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={ahorroChartData} dataKey="value" nameKey="name" outerRadius={90}>
                      {ahorroChartData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatMoney(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm mb-4">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Detalle de gastos del período</h2>
            </div>
            {report.detalle.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">Sin gastos en el período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Concepto</th>
                      <th className="text-left px-4 py-3 font-medium">Tipo</th>
                      <th className="text-left px-4 py-3 font-medium">Categoría</th>
                      <th className="text-left px-4 py-3 font-medium">Medio</th>
                      <th className="text-left px-4 py-3 font-medium">Se paga en</th>
                      <th className="text-right px-4 py-3 font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {report.detalle.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{d.nombre}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                          {ETIQUETA_TIPO[d.tipo] || d.tipo}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{d.categoria_nombre || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{d.medio_nombre || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{d.mes}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-gray-200">
                          {formatMoney(d.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {report.ingresosDetalle.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm mb-4">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ingresos del período</h2>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {report.ingresosDetalle.map((i, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{i.categoria_nombre || 'Ingreso'}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{i.tipo}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{i.mes}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">
                        {formatMoney(i.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
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
