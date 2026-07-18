// app\composables\deck\useLenderSelection.ts
/** Shared borrowed-deck / lender-picker state used by DeckCreateModal and DeckEditModal. */
export function useLenderSelection(playerId: () => number) {
  // Colada cache of all players (ADR-015) — auto-fetched, no manual load
  const { data: players } = usePlayersQuery()

  const isBorrowed = ref(false)
  const lenderId = ref<string | undefined>(undefined)

  const lenderOptions = computed(() =>
    (players.value ?? [])
      .filter(p => p.player_id !== playerId())
      .map(p => ({
        label: `${p.player_name} ${p.player_surname}`,
        value: String(p.player_id)
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  )

  return { isBorrowed, lenderId, lenderOptions }
}
