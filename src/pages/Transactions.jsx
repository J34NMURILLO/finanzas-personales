import { useState } from 'react'
import CrudManager from '../components/CrudManager'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

export default function Transactions() {
  const [mes, setMes] = useState(currentMonth)

  const toolbar = (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Mes del gasto
        </label>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <button
        onClick={() => setMes(currentMonth())}
        className="text-sm font-medium px-4 py-2 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
      >
        Mes actual
      </button>
    </div>
  )

  return (
    <CrudManager
      title="Gastos sueltos"
      descripcion="Los gastos que no son fijos ni en cuotas. Se cargan acá o por chat. El historial se filtra por el mes del gasto (el resumen de tarjeta al que entra la compra); la fecha de pago la calcula sola según el cierre y vencimiento de la tarjeta."
      toolbar={toolbar}
      endpoint="/transactions"
      queryParams={{ mes }}
      related={{ categories: '/categories?tipo=gasto', paymentMethods: '/payment-methods' }}
      fields={[
        { name: 'fecha', label: 'Fecha de la compra', type: 'date', required: true },
        { name: 'monto', label: 'Monto', type: 'number', step: '0.01', required: true, fromRow: (r) => r.monto_original ?? r.monto },
        {
          name: 'moneda',
          label: 'Moneda',
          type: 'select',
          defaultValue: 'ARS',
          options: [
            { value: 'ARS', label: 'Pesos' },
            { value: 'USD', label: 'Dólares (al oficial del día de la compra)' },
          ],
        },
        { name: 'descripcion', label: 'Descripción', type: 'text' },
        { name: 'categoria_id', label: 'Categoría', type: 'select', optionsFrom: 'categories' },
        { name: 'payment_method_id', label: 'Medio de pago', type: 'select', optionsFrom: 'paymentMethods' },
      ]}
      columns={[
        { key: 'fecha', label: 'Fecha', render: (r) => String(r.fecha).slice(0, 10) },
        { key: 'descripcion', label: 'Descripción', render: (r) => r.descripcion || '—' },
        {
          key: 'monto',
          label: 'Monto',
          render: (r) =>
            r.moneda === 'USD' ? (
              <span>
                ${Number(r.monto).toLocaleString('es-AR')}
                <span className="block text-xs text-gray-400 dark:text-gray-500">
                  USD {Number(r.monto_original).toLocaleString('es-AR')} × $
                  {Number(r.cotizacion).toLocaleString('es-AR')}
                </span>
              </span>
            ) : (
              `$${Number(r.monto).toLocaleString('es-AR')}`
            ),
        },
        { key: 'categoria_nombre', label: 'Categoría', render: (r) => r.categoria_nombre || '—' },
        { key: 'medio_nombre', label: 'Medio', render: (r) => r.medio_nombre || '—' },
        { key: 'mes_del_gasto', label: 'Mes del gasto' },
        { key: 'mes_de_pago', label: 'Se paga en' },
        {
          key: 'origen',
          label: 'Origen',
          render: (r) => (r.origen === 'manual' ? 'Manual' : r.origen === 'web_chat' ? 'Chat' : r.origen),
        },
      ]}
    />
  )
}
