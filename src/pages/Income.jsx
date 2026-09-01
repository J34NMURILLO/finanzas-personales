import CrudManager from '../components/CrudManager'

export default function Income() {
  return (
    <CrudManager
      title="Ingresos"
      endpoint="/income"
      related={{ accounts: '/accounts', categories: '/categories?tipo=ingreso' }}
      fields={[
        { name: 'fecha', label: 'Fecha', type: 'date', required: true },
        { name: 'monto', label: 'Monto', type: 'number', step: '0.01', required: true },
        {
          name: 'tipo',
          label: 'Tipo',
          type: 'select',
          required: true,
          options: [
            { value: 'efectivo', label: 'Efectivo' },
            { value: 'digital', label: 'Digital' },
          ],
        },
        { name: 'cuenta_id', label: 'Cuenta', type: 'select', optionsFrom: 'accounts' },
        {
          name: 'categoria_id',
          label: 'Categoría',
          type: 'select',
          optionsFrom: 'categories',
        },
      ]}
      columns={[
        { key: 'fecha', label: 'Fecha' },
        { key: 'monto', label: 'Monto', render: (r) => `$${Number(r.monto).toLocaleString('es-AR')}` },
        { key: 'tipo', label: 'Tipo' },
        { key: 'cuenta_nombre', label: 'Cuenta', render: (r) => r.cuenta_nombre || '—' },
        { key: 'categoria_nombre', label: 'Categoría', render: (r) => r.categoria_nombre || '—' },
      ]}
    />
  )
}
