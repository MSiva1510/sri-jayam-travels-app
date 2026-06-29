import React, { useState, useEffect } from 'react'
import { Database, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../../config/database'
import supabase, { isSupabaseConfigured, checkSupabaseHealth, checkDatabaseHealth, checkStorageHealth } from '../../lib/supabase'
import { customerRepository } from '../../repositories/customerRepository'
import { driverRepository } from '../../repositories/driverRepository'
import { vehicleRepository } from '../../repositories/vehicleRepository'
import { tripRepository } from '../../repositories/tripRepository'
import { attendanceRepository } from '../../repositories/attendanceRepository'
import { expenseRepository } from '../../repositories/expenseRepository'
import { payrollRepository } from '../../repositories/payrollRepository'

const DatabaseStatus = () => {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    setLoading(true)
    try {
      const provider = getDatabaseProvider()
      const configured = isSupabaseConfigured()

      let supabaseHealth = { healthy: false }
      let dbHealth = { healthy: false }
      let storageHealth = { healthy: false }

      if (configured) {
        supabaseHealth = await checkSupabaseHealth()
        dbHealth = await checkDatabaseHealth()
        storageHealth = await checkStorageHealth()
      }

      // Get record counts
      const customers = await customerRepository.getAll()
      const drivers = await driverRepository.getAll()
      const vehicles = await vehicleRepository.getAll()
      const trips = await tripRepository.getAll()
      const attendance = await attendanceRepository.getAll()
      const expenses = await expenseRepository.getAll()
      const payslips = await payrollRepository.getAllPayslips()

      setStatus({
        provider,
        configured,
        supabaseHealth,
        dbHealth,
        storageHealth,
        recordCounts: {
          customers: customers.length,
          drivers: drivers.length,
          vehicles: vehicles.length,
          trips: trips.length,
          attendance: attendance.length,
          expenses: expenses.length,
          payslips: payslips.length,
        },
      })
    } catch (error) {
      console.error('Error loading status:', error)
      setStatus({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (status?.error) {
    return (
      <div className="p-6">
        <PageHeader title="Database Status" description="Backend system health" />
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Error: {status.error}
        </div>
      </div>
    )
  }

  const StatusBadge = ({ healthy, label }) => (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
      {healthy ? (
        <CheckCircle className="w-5 h-5 text-green-600" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-600" />
      )}
      <span className="text-sm font-medium">{label}</span>
      <span className={`text-xs font-semibold ml-auto ${healthy ? 'text-green-600' : 'text-red-600'}`}>
        {healthy ? 'OK' : 'ERROR'}
      </span>
    </div>
  )

  const InfoRow = ({ label, value }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-200">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  )

  const SectionCard = ({ title, children }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className="font-semibold text-gray-900 mb-3 text-sm">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )

  return (
    <div className="p-6">
      <PageHeader title="Database Status" description="Backend system health" />

      <div className="space-y-4">
        {/* Current Configuration */}
        <SectionCard title="Configuration">
          <InfoRow label="Provider" value={status.provider?.toUpperCase()} />
          <InfoRow label="Supabase" value={status.configured ? 'Configured' : 'Not Configured'} />
        </SectionCard>

        {/* Health Checks */}
        <SectionCard title="Health Checks">
          <StatusBadge healthy={status.supabaseHealth?.healthy} label="Supabase Auth" />
          <StatusBadge healthy={status.dbHealth?.healthy} label="Database" />
          <StatusBadge healthy={status.storageHealth?.healthy} label="Storage" />
        </SectionCard>

        {/* Record Counts */}
        <SectionCard title="Record Counts">
          <InfoRow label="Customers" value={status.recordCounts.customers} />
          <InfoRow label="Drivers" value={status.recordCounts.drivers} />
          <InfoRow label="Vehicles" value={status.recordCounts.vehicles} />
          <InfoRow label="Trips" value={status.recordCounts.trips} />
          <InfoRow label="Attendance" value={status.recordCounts.attendance} />
          <InfoRow label="Expenses" value={status.recordCounts.expenses} />
          <InfoRow label="Payslips" value={status.recordCounts.payslips} />
        </SectionCard>

        {/* Refresh Button */}
        <button
          onClick={loadStatus}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Refresh Status
        </button>
      </div>
    </div>
  )
}

export default DatabaseStatus