export default defineNuxtRouteMiddleware((to) => {
  // Skip login page
  if (to.path === '/login') return

  // Check for auth cookie (works on both server and client)
  const authCookie = useCookie('site-auth')

  if (!authCookie.value || authCookie.value !== 'authenticated') {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }
})
