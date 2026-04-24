<!-- app\components\Events\PairingsCard.vue -->
<script setup lang="ts">
import type { Pairing, TournamentPlayer, Kill } from '#shared/utils/types'
import { useButtonLogging } from '~/composables/useButtonLogging'

interface Props {
  pairings: Pairing[]
  currentRound: number | null
  getPlayerName: (playerId: number) => string
  hasSubmittedScore: (pairingId: number, playerId: number) => boolean
  allPlayers: TournamentPlayer[]
  rankings?: ReturnType<typeof useRankingsStore> // rankings store
  commandersStore?: ReturnType<typeof useCommandersStore> // commanders store
  killsStore?: ReturnType<typeof useKillsStore> // kills store
  votesStore?: ReturnType<typeof useVotesStore> // votes store
}

const props = defineProps<Props>()

const emit = defineEmits<{
  openScoreModal: [pairingId: number, tableIndex: number]
  submitKills: [kills: Kill[]]
  openCommanderModal: [playerId: number]
  openScoresModal: [pairingId: number]
  openVotesModal: [playerId: number]
  resetTable: [pairingId: number]
}>()

const currentPairingId = ref<number | null>(null)
const currentTableIndex = ref<number | null>(null)
const currentKillsCount = ref<number | null>(null)
const showResetConfirm = ref(false)
const tableToReset = ref<number | null>(null)
const openScoreModalLogging = useButtonLogging('Open Score Modal', { pairingId: () => currentPairingId.value, tableIndex: () => currentTableIndex.value })
const killsSubmitLogging = useButtonLogging('Submit Kills', { killsCount: () => currentKillsCount.value })

function handleOpenScoreModal(pairingId: number, tableIndex: number) {
  currentPairingId.value = pairingId
  currentTableIndex.value = tableIndex
  openScoreModalLogging.logClick()
  emit('openScoreModal', pairingId, tableIndex)
}

function handleKillsSubmit(kills: Kill[]) {
  currentKillsCount.value = kills.length
  killsSubmitLogging.logClick()
  emit('submitKills', kills)
}

function handleOpenScoresModal(pairingId: number) {
  emit('openScoresModal', pairingId)
}

function handleOpenVotesModal(playerId: number) {
  emit('openVotesModal', playerId)
}

function handleResetTable(pairingId: number) {
  tableToReset.value = pairingId
  showResetConfirm.value = true
}

function confirmResetTable() {
  if (tableToReset.value !== null) {
    emit('resetTable', tableToReset.value)
  }
  showResetConfirm.value = false
  tableToReset.value = null
}

const pairingPlayerIds = (pairing: Pairing): number[] =>
  [pairing.pairing_player1_id, pairing.pairing_player2_id, pairing.pairing_player3_id, pairing.pairing_player4_id]
    .filter((id): id is number => !!id)

const pairingPlayers = (pairing: Pairing): TournamentPlayer[] =>
  pairingPlayerIds(pairing)
    .map((id) => props.allPlayers.find((p) => p.id === id))
    .filter((p): p is TournamentPlayer => !!p)

const hasRanking = (pairingId: number): boolean => {
  const ranking = props.rankings?.getRankingWithRanks(pairingId)
  return !!ranking && ranking.length > 0
}

const isTableComplete = (pairing: Pairing): boolean => {
  const playerIds = pairingPlayerIds(pairing)

  // Verifica classifica
  if (!hasRanking(pairing.pairing_id)) return false

  // Verifica uccisioni (almeno una kill per il tavolo)
  const tableKills = props.killsStore?.kills.filter((k: Kill) =>
    playerIds.includes(k.killerId) && playerIds.includes(k.victimId)
  ) || []
  if (tableKills.length === 0) return false

  // Verifica comandanti per tutti i giocatori
  const allCommandersSet = playerIds.every(id =>
    props.commandersStore?.getCommander1(id) !== null
  )
  if (!allCommandersSet) return false

  // Verifica voti per tutti i giocatori
  const allVotesSet = playerIds.every(id =>
    props.votesStore?.hasVotes(id) === true
  )
  if (!allVotesSet) return false

  return true
}
</script>

<template>
  <UCard variant="outline">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-layout-grid" class="size-5 text-primary" />
        <h2 class="text-lg font-semibold">Tavoli</h2>
      </div>
    </template>

    <div v-if="pairings.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <UCard
        v-for="(pairing, index) in pairings"
        :key="pairing.pairing_id"
        :class="isTableComplete(pairing) ? 'bg-success/10 rounded-lg p-4' : 'bg-muted/30 rounded-lg p-4'"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold flex items-center gap-2">
              <UIcon name="i-lucide-table-2" class="size-4 text-muted" />
              Tavolo {{ index + 1 }}
            </h3>
            <UButton
              size="xs"
              variant="outline"
              label="Punteggi"
              trailing-icon="i-lucide-eye"
              @click="handleOpenScoresModal(pairing.pairing_id)"
            />
            <UButton
              size="xs"
              variant="outline"
              color="error"
              icon="i-lucide-rotate-ccw"
              aria-label="Reset tavolo"
              @click="handleResetTable(pairing.pairing_id)"
            />
          </div>
          <UBadge variant="soft">Round {{ currentRound }}</UBadge>
        </div>

        <div class="space-y-2">
          <div
            v-for="playerId in pairingPlayerIds(pairing)"
            :key="playerId"
            class="flex items-center gap-2 p-2 bg-elevated rounded"
          >
            <UAvatar size="xs" icon="i-lucide-user" />
            <span class="flex-1">{{ getPlayerName(playerId) }}</span>
            <UButton
              size="xs"
              variant="outline"
              :color="commandersStore?.getCommander1(playerId) ? 'success' : 'warning'"
              :icon="commandersStore?.getCommander1(playerId) ? 'i-lucide-shield-check' : 'i-lucide-shield-plus'"
              aria-label="Imposta comandanti"
              @click="emit('openCommanderModal', playerId)"
            />
            <UButton
              size="xs"
              variant="outline"
              :color="votesStore?.hasVotes(playerId) ? 'success' : 'warning'"
              icon="i-lucide-star"
              aria-label="Imposta voti"
              @click="handleOpenVotesModal(playerId)"
            />
          </div>
        </div>

        <div class="flex gap-2 mt-3">
          <UButton
            :color="hasRanking(pairing.pairing_id) ? 'success' : 'warning'"
            class="flex-1"
            icon="i-lucide-trophy"
            variant="outline"
            @click="handleOpenScoreModal(pairing.pairing_id, index)"
          >
            Classifica
          </UButton>
          <KillSystemModal
            :players="pairingPlayers(pairing)"
            :table-id="pairing.pairing_id"
            @submit="handleKillsSubmit"
          />
        </div>
      </UCard>
    </div>

    <UEmpty v-else icon="i-lucide-users" title="Nessun tavolo disponibile" />

    <ConfirmModal
      v-model:open="showResetConfirm"
      title="Conferma Reset"
      description="Stai per resettare tutti i valori del tavolo"
      question="Sei sicuro di voler resettare tutti i valori"
      :subject="`Tavolo ${pairings.findIndex(p => p.pairing_id === tableToReset) + 1}`"
      warning="Questa azione non può essere annullata."
      confirm-label="Reset"
      cancel-label="Annulla"
      confirm-icon="i-lucide-rotate-ccw"
      confirm-color="error"
      @confirm="confirmResetTable"
    />
  </UCard>
</template>
