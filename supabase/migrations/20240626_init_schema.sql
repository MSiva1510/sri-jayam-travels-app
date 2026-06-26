-- ─────────────────────────────────────────────────────────────────────
-- SRI JAYAM TRAVELS - DATABASE SCHEMA
-- Supabase SQL Migration
-- Created: Day 24
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- USERS TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'driver')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_is_active ON public.users(is_active);

-- ─────────────────────────────────────────────────────────────────────
-- CUSTOMERS TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('individual', 'corporate', 'agency')),
  primary_mobile TEXT,
  alternate_mobile TEXT,
  email TEXT,
  city TEXT,
  state TEXT,
  address TEXT,
  company_name TEXT,
  contact_person TEXT,
  gstin TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_customers_name ON public.customers(name);
CREATE INDEX idx_customers_type ON public.customers(type);
CREATE INDEX idx_customers_email ON public.customers(email);
CREATE INDEX idx_customers_is_active ON public.customers(is_active);

-- ─────────────────────────────────────────────────────────────────────
-- DRIVERS TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  driver_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  license_number TEXT UNIQUE,
  license_expiry DATE,
  vehicle_registration TEXT,
  vehicle_type TEXT,
  rating DECIMAL(3,2) DEFAULT 5.0,
  is_active BOOLEAN DEFAULT true,
  joined_date DATE DEFAULT CURRENT_DATE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_drivers_user_id ON public.drivers(user_id);
CREATE INDEX idx_drivers_name ON public.drivers(name);
CREATE INDEX idx_drivers_phone ON public.drivers(phone);
CREATE INDEX idx_drivers_is_active ON public.drivers(is_active);

-- ─────────────────────────────────────────────────────────────────────
-- VEHICLES TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id TEXT UNIQUE NOT NULL,
  registration TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  model TEXT,
  year INTEGER,
  color TEXT,
  fuel_type TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'assigned', 'maintenance', 'offline')),
  current_driver UUID REFERENCES public.drivers(id),
  current_km DECIMAL(10,2) DEFAULT 0,
  last_service_date DATE,
  last_service_km DECIMAL(10,2),
  next_service_date DATE,
  next_service_km DECIMAL(10,2),
  insurance_number TEXT,
  insurance_expiry DATE,
  permit_number TEXT,
  permit_expiry DATE,
  fc_number TEXT,
  fc_expiry DATE,
  puc_number TEXT,
  puc_expiry DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vehicles_registration ON public.vehicles(registration);
CREATE INDEX idx_vehicles_type ON public.vehicles(type);
CREATE INDEX idx_vehicles_status ON public.vehicles(status);
CREATE INDEX idx_vehicles_current_driver ON public.vehicles(current_driver);

-- ─────────────────────────────────────────────────────────────────────
-- BOOKINGS TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT UNIQUE NOT NULL,
  booking_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('one_way', 'round_trip', 'local_visit', 'multi_day', 'rental_with_driver', 'self_drive')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'assigned', 'started', 'paused', 'completed', 'cancelled')),
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  customer_contact TEXT,
  driver_id UUID REFERENCES public.drivers(id),
  vehicle_id UUID REFERENCES public.vehicles(id),
  pickup_location TEXT,
  drop_location TEXT,
  start_date DATE NOT NULL,
  start_time TIME,
  end_date DATE,
  end_time TIME,
  pickup_odometer DECIMAL(10,2),
  drop_odometer DECIMAL(10,2),
  total_km DECIMAL(10,2),
  base_fare DECIMAL(10,2),
  total_fare DECIMAL(10,2),
  notes TEXT,
  type_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bookings_booking_number ON public.bookings(booking_number);
CREATE INDEX idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX idx_bookings_driver_id ON public.bookings(driver_id);
CREATE INDEX idx_bookings_vehicle_id ON public.bookings(vehicle_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_start_date ON public.bookings(start_date);

-- ─────────────────────────────────────────────────────────────────────
-- BOOKING_STOPS TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  stop_number INTEGER NOT NULL,
  location TEXT NOT NULL,
  arrival_time TIMESTAMP WITH TIME ZONE,
  departure_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_booking_stops_booking_id ON public.booking_stops(booking_id);

-- ─────────────────────────────────────────────────────────────────────
-- TRIP_ROUTES TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trip_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  route_data JSONB,
  distance_km DECIMAL(10,2),
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trip_routes_booking_id ON public.trip_routes(booking_id);

-- ─────────────────────────────────────────────────────────────────────
-- TRIP_TIMELINES TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trip_timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_description TEXT,
  event_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trip_timelines_booking_id ON public.trip_timelines(booking_id);
CREATE INDEX idx_trip_timelines_event_type ON public.trip_timelines(event_type);

-- ─────────────────────────────────────────────────────────────────────
-- ATTENDANCE TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'leave', 'holiday')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_attendance_driver_id ON public.attendance(driver_id);
CREATE INDEX idx_attendance_date ON public.attendance(attendance_date);
CREATE UNIQUE INDEX idx_attendance_driver_date ON public.attendance(driver_id, attendance_date);

