import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import Categories from './pages/Categories'
import Accounts from './pages/Accounts'
import Cards from './pages/Cards'
import Income from './pages/Income'
import FixedExpenses from './pages/FixedExpenses'
import InstallmentExpenses from './pages/InstallmentExpenses'
import Projection from './pages/Projection'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/categorias" element={<Categories />} />
          <Route path="/cuentas" element={<Accounts />} />
          <Route path="/tarjetas" element={<Cards />} />
          <Route path="/ingresos" element={<Income />} />
          <Route path="/gastos-fijos" element={<FixedExpenses />} />
          <Route path="/cuotas" element={<InstallmentExpenses />} />
          <Route path="/proyeccion" element={<Projection />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
