import { withErrorHandling } from './_lib/http.js'
import categories from './_lib/resources/categories.js'
import accounts from './_lib/resources/accounts.js'
import cards from './_lib/resources/cards.js'
import income from './_lib/resources/income.js'
import fixedExpenses from './_lib/resources/fixed-expenses.js'
import installmentExpenses from './_lib/resources/installment-expenses.js'
import paymentMethods from './_lib/resources/payment-methods.js'
import reports from './_lib/resources/reports.js'
import cron from './_lib/resources/cron.js'
import monthlyPeriods from './_lib/resources/monthly-periods.js'

// Router único: Vercel Hobby permite hasta 12 Serverless Functions por
// deployment. En vez de un archivo por entidad (y otro por [id]), todo
// el CRUD entra por acá y se despacha según ?resource= (ver los rewrites
// explícitos en vercel.json — la convención de archivo [...catchall].js
// de Vercel NO matchea rutas de más de un segmento fuera de Next.js, así
// que no se puede depender de eso para /api/recurso/:id).
const RESOURCES = {
  categories,
  accounts,
  cards,
  income,
  'fixed-expenses': fixedExpenses,
  'installment-expenses': installmentExpenses,
  'payment-methods': paymentMethods,
  reports,
  cron,
  'monthly-periods': monthlyPeriods,
}

export default withErrorHandling(async (req, res) => {
  const { resource, id } = req.query
  const handler = RESOURCES[resource]

  if (!handler) {
    return res.status(404).json({ error: `Recurso desconocido: ${resource}` })
  }

  return handler(req, res, id)
})
