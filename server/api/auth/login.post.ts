// server\api\auth\login.post.ts
import * as v from 'valibot'

const bodySchema = v.object({
  password: v.string()
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const { password } = await requireValidBody(event, bodySchema)

  if (!config.sitePassword) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server misconfigured'
    })
  }

  if (password !== config.sitePassword) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid password'
    })
  }

  // Sealed httpOnly session cookie (nuxt-auth-utils) — unforgeable, unlike the
  // old static site-auth cookie. maxAge lives in nuxt.config runtimeConfig.session.
  await setUserSession(event, { user: { admin: true } })

  // Drop the legacy cookie from browsers that still carry it.
  deleteCookie(event, 'site-auth')

  return { success: true }
})
