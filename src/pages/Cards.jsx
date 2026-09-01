import CrudManager from '../components/CrudManager'

export default function Cards() {
  return (
    <CrudManager
      title="Tarjetas de crédito"
      endpoint="/cards"
      fields={[
        { name: 'nombre', label: 'Nombre', type: 'text', required: true },
        { name: 'cierre_dia', label: 'Día de cierre', type: 'number', min: 1, max: 31, required: true },
        { name: 'vencimiento_dia', label: 'Día de vencimiento', type: 'number', min: 1, max: 31, required: true },
        { name: 'limite', label: 'Límite', type: 'number', step: '0.01' },
        { name: 'activa', label: 'Activa', type: 'checkbox' },
      ]}
      columns={[
        { key: 'nombre', label: 'Nombre' },
        { key: 'cierre_dia', label: 'Cierre' },
        { key: 'vencimiento_dia', label: 'Vencimiento' },
        { key: 'limite', label: 'Límite', render: (r) => (r.limite ? `$${Number(r.limite).toLocaleString('es-AR')}` : '—') },
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
