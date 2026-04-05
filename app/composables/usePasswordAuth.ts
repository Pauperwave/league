const AUTH_COOKIE_NAME = 'site-auth'

export function usePasswordAuth() {
  const isAuthenticated = useState('site-auth-state', () => false)

  // Check cookie on client side (for UI state)
  onMounted(() => {
    isAuthenticated.value = document.cookie.includes(`${AUTH_COOKIE_NAME}=authenticated`)
  })

  async function login(password: string): Promise<boolean> {
    try {
      await $fetch('/api/auth/login', {
        method: 'POST',
        body: { password }
      })
      isAuthenticated.value = true
      return true
    } catch {
      return false
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    isAuthenticated.value = false
    navigateTo('/login')
  }

  return {
    isAuthenticated,
    login,
    logout
  }
}
