## `app_role` type + `user_roles` table

The `user_roles` table references `public.app_role` which must be created first as an enum:

```sql
-- 1. Enum type for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'organizer', 'judge', 'player');
-- never insert 'player' into user_roles.
-- It exists in the enum for type safety and as a valid return value from get_user_role, but the table stays a whitelist of elevated roles only.

-- 2. user_roles table + RLS + read policy
CREATE TABLE public.user_roles (
  id         uuid not null default gen_random_uuid(),
  user_id    uuid not null,
  role       public.app_role not null,
  created_at timestamptz null default now(),

  CONSTRAINT ck_user_roles_pkey primary key (id),
  CONSTRAINT ck_user_roles_user_id_role_key unique (user_id, role),
  CONSTRAINT ck_user_roles_user_id_fkey foreign key (user_id)
    references auth.users (id)
    on delete cascade
) tablespace pg_default;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
  ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role
  ON public.user_roles (role);

-- 4. RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
```

> ⚠️ Note: the `admin_full_access` policy is self-referential — it queries `user_roles` from within a policy on `user_roles`. Postgres handles this without infinite recursion because the inner query runs without RLS (since it's inside a policy expression), but only if the function is `SECURITY DEFINER`. To be safe, wrap the role check in the function below instead of inlining it.

## `has_management_permissions()` function

```sql
-- 3. has_management_permissions() function
CREATE OR REPLACE FUNCTION public.has_management_permissions(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE        -- same inputs = same output within a transaction, allows caching
SECURITY DEFINER  -- runs as the function owner, bypasses RLS on user_roles
SET search_path = public  -- prevents search_path injection
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_user_id
      AND role IN ('admin', 'organizer', 'judge')
  );
$$;
```

```sql
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = 'admin'
  );
$$;
```

## Il primo admin — manualmente via SQL

Il classico problema del bootstrap: nessuno ha ancora il ruolo admin, quindi nessuno può assegnarlo. Lo fai direttamente da Supabase SQL editor:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('uuid-dell-utente-da-auth.users', 'admin');
```

### Promozione di un utente — via funzione chiamata dall'admin

Per promuovere un utente a `organizer` o `judge`, un admin chiama questa funzione dal backend o da una UI interna:

```sql
-- 4. admin_full_access policy (needs the function, so it comes after)
CREATE POLICY admin_full_access ON public.user_roles
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
```

```sql
CREATE OR REPLACE FUNCTION public.assign_role(p_user_id uuid, p_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- solo un admin può chiamare questa funzione
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING; -- evita duplicati
END;
$$;
```

Chiamata dal frontend:
```ts
await supabase.rpc('assign_role', {
  p_user_id: 'uuid-utente',
  p_role: 'organizer'
})
```

```sql
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = p_user_id LIMIT 1),
    'player' -- default se non presente in tabella
  );
$$;
```

```ts
const { data } = await supabase.rpc('get_user_role', {
  p_user_id: user.id
})
// ritorna 'player' anche se non c'è nessuna riga in user_roles
```

## Creation order (to avoid FK/type errors):

1. Create the `app_role` enum type
2. auth.users (già esistente in Supabase)
3. Create the `user_roles` table
4. Create the `has_management_permissions()` function
5. Create the `is_admin()` function
6. Create the `get_user_role()` function
7. Create the `assign_role()` function
8. Create the `admin_full_access` policy on `user_roles`
9. Create the `pauperwave_associates` table
10. Create the `players` table
11. ... rest of your tables