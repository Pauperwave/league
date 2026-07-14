// app\composables\event\useSessionStorePersistence.ts
import { onMounted, watch } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { Kill } from '#shared/utils/types'
import type { RankingEntry } from '~/stores/rankings'
import type { CommanderEntry } from '~/stores/commanders'
import type { VoteEntry } from '~/stores/votes'
import { getCached, setCached } from '~/utils/localStorage'
import { logInfo } from '~/utils/logger'

/**
 * Crash insurance for in-progress round entry (see ADR discussion 2026-07-14):
 * mirrors the four session stores (rankings, kills, votes, commanders) to
 * localStorage so a refresh/tab-kill mid-round doesn't lose typed-but-unsaved
 * data. One key per event; the snapshot embeds the round number, so any round
 * change (advance or turn-back) self-invalidates stale data — the post-reset
 * save simply overwrites the snapshot with the new round's empty state.
 *
 * This is deliberately NOT the future multi-player realtime system: when
 * player self-entry lands (docs/BACKLOG.md #2), in-progress entry moves into
 * DB rows + Supabase Realtime at the store level, feeding the same
 * `hydrate()` entry points this composable uses. Components stay untouched
 * either way.
 *
 * Stores are typed structurally (only the state and `hydrate` used here) so
 * tests can pass lightweight reactive fakes — the real kills store calls
 * `useI18n()` at setup, which plain unit tests can't provide.
 */

/** Snapshot must stay pure JSON: Maps/Sets are flattened to arrays. */
export interface SessionSnapshot {
  round: number
  rankings: [number, RankingEntry[]][]
  kills: Kill[]
  confirmedPairings: number[]
  commanders: CommanderEntry[]
  votes: VoteEntry[]
}

interface RankingsStoreLike {
  rankingsWithRanks: Map<number, RankingEntry[]>
  hydrate: (entries: [number, RankingEntry[]][]) => void
}

interface KillsStoreLike {
  kills: Kill[]
  confirmedPairings: Set<number>
  hydrate: (snapshot: { kills: Kill[]; confirmedPairings: number[] }) => void
}

interface CommandersStoreLike {
  commanders: Map<number, CommanderEntry>
  hydrate: (entries: CommanderEntry[]) => void
}

interface VotesStoreLike {
  votes: Map<number, VoteEntry>
  hydrate: (entries: VoteEntry[]) => void
}

/** A league night; anything older than this is stale and dropped by getCached. */
const SNAPSHOT_TTL_MS = 12 * 60 * 60 * 1000

export function sessionSnapshotKey(eventId: number): string {
  return `event-session-${eventId}`
}

export function useSessionStorePersistence(params: {
  eventId: number
  currentRound: Ref<number> | ComputedRef<number>
  rankingsStore: RankingsStoreLike
  killsStore: KillsStoreLike
  commandersStore: CommandersStoreLike
  votesStore: VotesStoreLike
}) {
  const { eventId, currentRound, rankingsStore, killsStore, commandersStore, votesStore } = params
  const key = sessionSnapshotKey(eventId)

  function buildSnapshot(): SessionSnapshot {
    return {
      round: currentRound.value,
      rankings: Array.from(rankingsStore.rankingsWithRanks.entries()),
      kills: [...killsStore.kills],
      confirmedPairings: Array.from(killsStore.confirmedPairings),
      commanders: Array.from(commandersStore.commanders.values()),
      votes: Array.from(votesStore.votes.values()),
    }
  }

  function persist() {
    setCached(key, buildSnapshot())
  }

  function hydrateFromStorage() {
    const snapshot = getCached<SessionSnapshot>(key, SNAPSHOT_TTL_MS)
    if (!snapshot || snapshot.round !== currentRound.value) return

    rankingsStore.hydrate(snapshot.rankings)
    killsStore.hydrate({ kills: snapshot.kills, confirmedPairings: snapshot.confirmedPairings })
    commandersStore.hydrate(snapshot.commanders)
    votesStore.hydrate(snapshot.votes)
    logInfo('useSessionStorePersistence', `restored round ${snapshot.round} session state for event ${eventId}`)
  }

  // Hydrate in onMounted, not setup: session stores are empty in the
  // server-rendered HTML, so mutating them during client setup would cause
  // hydration mismatches. The persist watcher only starts after hydration so
  // an empty initial state can't overwrite a good snapshot.
  onMounted(() => {
    hydrateFromStorage()
    watch(
      [
        () => rankingsStore.rankingsWithRanks,
        () => killsStore.kills,
        () => killsStore.confirmedPairings,
        () => commandersStore.commanders,
        () => votesStore.votes,
      ],
      persist,
      { deep: true },
    )
  })
}
