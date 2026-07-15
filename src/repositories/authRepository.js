// ─── Auth Repository ──────────────────────────────────────────
// Source of truth: auth.users (Supabase Auth) + public.profiles
// Never reads from public.users — that table is retired.

import supabase from '../lib/supabase'

class AuthRepository {

  // ── Sign in ────────────────────────────────────────────────
  async signIn({ email, password }) {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data   // { user, session }
  }

  // ── Sign out ───────────────────────────────────────────────
  async signOut() {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  // ── Get current auth user ──────────────────────────────────
  async getAuthUser() {
    if (!supabase) return null
    const { data, error } = await supabase.auth.getUser()
    if (error) return null
    return data.user
  }

  // ── Get current session ────────────────────────────────────
  async getSession() {
    if (!supabase) return null
    const { data, error } = await supabase.auth.getSession()
    if (error) return null
    return data.session
  }

  // ── Fetch profile from public.profiles ─────────────────────
  async getProfile(userId) {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, phone, avatar_url, status, created_at, updated_at')
      .eq('id', userId)
      .single()

    if (error?.code === 'PGRST116') return null   // not found — not an error
    if (error) { console.error('[authRepository] getProfile:', error.message); return null }
    return data
  }

  // ── List all profiles (admin use) ──────────────────────────
  async listProfiles() {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, phone, avatar_url, status, created_at, updated_at')
      .order('created_at', { ascending: false })
    if (error) { console.error('[authRepository] listProfiles:', error.message); return [] }
    return data || []
  }

  // ── Create profile record (called after auth.signUp) ────────
  async createProfile({ id, email, full_name, role = 'driver', phone = null }) {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase
      .from('profiles')
      .insert([{
        id,
        email,
        full_name,
        role,
        phone,
        status: 'active',
      }])
      .select()
      .single()
    if (error) throw error
    return data
  }

  // ── Update profile ─────────────────────────────────────────
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

  // ── Create new auth user + profile (admin action) ──────────
  // Uses signUp — Disable "Confirm email" in Supabase Auth Settings
  // for immediate access without email verification.
  async adminCreateUser({ email, password, full_name, role = 'driver', phone = null }) {
    if (!supabase) throw new Error('Supabase not configured')

    // Step 1: Create auth.users record
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: undefined },
    })
    if (signUpErr) throw signUpErr

    const authUser = signUpData.user
    if (!authUser) throw new Error('User creation returned no user object')

    // Step 2: Insert matching profile
    const profile = await this.createProfile({
      id: authUser.id,
      email,
      full_name,
      role,
      phone,
    })

    return { authUser, profile }
  }

  // ── Send password reset email ──────────────────────────────
  async sendPasswordReset(email) {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  // ── Update auth user password ──────────────────────────────
  async updatePassword(newPassword) {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  // ── Subscribe to auth state changes ───────────────────────
  onAuthStateChange(callback) {
    if (!supabase) return () => {}
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
    return () => subscription?.unsubscribe()
  }
}

export const authRepository = new AuthRepository()
export default AuthRepository