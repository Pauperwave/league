// server\api\auth\logout.post.ts
export default defineEventHandler(async (event) => {
  // Clear the auth cookie
  deleteCookie(event, 'site-auth')
  return { success: true }
})
