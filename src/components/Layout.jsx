import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { applyTheme, getInitialTheme } from '../lib/theme'

const NAV_ITEMS = [
  { to: '/', label: 'Resumen', end: true },
  { to: '/chat', label: 'Cargar gasto (chat)' },
  { to: '/categorias', label: 'Categorías' },
  { to: '/cuentas', label: 'Cuentas' },
  { to: '/tarjetas', label: 'Tarjetas' },
  { to: '/ingresos', label: 'Ingresos' },
  { to: '/gastos-fijos', label: 'Gastos fijos' },
  { to: '/cuotas', label: 'Compras en cuotas' },
]

export default function Layout() {
  const [theme, setTheme] = useState(getInitialTheme)

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      <aside className="w-60 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hidden sm:flex sm:flex-col">
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Finanzas Personales</div>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
