// ─── Report Data Aggregator ───────────────────────────────────
// Reads from all existing data modules. No new localStorage keys.

import { TRIPS, DRIVERS, VEHICLES, totalFare, totalNet, totalKm, totalExp } from './mockData'
import { loadBookings, getStatusCfg }                    from './tripTypes'
import { loadCustomers, getCustomerStats }               from './customerData'
import { loadExpenses, EXPENSE_TYPES, summariseByType,
         isThisMonth }                                   from './expenseData'
import { loadSettlements }                               from './settlementData'
import { loadAttendance, loadVehicleAssignments }        from './attendanceData'
import { docStatus }                                     from '../utils/vehicleUtils'

export function inRange(dateStr, from, to) {
  if (!dateStr) return false
  const d = dateStr.slice(0,10)
  if (from && d < from) return false
  if (to   && d > to)   return false
  return true
}
export function thisMonthStr() { return new Date().toISOString().slice(0,7) }
export function todayStr()     { return new Date().toISOString().slice(0,10) }

// ── Module 1: Executive summary ───────────────────────────────
export function getExecutiveSummary() {
  const bookings    = loadBookings()
  const customers   = loadCustomers().filter(c => !c._deleted)
  const expenses    = loadExpenses()
  const settlements = loadSettlements()
  return {
    trips: {
      total:     bookings.length,
      active:    bookings.filter(b => b.status === 'started').length,
      completed: bookings.filter(b => b.status === 'completed').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
      assigned:  bookings.filter(b => b.status === 'assigned').length,
      scheduled: bookings.filter(b => ['draft','confirmed'].includes(b.status)).length,
    },
    customers: {
      total:     customers.length,
      corporate: customers.filter(c => c.type==='corporate'||c.type==='agent').length,
      active:    customers.filter(c => c.status==='active').length,
    },
    vehicles: {
      total:       VEHICLES.length,
      available:   VEHICLES.filter(v => v.status==='active').length,
      inUse:       loadVehicleAssignments().length,
      maintenance: VEHICLES.filter(v => v.status==='maintenance').length,
    },
    drivers: {
      total:     DRIVERS.length,
      available: DRIVERS.filter(d => d.status==='active').length,
      onLeave:   DRIVERS.filter(d => d.status==='on-leave').length,
    },
    finance: {
      totalFare, totalNet, totalKm, totalExp,
      monthExpenses: expenses.filter(e=>isThisMonth(e.date)).reduce((s,e)=>s+e.amount,0),
      paidPayroll:   settlements.filter(s=>s.status==='paid').reduce((s,p)=>s+p.netAmount,0),
    },
  }
}

// ── Module 2: Trip report ─────────────────────────────────────
export function getTripReport(from, to, driverFilter='all', vehicleFilter='all') {
  const rows = loadBookings().filter(b => {
    const matchDate   = inRange(b.startDate, from, to)
    const matchDriver = driverFilter  ==='all' || b.driver  ===driverFilter
    const matchVeh    = vehicleFilter ==='all' || b.vehicle ===vehicleFilter
    return matchDate && matchDriver && matchVeh
  })
  const totalRevenue  = rows.reduce((s,b)=>s+(b.fare||0),0)
  const totalDistance = rows.reduce((s,b)=>s+(b.km||0),0)
  const completed     = rows.filter(b=>b.status==='completed').length
  const cancelled     = rows.filter(b=>b.status==='cancelled').length
  const cancelRate    = rows.length ? Math.round((cancelled/rows.length)*100) : 0
  return { rows, totalRevenue, totalDistance, completed, cancelled, cancelRate }
}

