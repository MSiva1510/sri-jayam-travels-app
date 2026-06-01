import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, Navigation, MapPin,
  Signal, WifiOff, Satellite,
} from 'lucide-react'
import { useGPS, loadActiveRideGPS } from '../../hooks/useGPS'
import GPSStatusCard from '../../components/gps/GPSStatusCard'
import LocationPinCard from '../../components/gps/LocationPinCard'

export default function LiveLocation() {
  const navigate    = useNavigate()
  const gps         = useGPS()
  const activeRide  = loadActiveRideGPS()

  // Auto-request on mount
  useEffect(() => {
    gps.requestCurrent()
  }, [])

  return (
    <div className="space-y-4 max-w-lg mx-auto animate-fade-up pb-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/driver')}
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-800/60 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-black text-slate-800 dark:text-white text-xl">Live Location</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Real-time GPS tracking</p>
        </div>
        {/* GPS status dot */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
          ${gps.status === 'granted'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : gps.status === 'requesting'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            : 'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-400'
          }`}>
          <span className={`w-2 h-2 rounded-full
            ${gps.status === 'granted' ? 'bg-emerald-500' : gps.status === 'requesting' ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'}`} />
          {gps.status === 'granted' ? 'Active' : gps.status === 'requesting' ? 'Acquiring' : 'Offline'}
        </div>
      </div>

      {/* Current GPS card */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-0.5">
          Current Location
        </p>
        <GPSStatusCard
          status={gps.status}
          coord={gps.currentCoord}
          error={gps.error}
          loading={gps.loading}
          onRefresh={gps.requestCurrent}
        />
      </div>

      {/* Current location pin */}
      {gps.currentCoord && (
        <LocationPinCard type="current" coord={gps.currentCoord} label="You are here" />
      )}

      {/* Active ride GPS data */}
      {activeRide && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-0.5">
            Active Ride
          </p>

          {activeRide.startCoord && (
            <LocationPinCard
              type="start"
              coord={activeRide.startCoord}
              time={activeRide.startCoord.timestamp ? new Date(activeRide.startCoord.timestamp).toLocaleTimeString() : undefined}
            />
          )}

          {activeRide.endCoord && (
            <div className="mt-3">
              <LocationPinCard
                type="end"
                coord={activeRide.endCoord}
                time={activeRide.endCoord.timestamp ? new Date(activeRide.endCoord.timestamp).toLocaleTimeString() : undefined}
              />
            </div>
          )}

          {/* Route line if both captured */}
          {activeRide.startCoord && activeRide.endCoord && (
            <div className="glass-card rounded-2xl p-4 mt-3">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                Trip Route Summary
              </p>
              <div className="flex items-stretch gap-3">
                <div className="flex flex-col items-center gap-1 pt-1">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
                  <div className="flex-1 w-0.5 border-l-2 border-dashed border-slate-300 dark:border-navy-600 min-h-[32px]" />
                  <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-0.5">Trip Start</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{activeRide.startCoord.area}</p>
                    <p className="text-[10px] font-mono text-slate-400">{activeRide.startCoord.lat}, {activeRide.startCoord.lng}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-0.5">Trip End</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{activeRide.endCoord.area}</p>
                    <p className="text-[10px] font-mono text-slate-400">{activeRide.endCoord.lat}, {activeRide.endCoord.lng}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No active ride */}
      {!activeRide && (
        <div className="glass-card rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center mx-auto mb-3">
            <Satellite size={22} className="text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">No Active Ride</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
            GPS coordinates are captured automatically when you start a ride. Start a trip from the Driver Home to track your location.
          </p>
          <button
            onClick={() => navigate('/driver')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-900 dark:bg-blue-700 text-white text-xs font-bold hover:bg-navy-800 dark:hover:bg-blue-600 transition-all shadow-md"
          >
            <Navigation size={13} /> Go to Driver Home
          </button>
        </div>
      )}

      {/* Unsupported browser */}
      {!gps.isSupported && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4">
          <WifiOff size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">GPS Not Supported</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 leading-relaxed">
              Your browser doesn't support geolocation. Please use Chrome, Firefox, or Safari on Android/iOS for GPS features.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
