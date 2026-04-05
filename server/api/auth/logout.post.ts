export default defineEventHandler(async (event) => {
  // Clear the auth cookie
  deleteCookie(event, 'site-auth')
  return { success: true }
})
