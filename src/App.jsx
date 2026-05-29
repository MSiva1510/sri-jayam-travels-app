import { Routes, Route } from 'react-router-dom'
import { AppProvider }   from './context/AppContext'
import AppShell          from './components/layout/AppShell'
import Dashboard         from './pages/Dashboard'
import Invoices          from './pages/Invoices'
import Customers         from './pages/Customers'
import Expenses          from './pages/Expenses'
import Drivers           from './pages/Drivers'
import Vehicles          from './pages/Vehicles'
import Settings          from './pages/Settings'

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/invoices"  element={<Invoices />}  />
          <Route path="/customers" element={<Customers />} />
          <Route path="/expenses"  element={<Expenses />}  />
          <Route path="/drivers"   element={<Drivers />}   />
          <Route path="/vehicles"  element={<Vehicles />}  />
          <Route path="/settings"  element={<Settings />}  />
        </Route>
      </Routes>
    </AppProvider>
  )
}
