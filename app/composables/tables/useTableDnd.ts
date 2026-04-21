// State and validation layer for table drag-and-drop plus pairing constraints/scoring.
import type {
  PairingForbiddenPair,
  PairingWeights,
  TournamentTable,
  Seat,
} from '#shared/utils/types'
import {
  getForbiddenPairKey,
  optimizePairings,
  scorePairingTables,
  type PairingPlayer,
  type PairingHistoryEntry,
  type PairingScoreDetails,
} from '@/composables/events/pairing/pairingOptimizer'
import { normalizePairingForbiddenPairs } from '@/composables/events/pairing/pairingPreferences'

function cloneTables(tables: TournamentTable[]): TournamentTable[] {
  return tables.map(table => ({
    id: table.id,
    tableNumber: table.tableNumber,
    seats: table.seats.map(seat => ({
      id: seat.id,
      player: seat.player
        ? {
            id: seat.player.id,
            name: seat.player.name,
            surname: seat.player.surname,
            seed: seat.player.seed,
            avatarUrl: seat.player.avatarUrl,
          }
        : null,
    })) as [Seat, Seat, Seat, Seat],
  }))
}

function normalizeSeats(tableId: string, seats: Seat[]): Seat[] {
  const players = seats
    .filter(seat => seat.player !== null)
    .slice(0, 5)
    .map((seat, index) => ({
      id: `${tableId}-seat-${index + 1}`,
      player: seat.player,
    }))

  const normalized: Seat[] = [...players]

  while (normalized.length < 5) {
    normalized.push({
      id: `${tableId}-seat-${normalized.length + 1}`,
      player: null,
    })
  }

  return normalized
}

function ensureTableSeatShape(tables: TournamentTable[]): TournamentTable[] {
  return tables.map((table) => {
    return {
      ...table,
      seats: normalizeSeats(table.id, [...table.seats]),
    }
  })
}

function buildTablesFromOrder(tables: TournamentTable[], playerOrder: number[]): TournamentTable[] {
  const sourcePlayers = tables
    .flatMap(table => table.seats)
    .map(seat => seat.player)
    .filter((player): player is NonNullable<Seat['player']> => player !== null)

  const playerMap = new Map(sourcePlayers.map(player => [player.id, player]))
  let cursor = 0

  return tables.map((table) => {
    const occupied = table.seats.filter(seat => seat.player !== null).length
    const nextSeats = Array.from({ length: 4 }, (_, index) => {
      const playerId = index < occupied ? playerOrder[cursor + index] : undefined
      const player = playerId !== undefined ? playerMap.get(playerId) ?? null : null

      return {
        id: `${table.id}-seat-${index + 1}`,
        player,
      }
    }) as [Seat, Seat, Seat, Seat]

    cursor += occupied

    return {
      ...table,
      seats: nextSeats,
    }
  })
}

