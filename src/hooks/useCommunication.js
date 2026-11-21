// ─── useCommunication Hook ───────────────────────────────────
// Lightweight per-component hook for reading communication state.

import { useCommunication as _useCommunicationCtx } from '../context/CommunicationContext'
import { CHANNELS, EVENTS } from '../services/communicationService'

export { CHANNELS, EVENTS }

/**
 * Main hook — wraps CommunicationContext.
 * Falls back gracefully when used outside the provider.
 */
export function useCommunicationCtx() {
  try {
    return _useCommunicationCtx()
  } catch {
    return {
      notifications:[], unreadCount:0, notifLoading:false,
      loadNotifs:()=>{}, markRead:()=>{}, markAllRead:()=>{},
      archive:()=>{}, dismiss:()=>{},
      commLogs:[], logsTotal:0, logsLoading:false, loadLogs:()=>{},
      analytics:[], engineStats:{}, loadAnalytics:()=>{},
      preferences:null, prefLoading:false, updatePreferences:()=>{},
      providers:[], scheduledJobs:[],
    }
  }
}

export default useCommunicationCtx
