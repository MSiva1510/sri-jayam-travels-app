// ─── Sri Jayam Travels — Mock Data ───────────────────────────

export const BIZ = {
  name:    'Sri Jayam Travels',
  address: 'No.4 Subburaya Pillai Street, Ariyakuppam, Puducherry – 605007',
  phone:   '+91 94423 37470',
  email:   'srijayamtravels1255@gmail.com',
  website: 'www.srijayamtravels.in',
  logo:    'https://travelsjayam.in/wp-content/uploads/2025/05/Untitled-design-1.png',
}

export const TRIPS = [
  { id:1,  date:'28-05-2026', customer:'Rajan Kumar',       contact:'9876543210', source:'Puducherry',  destination:'Chennai Airport', driver:'Ramanan',       car:'PY01CY1255', type:'4+1 Sedan', fare:3200, toll:150, petrol:800,  bata:400, exp:0,   net:1850, km:145, status:'done',    invNo:'SJT-2026-MAY-RAJ241', leadSrc:'WhatsApp'   },
  { id:2,  date:'27-05-2026', customer:'Meena Devi',        contact:'9123456789', source:'Puducherry',  destination:'Bangalore',       driver:'Babu',          car:'PY01DF1255', type:'4+1 Sedan', fare:7500, toll:320, petrol:1800, bata:600, exp:200, net:4580, km:310, status:'done',    invNo:'SJT-2026-MAY-MEE382', leadSrc:'Google Maps'},
  { id:3,  date:'26-05-2026', customer:'Suresh Pillai',     contact:'9988776655', source:'Auroville',   destination:'Pondicherry Rly', driver:'Rajasekharan',  car:'PY01VF1255', type:'7+1 SUV',   fare:800,  toll:0,   petrol:250,  bata:200, exp:0,   net:350,  km:28,  status:'pending', invNo:'SJT-2026-MAY-SUR193', leadSrc:'Referral'   },
  { id:4,  date:'25-05-2026', customer:'Ananya Singh',      contact:'9012345678', source:'Puducherry',  destination:'Cuddalore',       driver:'Ramanan',       car:'PY01CY1255', type:'4+1 Sedan', fare:1800, toll:80,  petrol:500,  bata:300, exp:0,   net:920,  km:80,  status:'done',    invNo:'SJT-2026-MAY-ANA874', leadSrc:'Phone Call' },
  { id:5,  date:'24-05-2026', customer:'Vikram Nair',       contact:'8765432109', source:'Chennai',     destination:'Puducherry',      driver:'Babu',          car:'PY01DF1255', type:'4+1 Sedan', fare:4500, toll:200, petrol:1100, bata:500, exp:100, net:2600, km:158, status:'done',    invNo:'SJT-2026-MAY-VIK521', leadSrc:'Website'    },
  { id:6,  date:'23-05-2026', customer:'Priya Lakshmi',     contact:'7654321098', source:'Puducherry',  destination:'Tirupati',        driver:'Rajasekharan',  car:'PY01VF1255', type:'7+1 SUV',   fare:9000, toll:450, petrol:2200, bata:700, exp:300, net:5350, km:420, status:'done',    invNo:'SJT-2026-MAY-PRI763', leadSrc:'WhatsApp'   },
  { id:7,  date:'22-05-2026', customer:'Arun Balaji',       contact:'6543210987', source:'Puducherry',  destination:'Villupuram',      driver:'Ramanan',       car:'PY01CY1255', type:'4+1 Sedan', fare:1200, toll:0,   petrol:350,  bata:250, exp:0,   net:600,  km:54,  status:'pending', invNo:'SJT-2026-MAY-ARU344', leadSrc:'Referral'   },
  { id:8,  date:'21-05-2026', customer:'Kavitha Mohan',     contact:'9871234560', source:'Puducherry',  destination:'Mahabalipuram',   driver:'Babu',          car:'PY01DF1255', type:'4+1 Sedan', fare:3800, toll:180, petrol:900,  bata:450, exp:0,   net:2270, km:162, status:'done',    invNo:'SJT-2026-MAY-KAV118', leadSrc:'Google Maps'},
  { id:9,  date:'20-05-2026', customer:'Deepak Raj',        contact:'9988001122', source:'Puducherry',  destination:'Salem',           driver:'Rajasekharan',  car:'PY01VF1255', type:'7+1 SUV',   fare:6200, toll:280, petrol:1500, bata:600, exp:200, net:3620, km:248, status:'done',    invNo:'SJT-2026-MAY-DEE957', leadSrc:'Phone Call' },
  { id:10, date:'19-05-2026', customer:'Lakshmi Narayanan', contact:'8877665544', source:'Puducherry',  destination:'Coimbatore',      driver:'Ramanan',       car:'PY01CY1255', type:'4+1 Sedan', fare:8500, toll:400, petrol:2100, bata:700, exp:250, net:5050, km:380, status:'done',    invNo:'SJT-2026-MAY-LAK632', leadSrc:'Website'    },
  { id:11, date:'18-05-2026', customer:'Sathish Kumar',     contact:'9123000111', source:'Puducherry',  destination:'Chennai Central', driver:'Babu',          car:'PY01DF1255', type:'4+1 Sedan', fare:2900, toll:120, petrol:720,  bata:380, exp:0,   net:1680, km:138, status:'done',    invNo:'SJT-2026-MAY-SAT201', leadSrc:'WhatsApp'   },
  { id:12, date:'17-05-2026', customer:'Radha Krishnan',    contact:'8765000222', source:'Cuddalore',   destination:'Puducherry',      driver:'Rajasekharan',  car:'PY01VF1255', type:'7+1 SUV',   fare:1500, toll:60,  petrol:420,  bata:280, exp:0,   net:740,  km:55,  status:'done',    invNo:'SJT-2026-MAY-RAD432', leadSrc:'Referral'   },
]