// ── Module 3: Driver performance ──────────────────────────────
export function getDriverPerformance() {
  const bookings    = loadBookings()
  const attendance  = loadAttendance()
  const settlements = loadSettlements()
  const monthKey    = thisMonthStr()
  return DRIVERS.map(d => {
    const dTrips      = bookings.filter(b=>b.driver===d.name)
    const completed   = dTrips.filter(b=>b.status==='completed').length
    const revenue     = dTrips.reduce((s,b)=>s+(b.fare||0),0)
    const myAtt       = attendance.filter(a=>a.driver===d.name&&a.date.startsWith(monthKey))
    const presentDays = myAtt.filter(a=>['present','half-day'].includes(a.status)).length
    const totalMin    = myAtt.reduce((s,a)=>{
      if(!a.workingHours) return s
      const m=a.workingHours.match(/(\d+)h\s*(\d+)m/)
      return m ? s+parseInt(m[1])*60+parseInt(m[2]) : s
    },0)
    const workingHours  = totalMin>0 ? `${Math.floor(totalMin/60)}h ${totalMin%60}m` : '—'
    const settlement    = settlements.find(s=>s.driver===d.name&&`${s.year}-${String(s.month).padStart(2,'0')}`===monthKey)
    return { ...d, completedTrips:completed, totalTrips:dTrips.length, revenue, presentDays, workingHours, incentive:settlement?.incentive||0 }
  }).sort((a,b)=>b.completedTrips-a.completedTrips)
}

// ── Module 4: Vehicle performance ────────────────────────────
export function getVehiclePerformance() {
  const bookings = loadBookings()
  const expenses = loadExpenses()
  return VEHICLES.map(v => {
    const vTrips    = bookings.filter(b=>b.vehicle===v.reg)
    const completed = vTrips.filter(b=>b.status==='completed').length
    const distance  = vTrips.reduce((s,b)=>s+(b.km||0),0)
    const fuelCost  = expenses.filter(e=>e.vehicle===v.reg&&e.type==='fuel').reduce((s,e)=>s+e.amount,0)
    const maintCost = expenses.filter(e=>e.vehicle===v.reg&&['maintenance','repair'].includes(e.type)).reduce((s,e)=>s+e.amount,0)
    return { ...v, completedTrips:completed, totalTrips:vTrips.length, distance, fuelCost, maintCost, totalCost:fuelCost+maintCost }
  }).sort((a,b)=>b.completedTrips-a.completedTrips)
}

// ── Module 5: Customer reports ────────────────────────────────
export function getCustomerReport() {
  const customers = loadCustomers().filter(c=>!c._deleted)
  const bookings  = loadBookings()
  const enriched  = customers
    .map(c=>({ ...c, ...getCustomerStats(c.id,c.name,bookings) }))
    .sort((a,b)=>b.totalRevenue-a.totalRevenue)
  return {
    rows: enriched,
    totalCustomers:    customers.length,
    repeatCustomers:   enriched.filter(c=>c.totalTrips>1).length,
    corporateCustomers:customers.filter(c=>c.type==='corporate'||c.type==='agent').length,
    topByRevenue:      enriched.slice(0,5),
    topByTrips:        [...enriched].sort((a,b)=>b.totalTrips-a.totalTrips).slice(0,5),
  }
}

// ── Module 6: Expense analytics ───────────────────────────────
export function getExpenseAnalytics() {
  const expenses = loadExpenses()
  const months = []
  for (let i=5;i>=0;i--) {
    const d   = new Date(); d.setMonth(d.getMonth()-i)
    const key = d.toISOString().slice(0,7)
    const lbl = d.toLocaleString('en-IN',{month:'short',year:'2-digit'})
    const tot = expenses.filter(e=>e.date.startsWith(key)).reduce((s,e)=>s+e.amount,0)
    months.push({ key, lbl, tot })
  }
  return {
    months,
    byCategory:   summariseByType(expenses),
    monthTotal:   expenses.filter(e=>isThisMonth(e.date)).reduce((s,e)=>s+e.amount,0),
    allTimeTotal: expenses.reduce((s,e)=>s+e.amount,0),
  }
}

