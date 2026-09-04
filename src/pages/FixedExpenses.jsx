import CrudManager from '../components/CrudManager'

export default function FixedExpenses() {
  return (
    <CrudManager
      title="Gastos fijos"
      endpoint="/fixed-expenses"
      related={{ categories: '/categories?tipo=gasto', paymentMethods: '/payment-methods' }}
      fields={[
        { name: 'nombre', label: 'Nombre', type: 'text', required: true },
        { name: 'monto', label: 'Monto', type: 'number', step: '0.01', required: true },
        { name: 'dia_del_mes', label: 'Día del mes', type: 'number', min: 1, max: 31, required: true },
        { name: 'categoria_id', label: 'Categoría', type: 'select', optionsFrom: 'categories' },
        {
          name: 'payment_method_id',
          label: 'Método de pago',
          type: 'select',
          optionsFrom: 'paymentMethods',
          quickCreate: {
            label: 'Agregar una tarjeta que falta',
            endpoint: '/cards',
            fields: [
              { name: 'nombre', label: 'Nombre de la tarjeta' },
              { name: 'cierre_dia', label: 'Día de cierre', type: 'number', min: 1, max: 31 },
              { name: 'vencimiento_dia', label: 'Día de vencimiento', type: 'number', min: 1, max: 31 },
            ],
            // La tarjeta genera su método de pago; hay que seleccionar ese.
            seleccionar: (tarjeta, metodos) => metodos.find((m) => m.card_id === tarjeta.id)?.id,
          },
        },
        { name: 'activo_desde', label: 'Activo desde', type: 'date', required: true },
        { name: 'activo_hasta', label: 'Activo hasta (vacío = indefinido)', type: 'date' },
      ]}
      columns={[
        { key: 'nombre', label: 'Nombre' },
        { key: 'monto', label: 'Monto', render: (r) => `$${Number(r.monto).toLocaleString('es-AR')}` },
        { key: 'dia_del_mes', label: 'Día' },
        { key: 'categoria_nombre', label: 'Categoría', render: (r) => r.categoria_nombre || '—' },
        { key: 'payment_method_nombre', label: 'Método de pago', render: (r) => r.payment_method_nombre || '—' },
        { key: 'activo_hasta', label: 'Hasta', render: (r) => r.activo_hasta || 'Indefinido' },
      ]}
    />
  )
}
