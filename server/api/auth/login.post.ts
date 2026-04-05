import * as v from 'valibot'

const bodySchema = v.object({
  password: v.string()
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)

  // Validate with valibot
  const parsed = v.safeParse(bodySchema, body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const { password } = parsed.output
  console.log('Server received password:', password)
  console.log('Expected password:', config.sitePassword)

  if (password !== config.sitePassword) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid password'
    })
  }

  // Set cookie (readable by middleware, secure with sameSite)
  setCookie(event, 'site-auth', 'authenticated', {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 1 week
  })

  return { success: true }
})
