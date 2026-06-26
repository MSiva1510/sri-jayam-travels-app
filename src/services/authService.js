// ─────────────────────────────────────────────────────────────────────
// AUTH SERVICE
// High-level authentication service
// ─────────────────────────────────────────────────────────────────────

import { authRepository } from '../repositories/authRepository'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../config/database'
import { isSupabaseConfigured } from '../lib/supabase'

/**
 * AuthService - Manages authentication operations
 */
export class AuthService {
  /**
   * Login user with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} User object with profile
   */
  async login(email, password) {
    // Check if using Supabase
    if (isSupabaseConfigured() && getDatabaseProvider() === DATABASE_PROVIDERS.SUPABASE) {
      return this._loginSupabase(email, password)
    }

    // Fallback to mock (for development)
    return this._loginLocal(email, password)
  }

  /**
   * Logout user
   * @returns {Promise<void>}
   */
  async logout() {
    if (isSupabaseConfigured() && getDatabaseProvider() === DATABASE_PROVIDERS.SUPABASE) {
      await authRepository.signOut()
    }
  }

  /**
   * Get current user
   * @returns {Promise<Object|null>}
   */
  async getCurrentUser() {
    if (isSupabaseConfigured() && getDatabaseProvider() === DATABASE_PROVIDERS.SUPABASE) {
      const user = await authRepository.getUser()
      if (!user) return null

      const profile = await authRepository.getUserProfile(user.id)
      return {
        id: user.id,
        email: user.email,
        ...profile,
      }
    }

    return null
  }

  /**
   * Restore session
   * @returns {Promise<Object|null>}
   */
  async restoreSession() {
    if (isSupabaseConfigured() && getDatabaseProvider() === DATABASE_PROVIDERS.SUPABASE) {
      try {
        const session = await authRepository.restoreSession()
        if (!session) return null

        const profile = await authRepository.getUserProfile(session.user.id)
        return {
          id: session.user.id,
          email: session.user.email,
          ...profile,
        }
      } catch (error) {
        console.error('Session restore failed:', error)
        return null
      }
    }

    return null
  }

  /**
   * Send password reset email
   * @param {string} email
   * @returns {Promise<void>}
   */
  async sendPasswordReset(email) {
    if (!isSupabaseConfigured()) {
      throw new Error('Password reset not available in local mode')
    }

    await authRepository.sendPasswordResetEmail(email)
  }

  /**
   * Update password
   * @param {string} newPassword
   * @returns {Promise<void>}
   */
  async updatePassword(newPassword) {
    if (!isSupabaseConfigured()) {
      throw new Error('Password update not available in local mode')
    }

    await authRepository.updatePassword(newPassword)
  }

  /**
   * Subscribe to auth state changes
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onAuthStateChange(callback) {
    if (isSupabaseConfigured() && getDatabaseProvider() === DATABASE_PROVIDERS.SUPABASE) {
      return authRepository.onAuthStateChange(callback)
    }

    return () => {}
  }

  /**
   * Login with Supabase
   * @private
   */
  async _loginSupabase(email, password) {
    const { user, session } = await authRepository.signIn({ email, password })

    // Fetch user profile
    let profile = await authRepository.getUserProfile(user.id)

    if (!profile) {
      // Create default profile if doesn't exist
      profile = await authRepository.createUserProfile({
        id: user.id,
        email: user.email,
        name: email.split('@')[0],
        role: 'driver',
        is_active: true,
      })
    }

    return {
      id: user.id,
      email: user.email,
      session,
      ...profile,
    }
  }

  /**
   * Login with local mock data
   * @private
   */
  async _loginLocal(email, password) {
    // This is a placeholder for local/mock authentication
    // Real implementation would use actual mock data
    throw new Error('Local authentication not implemented')
  }
}

export const authService = new AuthService()
export default AuthService