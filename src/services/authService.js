// ─── Auth Service ─────────────────────────────────────────────
// Thin orchestration layer between AuthContext and authRepository.
// Pure Supabase — no local fallback, no mock users.

import { authRepository } from '../repositories/authRepository'

class AuthService {
  async login(email, password) {
    const { user, session } = await authRepository.signIn({ email, password })
    const profile = await authRepository.getProfile(user.id)
    if (!profile) throw new Error('User profile not found. Contact Administrator.')
    if (profile.status !== 'active') throw new Error('Account deactivated. Contact Administrator.')
    return { id: user.id, email: user.email, session, ...profile }
  }

  async logout() {
    await authRepository.signOut()
  }

  async getCurrentUser() {
    const authUser = await authRepository.getAuthUser()
    if (!authUser) return null
    const profile = await authRepository.getProfile(authUser.id)
    if (!profile) return null
    return { id: authUser.id, email: authUser.email, ...profile }
  }

  async restoreSession() {
    const session = await authRepository.getSession()
    if (!session?.user) return null
    const profile = await authRepository.getProfile(session.user.id)
    if (!profile || profile.status !== 'active') return null
    return { id: session.user.id, email: session.user.email, ...profile }
  }

  async sendPasswordReset(email) {
    await authRepository.sendPasswordReset(email)
  }

  async updatePassword(newPassword) {
    await authRepository.updatePassword(newPassword)
  }

  onAuthStateChange(callback) {
    return authRepository.onAuthStateChange(callback)
  }
}

export const authService = new AuthService()
export default AuthService