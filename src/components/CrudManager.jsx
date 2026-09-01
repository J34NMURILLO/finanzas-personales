import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

function emptyForm(fields) {
  const form = {}
  for (const f of fields) {
    form[f.name] = f.type === 'checkbox' ? true : ''
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
      next[f.name] = row[f.name] ?? (f.type === 'checkbox' ? true : '')
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
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          className="h-4 w-4 rounded border-gray-300"
          checked={!!form[f.name]}
          onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.checked }))}
        />
      )
    }

    return (
      <input
        type={f.type || 'text'}
        step={f.step}
        min={f.min}
        max={f.max}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={form[f.name] ?? ''}
        onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
        required={f.required}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <button
          onClick={openCreate}
          className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          + Nuevo
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            {editingId ? 'Editar' : 'Nuevo registro'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.name} className={f.type === 'checkbox' ? 'flex items-center gap-2' : ''}>
                {f.type !== 'checkbox' && (
                  <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                )}
                {renderFieldInput(f)}
                {f.type === 'checkbox' && <label className="text-xs text-gray-600">{f.label}</label>}
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
              className="text-sm font-medium px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="text-left px-4 py-3 font-medium">
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-gray-400">
                  Cargando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-gray-400">
                  Sin registros todavía.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 text-gray-700">
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
