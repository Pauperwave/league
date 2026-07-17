// app\composables\auth\usePasswordAuth.ts
export function usePasswordAuth() {
  // Sealed-session state from nuxt-auth-utils; the cookie is httpOnly, so the
  // client never reads it directly — it tracks the module's session state.
  const { loggedIn, fetch: refreshSession, clear } = useUserSession()

  async function login(password: string): Promise<boolean> {
    try {
      await $fetch('/api/auth/login', {
        method: 'POST',
        body: { password }
      })
      // The login response set the sealed cookie; sync the client-side
      // session state before navigating, or the route middleware still
      // sees loggedIn=false and bounces back to /login.
      await refreshSession()
      return true
    } catch {
      return false
    }
  }

  async function logout() {
    // Clears the session server-side (module's own /api/_auth/session route)
    // and resets the client state in one call.
    await clear()
    navigateTo('/login')
  }

  return {
    isAuthenticated: loggedIn,
    login,
    logout
  }
}
