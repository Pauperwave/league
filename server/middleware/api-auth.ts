// server\middleware\api-auth.ts
// The site-password gate, enforced at the API layer for every endpoint under
// /api/ (the route middleware only guards page navigation, not direct calls).
// Centralized here so a new BFF endpoint can't forget the check. The session
// is a sealed httpOnly cookie (nuxt-auth-utils), so it can't be forged the
// way the old static site-auth cookie could. Skipped for /api/auth/* (login
// must work without a session) and /api/_* (Nuxt module internals: the icon
// server bundle, nuxt-auth-utils' own /api/_auth/session, ...).
export default defineEventHandler(async (event) => {
  const path = event.path
  if (!path.startsWith('/api/')) return
  if (path.startsWith('/api/auth/') || path.startsWith('/api/_')) return

  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Not authenticated'
    })
  }
})
