export default defineNuxtPlugin((_nuxtApp) => {
  const router = useRouter()

  router.afterEach((to, from) => {
    console.log('[ROUTE CHANGE]', {
      from: from.fullPath,
      to: to.fullPath,
      query: to.query,
      params: to.params,
    })
  })
})
