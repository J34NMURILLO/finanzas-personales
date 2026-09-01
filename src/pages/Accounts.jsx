import CrudManager from '../components/CrudManager'

export default function Accounts() {
  return (
    <CrudManager
      title="Cuentas"
      endpoint="/accounts"
      fields={[
        { name: 'nombre', label: 'Nombre', type: 'text', required: true },
        {
          name: 'tipo',
          label: 'Tipo',
          type: 'select',
          required: true,
          options: [
            { value: 'banco', label: 'Banco' },
            { value: 'efectivo', label: 'Efectivo' },
          ],
        },
        { name: 'moneda', label: 'Moneda', type: 'text' },
        { name: 'activa', label: 'Activa', type: 'checkbox' },
      ]}
      columns={[
        { key: 'nombre', label: 'Nombre' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'moneda', label: 'Moneda' },
        {
          key: 'activa',
          label: 'Estado',
          render: (r) => (
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${r.activa ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
              {r.activa ? 'Activa' : 'Inactiva'}
            </span>
          ),
        },
      ]}
    />
  )
}
