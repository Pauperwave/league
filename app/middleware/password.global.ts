// app\middleware\password.global.ts
export default defineNuxtRouteMiddleware((to) => {
  // Skip login page
  if (to.path === '/login') return

  // Sealed-session state (nuxt-auth-utils), hydrated server-side by the
  // module's plugin — works on SSR and client navigations even though the
  // session cookie itself is httpOnly (invisible to document.cookie).
  const { loggedIn } = useUserSession()

  if (!loggedIn.value) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }
})
