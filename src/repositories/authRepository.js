// ─────────────────────────────────────────────────────────────────────
// AUTH REPOSITORY
// Handles Supabase authentication operations
// ─────────────────────────────────────────────────────────────────────

import supabase from '../lib/supabase'
import { getDatabaseProvider, DATABASE_PROVIDERS } from '../config/database'

/**
 * AuthRepository - Manages Supabase authentication
 */
export class AuthRepository {
  /**
   * Sign up a new user
   * @param {Object} credentials
   * @param {string} credentials.email
   * @param {string} credentials.password
   * @returns {Promise<Object>} User and session
   */
  async signUp(credentials) {
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
    })

    if (error) throw error
    return data
  }

  /**
   * Sign in user with email and password
   * @param {Object} credentials
   * @param {string} credentials.email
   * @param {string} credentials.password
   * @returns {Promise<Object>} User and session
   */
  async signIn(credentials) {
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    })

    if (error) throw error
    return data
  }

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  async signOut() {
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  /**
   * Get current session
   * @returns {Promise<Object|null>} Current session or null
   */
  async getSession() {
    if (!supabase) {
      return null
    }

    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  }

  /**
   * Get current user
   * @returns {Promise<Object|null>} Current user or null
   */
  async getUser() {
    if (!supabase) {
      return null
    }

    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    return data.user
  }

  /**
   * Restore session from storage
   * @returns {Promise<Object|null>} Session or null
   */
  async restoreSession() {
    if (!supabase) {
      return null
    }

    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) {
        console.warn('Session restore failed:', error.message)
        return null
      }
      return data.session
    } catch (error) {
      console.warn('Session restore error:', error)
      return null
    }
  }

  /**
   * Get user profile from users table
   * @param {string} userId - Auth user ID
   * @returns {Promise<Object|null>} User profile or null
   */
  async getUserProfile(userId) {
    if (!supabase) {
      return null
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code === 'PGRST116') {
        return null  // Not found
      }

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }

  /**
   * Create user profile in users table
   * @param {Object} profile
   * @returns {Promise<Object>} Created profile
   */
  async createUserProfile(profile) {
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    const { data, error } = await supabase
      .from('users')
      .insert([profile])
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updates - Profile updates
   * @returns {Promise<Object>} Updated profile
   */
  async updateUserProfile(userId, updates) {
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Send password reset email
   * @param {string} email - User email
   * @returns {Promise<void>}
   */
  async sendPasswordResetEmail(email) {
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) throw error
  }

  /**
   * Update password
   * @param {string} newPassword - New password
   * @returns {Promise<void>}
   */
  async updatePassword(newPassword) {
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) throw error
  }

  /**
   * Subscribe to auth state changes
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onAuthStateChange(callback) {
    if (!supabase) {
      return () => {}
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        callback(event, session)
      }
    )

    return () => subscription?.unsubscribe()
  }
}

export const authRepository = new AuthRepository()
export default AuthRepository