-- ─────────────────────────────────────────────────────────────────────
-- EXPENSES TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id TEXT UNIQUE NOT NULL,
  booking_id UUID REFERENCES public.bookings(id),
  driver_id UUID REFERENCES public.drivers(id),
  type TEXT NOT NULL CHECK (type IN ('fuel', 'parking', 'toll', 'bata', 'maintenance', 'other')),
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE NOT NULL,
  location TEXT,
  notes TEXT,
  bill_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by UUID REFERENCES public.users(id),
  approved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_expenses_booking_id ON public.expenses(booking_id);
CREATE INDEX idx_expenses_driver_id ON public.expenses(driver_id);
CREATE INDEX idx_expenses_type ON public.expenses(type);
CREATE INDEX idx_expenses_status ON public.expenses(status);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date);

-- ─────────────────────────────────────────────────────────────────────
-- TRIP_PAYSLIPS TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trip_payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id TEXT UNIQUE NOT NULL,
  booking_id UUID NOT NULL REFERENCES public.bookings(id),
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  base_amount DECIMAL(10,2),
  incentive_amount DECIMAL(10,2) DEFAULT 0,
  deduction_amount DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trip_payslips_driver_id ON public.trip_payslips(driver_id);
CREATE INDEX idx_trip_payslips_booking_id ON public.trip_payslips(booking_id);
CREATE INDEX idx_trip_payslips_status ON public.trip_payslips(status);

-- ─────────────────────────────────────────────────────────────────────
-- SETTLEMENTS TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id TEXT UNIQUE NOT NULL,
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  basic_pay DECIMAL(10,2),
  incentive DECIMAL(10,2) DEFAULT 0,
  deductions DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  payment_method TEXT,
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_settlements_driver_id ON public.settlements(driver_id);
CREATE INDEX idx_settlements_status ON public.settlements(status);
CREATE INDEX idx_settlements_month_year ON public.settlements(month, year);

-- ─────────────────────────────────────────────────────────────────────
-- NOTIFICATIONS TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  related_id TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

-- ─────────────────────────────────────────────────────────────────────
-- AUDIT_LOGS TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);

-- ─────────────────────────────────────────────────────────────────────
-- SETTINGS TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_settings_key ON public.settings(key);

-- ─────────────────────────────────────────────────────────────────────
-- DOCUMENTS TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT UNIQUE NOT NULL,
  document_type TEXT NOT NULL,
  related_entity TEXT,
  related_entity_id UUID,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_documents_document_type ON public.documents(document_type);
CREATE INDEX idx_documents_related_entity ON public.documents(related_entity, related_entity_id);

-- ─────────────────────────────────────────────────────────────────────
-- ENABLE ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- BASIC RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────

-- Users: Admins can see all, others see only themselves
CREATE POLICY users_admin_all ON public.users FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

CREATE POLICY users_self ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Customers: Managers and admins can see all
CREATE POLICY customers_manager_all ON public.customers FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Drivers: Managers and admins can see all, drivers see themselves
CREATE POLICY drivers_manager_all ON public.drivers FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

CREATE POLICY drivers_self ON public.drivers FOR SELECT
  USING (user_id = auth.uid());

-- Vehicles: Managers and admins can see all
CREATE POLICY vehicles_manager_all ON public.vehicles FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

-- Bookings: Managers and admins can see all, drivers see their own
CREATE POLICY bookings_manager_all ON public.bookings FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

CREATE POLICY bookings_driver_own ON public.bookings FOR SELECT
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- Attendance: Managers and admins can see all, drivers see themselves
CREATE POLICY attendance_manager_all ON public.attendance FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

CREATE POLICY attendance_driver_self ON public.attendance FOR SELECT
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- Expenses: Managers and admins can see all, drivers see their own
CREATE POLICY expenses_manager_all ON public.expenses FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'manager')));

CREATE POLICY expenses_driver_own ON public.expenses FOR SELECT
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- Settlements: Admins can see all, managers and drivers see their relevant data
CREATE POLICY settlements_admin_all ON public.settlements FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

CREATE POLICY settlements_driver_own ON public.settlements FOR SELECT
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- Notifications: Users see only their own
CREATE POLICY notifications_own ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Audit logs: Only admins can see
CREATE POLICY audit_logs_admin_only ON public.audit_logs FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));