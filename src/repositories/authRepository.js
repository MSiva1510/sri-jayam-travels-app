// ─── Auth Repository ──────────────────────────────────────────
// Source of truth: auth.users (Supabase Auth) + public.profiles

import supabase from '../lib/supabase'

export class AuthRepository {

  async signIn({ email, password }) {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async signOut() {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  async getAuthUser() {
    if (!supabase) return null
    const { data, error } = await supabase.auth.getUser()
    if (error) return null
    return data.user
  }

  async getSession() {
    if (!supabase) return null
    const { data, error } = await supabase.auth.getSession()
    if (error) return null
    return data.session
  }

  // ── public.profiles CRUD ───────────────────────────────────

  async getProfile(userId) {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, phone, avatar_url, status, created_at, updated_at')
      .eq('id', userId)
      .single()
    if (error?.code === 'PGRST116') return null
    if (error) { console.error('[authRepository] getProfile:', error.message); return null }
    return data
  }

  async listProfiles() {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, phone, avatar_url, status, created_at, updated_at')
      .order('created_at', { ascending: false })
    if (error) { console.error('[authRepository] listProfiles:', error.message); return [] }
    return data || []
  }

  async createProfile({ id, email, full_name, role = 'driver', phone = null }) {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase
      .from('profiles')
      .insert([{ id, email, full_name, role, phone, status: 'active' }])
      .select()
      .single()
    if (error) throw error
    return data
  }

  async updateProfile(userId, updates) {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error
    return data
  }

  // ── Admin: create new user without losing admin session ────
  // supabase.auth.signUp() replaces the current session with the NEW
  // user's session. The profile row MUST be inserted under the admin's
  // session: RLS (profiles_insert) + the profiles trigger only allow
  // admins to create profiles, so we restore the admin session first.

  async adminCreateUser({ email, password, full_name, role = 'driver', phone = null }) {
    if (!supabase) throw new Error('Supabase not configured')
    if (!['admin', 'manager', 'driver'].includes(role)) throw new Error('Invalid role')

    // Step 1: Save current admin session tokens
    const { data: sessionData } = await supabase.auth.getSession()
    const adminSession = sessionData?.session
    if (!adminSession?.access_token || !adminSession?.refresh_token) {
      throw new Error('Admin session not found. Please sign in again.')
    }

    const restoreAdmin = async () => {
      const { error } = await supabase.auth.setSession({
        access_token:  adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      })
      if (error) throw new Error('Could not restore admin session: ' + error.message)
    }

    let newUser = null
    try {
      // Step 2: Create the new auth user (this swaps the client session)
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name, role } },
      })
      if (signUpErr) throw signUpErr
      newUser = signUpData.user
      if (!newUser) throw new Error('User creation failed — no user returned')
    } finally {
      // Step 3: Always put the admin back, whether sign-up succeeded or not
      await restoreAdmin()
    }

    // Step 4: Insert profile record — now running as the admin
    const profile = await this.createProfile({ id: newUser.id, email, full_name, role, phone })
    return { userId: newUser.id, email, profile }
  }

  // ── Password utilities ─────────────────────────────────────

  async sendPasswordReset(email) {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  async updatePassword(newPassword) {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  // ── Auth state listener ────────────────────────────────────

  onAuthStateChange(callback) {
    if (!supabase) return () => {}
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
    return () => subscription?.unsubscribe()
  }
}

export const authRepository = new AuthRepository()
export default AuthRepository