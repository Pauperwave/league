<!-- app\components\tournament\round-status\RoundStatusCard.vue -->
<script setup lang="ts">
import type { PairingWithResults, TablePlayer } from '#shared/utils/types'
import type { RoundStatusFilter } from '~/utils/roundStatusSearch'

/**
 * Sidebar summary of round-entry progress: 4 collapsible sections
 * (rankings/kills per table, commanders/votes per player), each row
 * clickable to open the matching modal — lets the admin see at a glance
 * what's left to enter this round instead of scanning every PairingsCard.
 */
const props = defineProps<{
  pairings: PairingWithResults[]
  tournamentPlayers: TablePlayer[]
}>()

const emit = defineEmits<{
  /** Opens the score entry modal for a specific pairing and table. */
  openScoreModal: [pairingId: number, tableIndex: number]
  /** Opens the kill entry modal for a given pairing. */
  openKillModal: [pairingId: number]
  /** Opens the commander selection modal for a specific player in a pairing. */
  openCommanderModal: [pairingId: number, playerId: number]
  /** Opens the vote entry modal for a specific player in a pairing. */
  openVotesModal: [pairingId: number, playerId: number]
}>()

const { t } = useI18n()

const rankingsStore = useRankingsStore()
const commandersStore = useCommandersStore()
const votesStore = useVotesStore()

const pairingsRef = toRef(props, 'pairings')
const playersRef = toRef(props, 'tournamentPlayers')

const {
  rankingItems,
  killItems,
  commanderItems,
  voteItems
} = useRoundStatus(
  pairingsRef, playersRef, rankingsStore, commandersStore, votesStore,
)

// ─── Filter & search ──────────────────────────────────────────────────────────

const filter = ref<RoundStatusFilter>('all')
const search = ref('')

function tableHaystack(tableNumber: number): string {
  return tableSearchLabel(tableNumber, t('tournament.pairing.tableHeading', { n: tableNumber }))
}

const filteredRankingItems = computed(() =>
  rankingItems.value.filter(item =>
    matchesRoundStatusFilter(item.done, filter.value) &&
    matchesRoundStatusSearch(`${item.playerNames.join(' ')} ${tableHaystack(item.tableNumber)}`, search.value)))

const filteredKillItems = computed(() =>
  killItems.value.filter(item =>
    matchesRoundStatusFilter(item.done, filter.value) &&
    matchesRoundStatusSearch(`${item.playerNames.join(' ')} ${tableHaystack(item.tableNumber)}`, search.value)))

const filteredCommanderItems = computed(() =>
  commanderItems.value.filter(item =>
    matchesRoundStatusFilter(item.done, filter.value) &&
    matchesRoundStatusSearch(`${item.name} ${item.surname} ${tableHaystack(item.tableNumber)}`, search.value)))

const filteredVoteItems = computed(() =>
  voteItems.value.filter(item =>
    matchesRoundStatusFilter(item.done, filter.value) &&
    matchesRoundStatusSearch(`${item.name} ${item.surname} ${tableHaystack(item.tableNumber)}`, search.value)))

// ─── Row select handlers ──────────────────────────────────────────────────────

function selectRanking(item: { pairingId: number; tableIndex: number }) {
  emit('openScoreModal', item.pairingId, item.tableIndex)
}

function selectKill(item: { pairingId: number }) {
  emit('openKillModal', item.pairingId)
}

function selectCommander(item: { pairingId: number; playerId: number }) {
  emit('openCommanderModal', item.pairingId, item.playerId)
}

function selectVote(item: { pairingId: number; playerId: number }) {
  emit('openVotesModal', item.pairingId, item.playerId)
}
</script>

<template>
  <div v-if="pairings.length > 0" class="bg-elevated rounded-xl p-2.5 border border-default shadow-lg space-y-2.5">
    <div class="flex items-center gap-1.5">
      <UIcon :name="ICONS.roundStatus" class="size-4 text-primary" />
      <h4 class="text-sm font-bold">{{ t('tournament.roundStatus.title') }}</h4>
    </div>

    <UFieldGroup class="w-full">
      <UButton
        :label="t('tournament.roundStatus.filterAll')"
        size="xs"
        class="flex-1 justify-center"
        :color="filter === 'all' ? 'primary' : 'neutral'"
        :variant="filter === 'all' ? 'solid' : 'outline'"
        @click="filter = 'all'"
      />
      <UButton
        :label="t('tournament.roundStatus.filterPending')"
        size="xs"
        class="flex-1 justify-center"
        :color="filter === 'pending' ? 'primary' : 'neutral'"
        :variant="filter === 'pending' ? 'solid' : 'outline'"
        @click="filter = 'pending'"
      />
      <UButton
        :label="t('tournament.roundStatus.filterDone')"
        size="xs"
        class="flex-1 justify-center"
        :color="filter === 'done' ? 'primary' : 'neutral'"
        :variant="filter === 'done' ? 'solid' : 'outline'"
        @click="filter = 'done'"
      />
    </UFieldGroup>

    <UInput
      v-model="search"
      type="search"
      :icon="ICONS.search"
      :placeholder="t('tournament.roundStatus.searchPlaceholder')"
      size="sm"
      class="w-full"
    />

    <div class="space-y-1">
      <RoundStatusSection
        :title="t('tournament.roundStatus.sections.rankings')"
        :icon="ICONS.standings"
        :done-count="rankingItems.filter(i => i.done).length"
        :total-count="rankingItems.length"
        :force-open="search !== '' && filteredRankingItems.length > 0"
      >
        <RoundStatusRow
          v-for="item in filteredRankingItems"
          :key="item.pairingId"
          :done="item.done"
          :table-number="item.tableNumber"
          @select="selectRanking(item)"
        />
      </RoundStatusSection>

      <RoundStatusSection
        :title="t('tournament.roundStatus.sections.kills')"
        :icon="ICONS.kills"
        :done-count="killItems.filter(i => i.done).length"
        :total-count="killItems.length"
        :force-open="search !== '' && filteredKillItems.length > 0"
      >
        <RoundStatusRow
          v-for="item in filteredKillItems"
          :key="item.pairingId"
          :done="item.done"
          :table-number="item.tableNumber"
          @select="selectKill(item)"
        />
      </RoundStatusSection>

      <RoundStatusSection
        :title="t('tournament.roundStatus.sections.commanders')"
        :icon="ICONS.commander"
        :done-count="commanderItems.filter(i => i.done).length"
        :total-count="commanderItems.length"
        :force-open="search !== '' && filteredCommanderItems.length > 0"
      >
        <RoundStatusRow
          v-for="item in filteredCommanderItems"
          :key="`${item.pairingId}-${item.playerId}`"
          :done="item.done"
          :player-id="item.playerId"
          :player-name="item.name"
          :player-surname="item.surname"
          :player-avatar-url="item.avatarUrl"
          @select="selectCommander(item)"
        />
      </RoundStatusSection>

      <RoundStatusSection
        :title="t('tournament.roundStatus.sections.votes')"
        :icon="ICONS.vote"
        :done-count="voteItems.filter(i => i.done).length"
        :total-count="voteItems.length"
        :force-open="search !== '' && filteredVoteItems.length > 0"
      >
        <RoundStatusRow
          v-for="item in filteredVoteItems"
          :key="`${item.pairingId}-${item.playerId}`"
          :done="item.done"
          :player-id="item.playerId"
          :player-name="item.name"
          :player-surname="item.surname"
          :player-avatar-url="item.avatarUrl"
          @select="selectVote(item)"
        />
      </RoundStatusSection>
    </div>
  </div>
</template>
