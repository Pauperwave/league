## Active players this year (with associate info):

```sql
SELECT * FROM public.players_full
WHERE is_active = true
ORDER BY last_name, first_name;
```

## Tournament standings with player names (via join chain):

```sql
SELECT
  ts.player_rank,
  ts.player_score,
  ts.player_victories,
  ts.votes_brew_received,
  ts.votes_play_received,
  p.nickname,
  a.first_name,
  a.last_name
FROM public.tournament_standings ts
JOIN public.tournament_registrations tr ON tr.uuid = ts.registration_uuid
JOIN public.players p ON p.uuid = ts.player_uuid
JOIN public.pauperwave_associates a ON a.uuid = p.associate_uuid
WHERE tr.tournament_uuid = $1
ORDER BY ts.player_rank ASC;
```

## Check if a player is already registered for a tournament:

```sql
SELECT EXISTS (
  SELECT 1 FROM public.tournament_registrations
  WHERE tournament_uuid = $1
    AND player_uuid = $2
) AS is_registered;
```

## All payments for a given associate (by their UUID):

```sql
SELECT p.*
FROM public.pauperwave_payments p
JOIN public.pauperwave_associates a ON a.id = p.associate_id
WHERE a.uuid = $1
ORDER BY p.payment_date DESC;
```

## Monthly payment summary:

```sql
SELECT
  DATE_TRUNC('month', payment_date) AS month,
  payment_type,
  payment_method,
  COUNT(*) AS count,
  SUM(payment_amount) AS total
FROM public.pauperwave_payments
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 2;
```