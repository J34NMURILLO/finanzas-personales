import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

export default function Dashboard() {
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/categories'),
      api.get('/accounts'),
      api.get('/cards'),
      api.get('/income'),
      api.get('/fixed-expenses'),
      api.get('/installment-expenses'),
    ])
      .then(([categories, accounts, cards, income, fixedExpenses, installments]) => {
        setCounts({
          categories: categories.length,
          accounts: accounts.length,
          cards: cards.length,
          income: income.length,
          fixedExpenses: fixedExpenses.length,
          installments: installments.length,
        })
      })
      .catch(() => setCounts({}))
  }, [])

  const cards = [
    { label: 'Categorías', value: counts?.categories, to: '/categorias' },
    { label: 'Cuentas', value: counts?.accounts, to: '/cuentas' },
    { label: 'Tarjetas', value: counts?.cards, to: '/tarjetas' },
    { label: 'Ingresos registrados', value: counts?.income, to: '/ingresos' },
    { label: 'Gastos fijos', value: counts?.fixedExpenses, to: '/gastos-fijos' },
    { label: 'Compras en cuotas', value: counts?.installments, to: '/cuotas' },
  ]

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Resumen</h1>
      <p className="text-sm text-gray-500 mb-6">
        Fase 1: cargá tus categorías, cuentas, tarjetas, ingresos y gastos fijos. Los gráficos y proyecciones
        llegan en la próxima fase.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-indigo-300"
          >
            <div className="text-2xl font-semibold text-gray-900">{c.value ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </Link>
        ))}
      </div>
      <div className="mt-6">
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
