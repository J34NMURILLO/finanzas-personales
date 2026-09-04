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
        { name: 'color', label: 'Color', type: 'color' },
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
          render: (r) => {
            const valido = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test((r.color || '').trim())
            if (!valido) {
              return <span className="text-xs text-orange-500">Sin color — editá para elegir uno</span>
            }
            return (
              <span
                className="w-5 h-5 rounded-full inline-block border border-gray-200 dark:border-gray-700"
                style={{ background: r.color }}
              />
            )
          },
        },
      ]}
    />
  )
}