export function useTableDnd(initialTables: TournamentTable[], params?: {
  playersForScoring?: PairingPlayer[]
  history?: PairingHistoryEntry[]
  currentRound?: number
  initialForbiddenPairs?: PairingForbiddenPair[]
  initialWeights?: Partial<PairingWeights>
}) {
  const sourceTables = ref<TournamentTable[]>(ensureTableSeatShape(cloneTables(initialTables)))
  const localTables = ref<TournamentTable[]>(ensureTableSeatShape(cloneTables(initialTables)))
  const isDragging = ref(false)

  const weights = ref<PairingWeights>({
    ...DEFAULT_PAIRING_WEIGHTS,
    ...(params?.initialWeights ?? {}),
  })

  const forbiddenPairs = ref<PairingForbiddenPair[]>(normalizePairingForbiddenPairs(params?.initialForbiddenPairs ?? []))

  const fallbackPlayersForScoring = computed<PairingPlayer[]>(() => {
    const ids = sourcePlayerIds.value
    return ids.map((id, index) => ({
      id,
      rank: index + 1,
      score: 0,
      table3Count: 0,
    }))
  })

  const playersForScoring = computed(() => {
    const provided = params?.playersForScoring ?? []
    if (provided.length > 0) return provided
    return fallbackPlayersForScoring.value
  })
  const history = computed(() => params?.history ?? [])
  const currentRound = computed(() => params?.currentRound ?? 1)

  const sourcePlayerIds = computed(() =>
    sourceTables.value
      .flatMap(table => table.seats)
      .map(seat => seat.player?.id)
      .filter((id): id is number => id !== undefined)
  )

  const localPlayerIds = computed(() =>
    localTables.value
      .flatMap(table => table.seats)
      .map(seat => seat.player?.id)
      .filter((id): id is number => id !== undefined)
  )

  const tableSizesValid = computed(() =>
    localTables.value.every((table) => {
      const players = table.seats.filter(seat => seat.player !== null).length
      return players >= 3 && players <= 4
    })
  )

  const noDuplicates = computed(() => new Set(localPlayerIds.value).size === localPlayerIds.value.length)

  const noMissingPlayers = computed(() => {
    if (sourcePlayerIds.value.length !== localPlayerIds.value.length) return false

    const localSet = new Set(localPlayerIds.value)
    return sourcePlayerIds.value.every(id => localSet.has(id))
  })

  const currentTablesAsIds = computed<number[][]>(() =>
    localTables.value
      .map(table => table.seats.map(seat => seat.player?.id).filter((id): id is number => id !== undefined))
      .filter(table => table.length > 0)
  )

  const scoreDetails = computed<PairingScoreDetails>(() => {
    return scorePairingTables({
      tables: currentTablesAsIds.value,
      players: playersForScoring.value,
      history: history.value,
      forbiddenPairs: forbiddenPairs.value,
      currentRound: currentRound.value,
      weights: weights.value,
    })
  })

  const isValid = computed(() =>
    tableSizesValid.value
    && noDuplicates.value
    && noMissingPlayers.value
    && scoreDetails.value.isValid
  )

  const playerOrder = computed(() =>
    [...localTables.value]
      .sort((a, b) => a.tableNumber - b.tableNumber)
      .flatMap(table => table.seats)
      .map(seat => seat.player?.id)
      .filter((id): id is number => id !== undefined)
  )

  const forbiddenPairMap = computed(() => {
    const map = new Set<string>()
    for (const pair of forbiddenPairs.value) {
      map.add(getForbiddenPairKey(pair.playerA, pair.playerB))
    }
    return map
  })

  const conflictingTables = computed(() => {
    const conflicts = new Set<string>()

    for (const table of localTables.value) {
      const playerIds = table.seats
        .map(seat => seat.player?.id)
        .filter((id): id is number => id !== undefined)

      for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
          const left = playerIds[i]
          const right = playerIds[j]
          if (left === undefined || right === undefined) continue

          const key = getForbiddenPairKey(left, right)
          if (forbiddenPairMap.value.has(key)) {
            conflicts.add(table.id)
          }
        }
      }
    }

    return conflicts
  })

  const previewError = computed(() => {
    if (!tableSizesValid.value) return 'Ogni tavolo deve avere tra 3 e 4 giocatori'
    if (!noDuplicates.value) return 'Ci sono giocatori duplicati nei tavoli'
    if (!noMissingPlayers.value) return 'Mancano giocatori nella disposizione tavoli'
    if (!scoreDetails.value.isValid) return 'Sono presenti coppie vietate nello stesso tavolo'
    return ''
  })

  function setDragging(value: boolean) {
    isDragging.value = value
  }

  function reset() {
    localTables.value = ensureTableSeatShape(cloneTables(sourceTables.value))
    isDragging.value = false
  }

  function syncFromSource(tables: TournamentTable[]) {
    const normalized = ensureTableSeatShape(cloneTables(tables))
    sourceTables.value = normalized
    localTables.value = ensureTableSeatShape(cloneTables(normalized))
    isDragging.value = false
  }

  function normalizeLocalTables() {
    localTables.value = ensureTableSeatShape(cloneTables(localTables.value))
  }

  function replaceByPlayerOrder(order: number[]) {
    const normalized = ensureTableSeatShape(buildTablesFromOrder(localTables.value, order))
    localTables.value = normalized
  }

  function cloneCurrentTables() {
    return ensureTableSeatShape(cloneTables(localTables.value))
  }

  function restoreTables(tables: TournamentTable[]) {
    localTables.value = ensureTableSeatShape(cloneTables(tables))
  }

  function tableStatus(table: TournamentTable) {
    if (conflictingTables.value.has(table.id)) {
      return { color: 'error' as const, label: 'Conflitto' }
    }

    const players = table.seats.filter(seat => seat.player !== null).length

    if (players === 4) {
      return { color: 'success' as const, label: '4/4' }
    }

    if (players === 3) {
      return { color: 'warning' as const, label: '3/4' }
    }

    return { color: 'error' as const, label: `${players}/4` }
  }

  function addForbiddenPair(playerA: number, playerB: number) {
    if (playerA === playerB) return
    const normalized = normalizePairingForbiddenPairs([...forbiddenPairs.value, { playerA, playerB }])
    forbiddenPairs.value = normalized
  }

  function removeForbiddenPair(playerA: number, playerB: number) {
    const key = getForbiddenPairKey(playerA, playerB)
    forbiddenPairs.value = forbiddenPairs.value.filter(
      pair => getForbiddenPairKey(pair.playerA, pair.playerB) !== key
    )
  }

  function setWeights(nextWeights: Partial<PairingWeights>) {
    weights.value = {
      ...weights.value,
      ...nextWeights,
    }
  }

  function setForbiddenPairs(nextPairs: PairingForbiddenPair[]) {
    forbiddenPairs.value = normalizePairingForbiddenPairs(nextPairs)
  }

  function runOptimizer(swapTimeBudgetMs = 120) {
    if (!playersForScoring.value.length) return false

    const result = optimizePairings({
      players: playersForScoring.value,
      history: history.value,
      forbiddenPairs: forbiddenPairs.value,
      weights: weights.value,
      currentRound: currentRound.value,
      swapTimeBudgetMs,
    })

    if (!Number.isFinite(result.totalScore)) return false

    replaceByPlayerOrder(result.tables.flat())
    return true
  }

  return {
    localTables,
    isDragging,
    isValid,
    previewError,
    playerOrder,
    tableStatus,
    setDragging,
    reset,
    syncFromSource,
    normalizeLocalTables,
    replaceByPlayerOrder,
    cloneCurrentTables,
    restoreTables,
    runOptimizer,
    scoreDetails,
    weights,
    forbiddenPairs,
    addForbiddenPair,
    removeForbiddenPair,
    setWeights,
    setForbiddenPairs,
    conflictingTables,
  }
}
