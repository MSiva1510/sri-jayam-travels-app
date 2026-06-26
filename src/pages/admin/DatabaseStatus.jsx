import { useState, useEffect } from 'react'
import { RotateCcw, Database, Cloud, Shield, HardDrive, AlertCircle, CheckCircle } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import { getDatabaseConfig, isLocalStorage, isSupabaseProvider } from '../../config/database'
import { isSupabaseConfigured, checkSupabaseHealth } from '../../lib/supabase'
import { checkDataServiceHealth } from '../../services/dataService'

function StatusBadge({ isHealthy, label }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
      {isHealthy ? (
        <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
      ) : (
        <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
      )}
      <span className={`text-sm font-medium ${isHealthy ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
        {label}
      </span>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, status }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-slate-100 dark:border-navy-700 last:border-0">
      <div className="flex items-center gap-3">
        <Icon size={16} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
        <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {status && <div className={`w-2 h-2 rounded-full ${status === 'healthy' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`} />}
        <span className="text-sm font-mono text-slate-800 dark:text-slate-200">{value}</span>
      </div>
    </div>
  )
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 bg-slate-50/80 dark:bg-navy-800/60 border-b border-slate-100 dark:border-navy-700">
        <Icon size={16} className="text-navy-700 dark:text-blue-400" />
        <p className="text-xs font-bold text-navy-800 dark:text-slate-200 uppercase tracking-wider">{title}</p>
      </div>
      <div className="p-5 space-y-2">{children}</div>
    </div>
  )
}

export default function DatabaseStatus() {
  const [dbConfig, setDbConfig] = useState(null)
  const [supabaseHealth, setSupabaseHealth] = useState(null)
  const [dataServiceHealth, setDataServiceHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkStatus = async () => {
      setLoading(true)
      
      // Database config
      setDbConfig(getDatabaseConfig())
      
      // Supabase health
      if (isSupabaseConfigured()) {
        const sbHealth = await checkSupabaseHealth()
        setSupabaseHealth(sbHealth)
      } else {
        setSupabaseHealth({
          isHealthy: false,
          message: 'Supabase not configured',
          timestamp: new Date().toISOString()
        })
      }
      
      // Data service health
      const dsHealth = checkDataServiceHealth()
      setDataServiceHealth(dsHealth)
      
      setLoading(false)
    }

    checkStatus()
  }, [])

  const handleRefresh = async () => {
    setLoading(true)
    const sbHealth = await checkSupabaseHealth()
    setSupabaseHealth(sbHealth)
    const dsHealth = checkDataServiceHealth()
    setDataServiceHealth(dsHealth)
    setLoading(false)
  }

  if (loading || !dbConfig || !dataServiceHealth) {
    return (
      <div className="space-y-5 animate-fade-up">
        <PageHeader title="Database Status" subtitle="Loading..." />
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-slate-200 dark:border-navy-700 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Checking status...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Database Status"
        subtitle="Monitor Supabase and storage health"
        action={
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-800/60 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={15} />
            Refresh
          </button>
        }
      />

      {/* Overall Status */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Overall Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatusBadge isHealthy={dbConfig.isLocalStorage} label={`Database: ${dbConfig.provider}`} />
          <StatusBadge isHealthy={dataServiceHealth?.isHealthy} label="Data Service" />
          <StatusBadge isHealthy={dbConfig.isSupabaseConfigured} label="Supabase Configured" />
        </div>
      </div>

      {/* Configuration */}
      <SectionCard icon={Database} title="Database Configuration">
        <InfoRow
          icon={HardDrive}
          label="Current Provider"
          value={dbConfig.provider.toUpperCase()}
          status={dbConfig.isLocalStorage ? 'healthy' : 'warning'}
        />
        <InfoRow
          icon={Cloud}
          label="Supabase Configured"
          value={dbConfig.isSupabaseConfigured ? 'Yes' : 'No'}
          status={dbConfig.isSupabaseConfigured ? 'healthy' : 'warning'}
        />
        <InfoRow
          icon={Shield}
          label="Debug Mode"
          value={dbConfig.debug ? 'Enabled' : 'Disabled'}
        />
      </SectionCard>

      {/* Data Service Status */}
      <SectionCard icon={HardDrive} title="Data Service">
        <InfoRow
          icon={Database}
          label="Service"
          value={dataServiceHealth.service}
          status={dataServiceHealth.isHealthy ? 'healthy' : 'warning'}
        />
        <div className="py-3 px-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {dataServiceHealth.message}
          </p>
        </div>
      </SectionCard>

      {/* Supabase Status */}
      {isSupabaseConfigured() && (
        <SectionCard icon={Cloud} title="Supabase Connection">
          <InfoRow
            icon={Cloud}
            label="Status"
            value={supabaseHealth?.isHealthy ? 'Connected' : 'Disconnected'}
            status={supabaseHealth?.isHealthy ? 'healthy' : 'warning'}
          />
          <div className="py-3 px-4">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {supabaseHealth?.message}
            </p>
          </div>
          <InfoRow
            icon={RotateCcw}
            label="Last Check"
            value={new Date(supabaseHealth?.timestamp).toLocaleTimeString()}
          />
        </SectionCard>
      )}

      {/* Feature Status */}
      <SectionCard icon={Shield} title="Feature Status">
        <InfoRow icon={Shield} label="Authentication" value={isSupabaseConfigured() ? 'Ready' : 'Not configured'} />
        <InfoRow icon={Database} label="Database Tables" value={isSupabaseConfigured() ? 'Available' : 'Not available'} />
        <InfoRow icon={Cloud} label="File Storage" value={isSupabaseConfigured() ? 'Available' : 'Not available'} />
        <InfoRow icon={Shield} label="Row Level Security" value={isSupabaseConfigured() ? 'Enabled' : 'Not applicable'} />
      </SectionCard>

      {/* Notes */}
      <div className="glass-card rounded-2xl p-5 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Current Status:</strong> Using <strong>{dbConfig.provider}</strong> storage. 
          {isLocalStorage() ? ' localStorage is active and Supabase is ready for future migration.' : ' Supabase is the active storage provider.'}
        </p>
      </div>
    </div>
  )
}