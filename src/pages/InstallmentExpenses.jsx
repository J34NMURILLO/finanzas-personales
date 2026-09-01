import CrudManager from '../components/CrudManager'

export default function InstallmentExpenses() {
  return (
    <CrudManager
      title="Compras en cuotas"
      endpoint="/installment-expenses"
      related={{ categories: '/categories?tipo=gasto', cards: '/cards' }}
      fields={[
        { name: 'nombre', label: 'Nombre', type: 'text', required: true },
        { name: 'monto_cuota', label: 'Monto de la cuota', type: 'number', step: '0.01', required: true },
        { name: 'cuotas_totales', label: 'Cuotas totales', type: 'number', min: 1, required: true },
        { name: 'cuota_actual', label: 'Cuota actual', type: 'number', min: 1 },
        { name: 'tarjeta_id', label: 'Tarjeta', type: 'select', optionsFrom: 'cards' },
        { name: 'categoria_id', label: 'Categoría', type: 'select', optionsFrom: 'categories' },
        { name: 'fecha_inicio', label: 'Fecha de inicio', type: 'date', required: true },
      ]}
      columns={[
        { key: 'nombre', label: 'Nombre' },
        { key: 'monto_cuota', label: 'Cuota', render: (r) => `$${Number(r.monto_cuota).toLocaleString('es-AR')}` },
        { key: 'progreso', label: 'Progreso', render: (r) => `${r.cuota_actual} / ${r.cuotas_totales}` },
        { key: 'tarjeta_nombre', label: 'Tarjeta', render: (r) => r.tarjeta_nombre || '—' },
        { key: 'categoria_nombre', label: 'Categoría', render: (r) => r.categoria_nombre || '—' },
      ]}
    />
  )
}