export const EXPENSES = [
  { id:1, date:'15-05-2026', desc:'Tyre replacement — PY01CY1255',      cat:'Car Parts',     amount:4800,  notes:'Front two tyres'    },
  { id:2, date:'10-05-2026', desc:'Engine oil service — PY01DF1255',    cat:'Car Service',   amount:1800,  notes:'45,000 km service'  },
  { id:3, date:'08-05-2026', desc:'FASTag recharge — all 3 vehicles',   cat:'Other',         amount:2000,  notes:'Prepaid toll wallet' },
  { id:4, date:'05-05-2026', desc:'GPRS tracking subscription',          cat:'GPRS/Tracking', amount:1200,  notes:'Monthly renewal'    },
  { id:5, date:'04-05-2026', desc:'Office cleaning supplies',            cat:'Cleaning',      amount:450,   notes:''                   },
  { id:6, date:'28-04-2026', desc:'Insurance renewal — PY01VF1255',     cat:'Insurance',     amount:12500, notes:'Annual premium'     },
  { id:7, date:'20-04-2026', desc:'Brake pads + disc — PY01DF1255',     cat:'Car Parts',     amount:3200,  notes:'Front axle'         },
  { id:8, date:'12-04-2026', desc:'Driver advance — Babu',              cat:'Driver Expense',amount:2000,  notes:'Festival advance'   },
]

export const DRIVERS = [
  { id:1, name:'Ramanan',      mobile:'8754914315', vehicle:'PY01CY1255', vehicleType:'4+1 Sedan', trips:42, totalBata:18200, totalExp:2400, rating:4.8, status:'active',  joined:'Jan 2022', license:'TN-0120220012345' },
  { id:2, name:'Babu',         mobile:'9894403206', vehicle:'PY01DF1255', vehicleType:'4+1 Sedan', trips:38, totalBata:17100, totalExp:3100, rating:4.6, status:'active',  joined:'Mar 2021', license:'TN-0120210009876' },
  { id:3, name:'Rajasekharan', mobile:'6383401383', vehicle:'PY01VF1255', vehicleType:'7+1 SUV',   trips:31, totalBata:15800, totalExp:2800, rating:4.7, status:'on-leave', joined:'Sep 2022', license:'TN-0120220056789' },
]

