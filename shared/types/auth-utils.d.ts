// shared\types\auth-utils.d.ts
// Session payload for nuxt-auth-utils: no per-user accounts (single site
// password), so the "user" is just the admin marker whose presence makes
// useUserSession().loggedIn true after login. Will grow real identity fields
// when per-player Supabase Auth lands (see ADR-013's future evolution note).
declare module '#auth-utils' {
  interface User {
    admin: boolean
  }
}

export {}
