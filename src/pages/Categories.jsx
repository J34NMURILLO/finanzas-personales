import CrudManager from '../components/CrudManager'

export default function Categories() {
  return (
    <CrudManager
      title="Categorías"
      endpoint="/categories"
      fields={[
        { name: 'nombre', label: 'Nombre', type: 'text', required: true },
        {
          name: 'tipo',
          label: 'Tipo',
          type: 'select',
          required: true,
          options: [
            { value: 'gasto', label: 'Gasto' },
            { value: 'ingreso', label: 'Ingreso' },
          ],
        },
        { name: 'color', label: 'Color (hex)', type: 'text' },
      ]}
      columns={[
        { key: 'nombre', label: 'Nombre' },
        {
          key: 'tipo',
          label: 'Tipo',
          render: (r) => (
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                r.tipo === 'gasto' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
              }`}
            >
              {r.tipo}
            </span>
          ),
        },
        {
          key: 'color',
          label: 'Color',
          render: (r) =>
            r.color ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-3 rounded-full inline-block border border-gray-200" style={{ background: r.color }} />
                {r.color}
              </span>
            ) : (
              '—'
            ),
        },
      ]}
    />
  )
}