export const VEHICLES = [
  {
    id:1, reg:'PY01CY1255', type:'4+1 Sedan', model:'Toyota Etios', year:2020,
    km:52340, status:'active', fuelType:'Petrol', color:'White', driver:'Ramanan',
    // Service
    lastServiceDate:'2026-03-10', lastServiceKm:50000,
    nextServiceDate:'2026-08-10', nextServiceKm:55000,
    // Insurance
    insProvider:'New India Assurance', insNumber:'NIA-2024-PY1255', insExpiry:'2026-12-31',
    // Permit
    permitNumber:'PY-TN-2024-0012', permitExpiry:'2027-03-15',
    // FC (Fitness Certificate)
    fcNumber:'FC-PY-2024-1255', fcExpiry:'2026-09-30',
    // Pollution Certificate
    pucNumber:'PUC-PY-2026-3301', pucExpiry:'2026-11-15',
  },
  {
    id:2, reg:'PY01DF1255', type:'4+1 Sedan', model:'Maruti Dzire', year:2021,
    km:44890, status:'active', fuelType:'CNG', color:'Silver', driver:'Babu',
    // Service
    lastServiceDate:'2026-04-05', lastServiceKm:43000,
    nextServiceDate:'2026-09-05', nextServiceKm:48000,
    // Insurance
    insProvider:'Oriental Insurance', insNumber:'OIC-2025-PY1255', insExpiry:'2027-02-28',
    // Permit
    permitNumber:'PY-TN-2024-0043', permitExpiry:'2026-07-20',   // expiring soon
    // FC
    fcNumber:'FC-PY-2025-1856', fcExpiry:'2027-01-15',
    // Pollution
    pucNumber:'PUC-PY-2026-4412', pucExpiry:'2026-06-10',        // expired
  },
  {
    id:3, reg:'PY01VF1255', type:'7+1 SUV', model:'Maruti Ertiga', year:2022,
    km:38120, status:'maintenance', fuelType:'Petrol', color:'Grey', driver:'Rajasekharan',
    // Service
    lastServiceDate:'2026-05-02', lastServiceKm:37500,
    nextServiceDate:'2026-10-02', nextServiceKm:42500,
    // Insurance
    insProvider:'United India Insurance', insNumber:'UIL-2025-PY1255', insExpiry:'2027-01-31',
    // Permit
    permitNumber:'PY-TN-2025-0091', permitExpiry:'2027-05-10',
    // FC
    fcNumber:'FC-PY-2025-2201', fcExpiry:'2026-07-05',           // expiring soon
    // Pollution
    pucNumber:'PUC-PY-2026-5523', pucExpiry:'2026-12-01',
  },
]

// Derived / computed helpers
export const totalFare    = TRIPS.reduce((s, t) => s + t.fare, 0)
export const totalNet     = TRIPS.reduce((s, t) => s + t.net, 0)
export const totalKm      = TRIPS.reduce((s, t) => s + t.km, 0)
export const totalExp     = EXPENSES.reduce((s, e) => s + e.amount, 0)
export const doneTrips    = TRIPS.filter(t => t.status === 'done').length
export const pendingTrips = TRIPS.filter(t => t.status === 'pending').length

export const uniqueCustomers = [...new Map(
  TRIPS.map(t => [t.customer, {
    name:    t.customer,
    contact: t.contact,
    trips:   TRIPS.filter(r => r.customer === t.customer).length,
    total:   TRIPS.filter(r => r.customer === t.customer).reduce((s, r) => s + r.fare, 0),
    last:    t.date,
    leadSrc: t.leadSrc,
  }])
).values()]

export const expByCategory = EXPENSES.reduce((acc, e) => {
  acc[e.cat] = (acc[e.cat] || 0) + e.amount
  return acc
}, {})

export const driverStats = DRIVERS.map(d => ({
  ...d,
  fareCollected: TRIPS.filter(t => t.driver === d.name).reduce((s, t) => s + t.fare, 0),
  tripCount:     TRIPS.filter(t => t.driver === d.name).length,
  totalPay:      d.totalBata + d.totalExp,
}))

// Monthly fare bar-chart data (last 6 months — mock)
export const monthlyFare = [
  { month: 'Dec',  fare: 52000 },
  { month: 'Jan',  fare: 67000 },
  { month: 'Feb',  fare: 58000 },
  { month: 'Mar',  fare: 74000 },
  { month: 'Apr',  fare: 81000 },
  { month: 'May',  fare: totalFare },
]