// ── Module 7: Payroll analytics ───────────────────────────────
export function getPayrollAnalytics() {
  const settlements = loadSettlements()
  return {
    totalPaid:       settlements.filter(s=>s.status==='paid').reduce((s,p)=>s+p.netAmount,0),
    pendingCount:    settlements.filter(s=>s.status==='pending').length,
    approvedCount:   settlements.filter(s=>s.status==='approved').length,
    paidCount:       settlements.filter(s=>s.status==='paid').length,
    draftCount:      settlements.filter(s=>s.status==='draft').length,
    totalIncentives: settlements.reduce((s,p)=>s+(p.incentive||0),0),
    byDriver: DRIVERS.map(d=>({
      name:  d.name,
      paid:  settlements.filter(s=>s.driver===d.name&&s.status==='paid').reduce((s,p)=>s+p.netAmount,0),
      count: settlements.filter(s=>s.driver===d.name).length,
    })),
  }
}

// ── Module 8: Operations monitor ─────────────────────────────
export function getOperationsMonitor() {
  const bookings    = loadBookings()
  const assignments = loadVehicleAssignments()
  return {
    drivers:  {
      available: DRIVERS.filter(d=>d.status==='active').length,
      onLeave:   DRIVERS.filter(d=>d.status==='on-leave').length,
    },
    vehicles: {
      available:   VEHICLES.filter(v=>v.status==='active').length,
      maintenance: VEHICLES.filter(v=>v.status==='maintenance').length,
      assigned:    assignments.length,
    },
    trips: {
      scheduled:  bookings.filter(b=>['draft','confirmed'].includes(b.status)).length,
      assigned:   bookings.filter(b=>b.status==='assigned').length,
      inProgress: bookings.filter(b=>b.status==='started').length,
      completed:  bookings.filter(b=>b.status==='completed').length,
      cancelled:  bookings.filter(b=>b.status==='cancelled').length,
    },
  }
}

// ── Module 9: Business alerts ─────────────────────────────────
export function getBusinessAlerts() {
  const alerts = []
  const today  = new Date(); today.setHours(0,0,0,0)
  VEHICLES.forEach(v => {
    [
      { label:`${v.reg} Insurance`, expiry:v.insExpiry,    type:'insurance' },
      { label:`${v.reg} Permit`,    expiry:v.permitExpiry, type:'permit'    },
      { label:`${v.reg} FC`,        expiry:v.fcExpiry,     type:'fc'        },
      { label:`${v.reg} PUC`,       expiry:v.pucExpiry,    type:'puc'       },
    ].forEach(d => {
      const st = docStatus(d.expiry)
      if (st.key==='expired'||st.key==='soon') {
        alerts.push({ ...d, status:st, priority:st.key==='expired'?'high':st.days<=15?'high':'medium', days:st.days })
      }
    })
    if (v.nextServiceDate) {
      const diff = Math.floor((new Date(v.nextServiceDate)-today)/86400000)
      if (diff<=30) alerts.push({
        label:`${v.reg} Service Due`, expiry:v.nextServiceDate, type:'service',
        status:{
          key:  diff<0?'expired':'soon',
          label:diff<0?'Overdue':'Due Soon',
          days: diff,
          badge:diff<0
            ?'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            :'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        },
        priority:diff<0?'high':diff<=7?'high':'medium',
        days:diff,
      })
    }
  })
  return alerts.sort((a,b)=>(a.days||0)-(b.days||0))
}

// ── Module 10: CSV export ─────────────────────────────────────
export function exportToCSV(rows, columns, filename) {
  const header = columns.map(c=>c.label).join(',')
  const body   = rows.map(r=>
    columns.map(c=>{
      const val = c.key.split('.').reduce((o,k)=>o?.[k],r)??''
      const str = String(val)
      return str.includes(',')?`"${str}"`:str
    }).join(',')
  ).join('\n')
  const blob = new Blob([`${header}\n${body}`],{type:'text/csv;charset=utf-8;'})
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href=url; a.download=`${filename}_${todayStr()}.csv`; a.click()
  URL.revokeObjectURL(url)
}
