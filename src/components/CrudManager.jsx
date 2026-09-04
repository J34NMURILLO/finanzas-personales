import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

export const PALETA = [
  { nombre: 'Rojo', hex: '#ef4444' },
  { nombre: 'Naranja', hex: '#f97316' },
  { nombre: 'Ámbar', hex: '#f59e0b' },
  { nombre: 'Amarillo', hex: '#eab308' },
  { nombre: 'Lima', hex: '#84cc16' },
  { nombre: 'Verde', hex: '#22c55e' },
  { nombre: 'Esmeralda', hex: '#10b981' },
  { nombre: 'Turquesa', hex: '#06b6d4' },
  { nombre: 'Celeste', hex: '#0ea5e9' },
  { nombre: 'Azul', hex: '#3b82f6' },
  { nombre: 'Índigo', hex: '#6366f1' },
  { nombre: 'Violeta', hex: '#8b5cf6' },
  { nombre: 'Fucsia', hex: '#d946ef' },
  { nombre: 'Rosa', hex: '#ec4899' },
  { nombre: 'Marrón', hex: '#a16207' },
  { nombre: 'Gris', hex: '#6b7280' },
]

function emptyForm(fields) {
  const form = {}
  for (const f of fields) {
    if (f.type === 'checkbox') form[f.name] = true
    else if (f.type === 'color') form[f.name] = PALETA[0].hex
    else form[f.name] = f.defaultValue ?? ''
  }
  return form
}

export default function CrudManager({ title, endpoint, fields, columns, related = {} }) {
  const [rows, setRows] = useState([])
  const [relatedData, setRelatedData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(() => emptyForm(fields))
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const relatedKeys = useMemo(() => Object.keys(related), [related])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [rowsData, ...relatedResults] = await Promise.all([
        api.get(endpoint),
        ...relatedKeys.map((k) => api.get(related[k])),
      ])
      setRows(rowsData)
      const relatedMap = {}
      relatedKeys.forEach((k, i) => (relatedMap[k] = relatedResults[i]))
      setRelatedData(relatedMap)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm(fields))
    setShowForm(true)
  }

  function openEdit(row) {
    setEditingId(row.id)
    const next = {}
    for (const f of fields) {
      const valor = f.fromRow ? f.fromRow(row) : row[f.name]
      next[f.name] = valor ?? (f.type === 'checkbox' ? true : '')
      // Los campos date del navegador necesitan 'YYYY-MM-DD' pelado.
      if (f.type === 'date' && typeof next[f.name] === 'string') {
        next[f.name] = next[f.name].slice(0, 10)
      }
    }
    setForm(next)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {}
      for (const f of fields) {
        let value = form[f.name]
        if (f.type === 'number') value = value === '' ? null : Number(value)
        if (f.type === 'select' && value === '') value = null
        payload[f.name] = value
      }
      if (editingId) {
        await api.put(`${endpoint}/${editingId}`, payload)
      } else {
        await api.post(endpoint, payload)
      }
      closeForm()
      await loadAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (!confirm(`¿Eliminar "${row.nombre ?? row.id}"?`)) return
    setError('')
    try {
      await api.del(`${endpoint}/${row.id}`)
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  function renderFieldInput(f) {
    if (f.type === 'select') {
      const options = f.options || relatedData[f.optionsFrom] || []
      return (
        <select
          className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={form[f.name] ?? ''}
          onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
          required={f.required}
        >
          <option value="">{f.placeholder || 'Seleccionar...'}</option>
          {options.map((opt) => (
            <option key={opt.value ?? opt.id} value={opt.value ?? opt.id}>
              {opt.label ?? opt.nombre}
            </option>
          ))}
        </select>
      )
    }

    if (f.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
          checked={!!form[f.name]}
          onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.checked }))}
        />
      )
    }

    if (f.type === 'color') {
      const seleccionado = form[f.name]
      return (
        <div className="flex flex-wrap gap-2">
          {PALETA.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.nombre}
              onClick={() => setForm((s) => ({ ...s, [f.name]: c.hex }))}
              className={`w-7 h-7 rounded-full border-2 transition ${
                seleccionado === c.hex
                  ? 'border-gray-900 dark:border-white scale-110'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      )
    }

    return (
      <input
        type={f.type || 'text'}
        step={f.step}
        min={f.min}
        max={f.max}
        className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={form[f.name] ?? ''}
        onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
        required={f.required}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
        <button
          onClick={openCreate}
          className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          + Nuevo
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {editingId ? 'Editar' : 'Nuevo registro'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.name} className={f.type === 'checkbox' ? 'flex items-center gap-2' : ''}>
                {f.type !== 'checkbox' && (
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{f.label}</label>
                )}
                {renderFieldInput(f)}
                {f.type === 'checkbox' && <label className="text-xs text-gray-600 dark:text-gray-300">{f.label}</label>}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="text-sm font-medium px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="text-left px-4 py-3 font-medium">
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500">
                  Cargando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500">
                  Sin registros todavía.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {c.render ? c.render(row) : (row[c.key] ?? '—')}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEdit(row)}
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-medium mr-3"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(row)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
