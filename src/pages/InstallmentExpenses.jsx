import CrudManager from '../components/CrudManager'

export default function InstallmentExpenses() {
  return (
    <CrudManager
      title="Compras en cuotas"
      endpoint="/installment-expenses"
      related={{ categories: '/categories?tipo=gasto', cards: '/cards' }}
      fields={[
        { name: 'nombre', label: 'Qué compraste', type: 'text', required: true },
        { name: 'monto_cuota', label: 'Monto de cada cuota', type: 'number', step: '0.01', required: true },
        { name: 'cuota_actual', label: 'En qué cuota estás', type: 'number', min: 1, required: true, defaultValue: 1 },
        { name: 'cuotas_totales', label: 'Cuántas cuotas son en total', type: 'number', min: 1, required: true },
        {
          name: 'pago_cuota_actual',
          label: 'Cuándo pagás la cuota actual',
          type: 'date',
          required: true,
          fromRow: (r) => r.pago_cuota_actual,
        },
        {
          name: 'tarjeta_id',
          label: 'Tarjeta con la que compraste (vacío si se debita de una cuenta)',
          type: 'select',
          optionsFrom: 'cards',
          placeholder: 'Ninguna — se debita de una cuenta',
        },
        { name: 'categoria_id', label: 'Categoría', type: 'select', optionsFrom: 'categories' },
      ]}
      columns={[
        { key: 'nombre', label: 'Nombre' },
        { key: 'monto_cuota', label: 'Cuota', render: (r) => `$${Number(r.monto_cuota).toLocaleString('es-AR')}` },
        { key: 'progreso', label: 'Progreso', render: (r) => `${r.cuota_actual} / ${r.cuotas_totales}` },
        {
          key: 'pago_cuota_actual',
          label: 'Pagás la cuota actual',
          render: (r) => (r.cuota_actual > r.cuotas_totales ? 'Terminada' : r.pago_cuota_actual),
        },
        {
          key: 'restante',
          label: 'Falta pagar',
          render: (r) => {
            const restantes = Math.max(0, r.cuotas_totales - r.cuota_actual + 1)
            return `$${(restantes * Number(r.monto_cuota)).toLocaleString('es-AR')}`
          },
        },
        { key: 'tarjeta_nombre', label: 'Tarjeta', render: (r) => r.tarjeta_nombre || 'Débito de cuenta' },
        { key: 'categoria_nombre', label: 'Categoría', render: (r) => r.categoria_nombre || '—' },
      ]}
    />
  )
}
