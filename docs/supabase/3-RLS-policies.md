# RLS POLICIES

Here's a structured set of policies for the tables that are missing them. They assume you have a `has_management_permissions(uuid)` function (already referenced in your schema) and a `user_roles` table with roles like `admin`, `organizer`, `judge`.

The pattern is consistent across all tables:
- Reference/public data (`leagues`, `mtg_formats`, etc.) → `public_read` + `management_full_access`
- Player-owned data → `public_read` or no read + `player_*` scoped policy + `management_full_access`
- Sensitive data (`pauperwave_associates`, `pauperwave_payments`) → no public read, scoped player read only + `management_full_access`

## pauperwave_associates

```sql
-- Anyone with management permissions sees all associates
CREATE POLICY management_full_access ON public.pauperwave_associates
FOR ALL
USING (public.has_management_permissions(auth.uid()))
WITH CHECK (public.has_management_permissions(auth.uid()));

-- A player can see their own associate record
CREATE POLICY player_own_associate ON public.pauperwave_associates
FOR SELECT
USING (
  uuid = (
    SELECT associate_uuid FROM public.players
    WHERE user_id = auth.uid()
  )
);
```

## pauperwave_associate_renewals

```sql
CREATE POLICY management_full_access ON public.pauperwave_associate_renewals
FOR ALL
USING (public.has_management_permissions(auth.uid()))
WITH CHECK (public.has_management_permissions(auth.uid()));

CREATE POLICY player_own_renewals ON public.pauperwave_associate_renewals
FOR SELECT
USING (
  associate_uuid = (
    SELECT associate_uuid FROM public.players
    WHERE user_id = auth.uid()
  )
);
```

## pauperwave_payments

```sql
-- Only management can see all payments
CREATE POLICY management_full_access ON public.pauperwave_payments
FOR ALL
USING (public.has_management_permissions(auth.uid()))
WITH CHECK (public.has_management_permissions(auth.uid()));

-- A player can see only their own payments
CREATE POLICY player_own_payments ON public.pauperwave_payments
FOR SELECT
USING (
  associate_uuid = (
    SELECT associate_uuid FROM public.players
    WHERE user_id = auth.uid()
  )
);
```

## tournaments

```sql
-- Public: anyone can read tournaments
CREATE POLICY public_read ON public.tournaments
FOR SELECT USING (true);

-- Management: full access
CREATE POLICY management_full_access ON public.tournaments
FOR ALL
USING (public.has_management_permissions(auth.uid()))
WITH CHECK (public.has_management_permissions(auth.uid()));
```

## tournament_registrations

```sql
-- Players can see all registrations (for a tournament's participant list)
CREATE POLICY public_read ON public.tournament_registrations
FOR SELECT USING (true);

-- Players can register/unregister themselves only
CREATE POLICY player_own_registration ON public.tournament_registrations
FOR INSERT
WITH CHECK (
  player_uuid = (
    SELECT uuid FROM public.players WHERE user_id = auth.uid()
  )
);

CREATE POLICY player_delete_own ON public.tournament_registrations
FOR DELETE
USING (
  player_uuid = (
    SELECT uuid FROM public.players WHERE user_id = auth.uid()
  )
);

-- Management: full access (approve, remove, etc.)
CREATE POLICY management_full_access ON public.tournament_registrations
FOR ALL
USING (public.has_management_permissions(auth.uid()))
WITH CHECK (public.has_management_permissions(auth.uid()));
```

## tournament_standings

```sql
-- Public read: standings are meant to be visible
CREATE POLICY public_read ON public.tournament_standings
FOR SELECT USING (true);

-- Management writes
CREATE POLICY management_full_access ON public.tournament_standings
FOR ALL
USING (public.has_management_permissions(auth.uid()))
WITH CHECK (public.has_management_permissions(auth.uid()));
```

## event_attendees

```sql
CREATE POLICY public_read ON public.event_attendees
FOR SELECT USING (true);

CREATE POLICY player_register_self ON public.event_attendees
FOR INSERT
WITH CHECK (
  player_uuid = (
    SELECT uuid FROM public.players WHERE user_id = auth.uid()
  )
);

CREATE POLICY management_full_access ON public.event_attendees
FOR ALL
USING (public.has_management_permissions(auth.uid()))
WITH CHECK (public.has_management_permissions(auth.uid()));
```

## players

```sql
CREATE POLICY public_read ON public.players
FOR SELECT USING (true);

CREATE POLICY player_update_self ON public.players
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY management_full_access ON public.players
FOR ALL
USING (public.has_management_permissions(auth.uid()))
WITH CHECK (public.has_management_permissions(auth.uid()));
```

## player_formats

```sql
CREATE POLICY public_read ON public.player_formats
FOR SELECT USING (true);

CREATE POLICY player_manage_own ON public.player_formats
FOR ALL
USING (
  player_uuid = (
    SELECT uuid FROM public.players WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  player_uuid = (
    SELECT uuid FROM public.players WHERE user_id = auth.uid()
  )
);

CREATE POLICY management_full_access ON public.player_formats
FOR ALL
USING (public.has_management_permissions(auth.uid()))
WITH CHECK (public.has_management_permissions(auth.uid()));
```

## user_roles

```sql
-- Only admins can manage roles
CREATE POLICY admin_full_access ON public.user_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Users can read their own roles (e.g. to know what UI to show)
CREATE POLICY user_read_own_roles ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());
```

Tables with no RLS enabled at all (leagues, mtg_formats, mtg_color_combinations, rulesets): These look like reference/public data. If they're truly read-only for end users, the simplest approach is:

```sql
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mtg_formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mtg_color_combinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rulesets ENABLE ROW LEVEL SECURITY;

-- Public read for all
CREATE POLICY public_read ON public.leagues FOR SELECT USING (true);
CREATE POLICY public_read ON public.mtg_formats FOR SELECT USING (true);
CREATE POLICY public_read ON public.mtg_color_combinations FOR SELECT USING (true);
CREATE POLICY public_read ON public.rulesets FOR SELECT USING (true);

-- Management writes
CREATE POLICY management_full_access ON public.leagues
  FOR ALL USING (public.has_management_permissions(auth.uid()))
  WITH CHECK (public.has_management_permissions(auth.uid()));
-- (repeat for the others)
```
