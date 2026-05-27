<!-- app\components\events\Pairings\PairingsCard.vue -->
<script setup lang="ts">
import type { Pairing, TournamentPlayer, Kill } from '#shared/utils/types'
import { useButtonLogging } from '~/composables/useButtonLogging'

const props = defineProps<{
  pairings: Pairing[]
  currentRound: number | null
  getPlayerName: (playerId: number) => string
  hasSubmittedScore: (pairingId: number, playerId: number) => boolean
  allPlayers: TournamentPlayer[]
  rankings?: ReturnType<typeof useRankingsStore>
  commandersStore?: ReturnType<typeof useCommandersStore>
  killsStore?: ReturnType<typeof useKillsStore>
  votesStore?: ReturnType<typeof useVotesStore>
}>()

const emit = defineEmits<{
  openScoreModal: [pairingId: number, tableIndex: number]
  submitKills: [pairingId: number, kills: Kill[]]
  openCommanderModal: [pairingId: number, playerId: number]
  openScoresModal: [pairingId: number]
  openVotesModal: [pairingId: number, playerId: number]
  openKillModal: [pairingId: number]
  resetTable: [pairingId: number]
}>()

const currentPairingId = ref<number | null>(null)
const currentTableIndex = ref<number | null>(null)
const currentKillsCount = ref<number | null>(null)
const showResetConfirm = ref(false)
const tableToReset = ref<number | null>(null)
const showFillConfirm = ref(false)
const tableToFill = ref<number | null>(null)
const openScoreModalLogging = useButtonLogging('Open Score Modal', { pairingId: () => currentPairingId.value, tableIndex: () => currentTableIndex.value })
const killsSubmitLogging = useButtonLogging('Submit Kills', { killsCount: () => currentKillsCount.value })

function handleOpenScoreModal(pairingId: number, tableIndex: number) {
  currentPairingId.value = pairingId
  currentTableIndex.value = tableIndex
  openScoreModalLogging.logClick()
  emit('openScoreModal', pairingId, tableIndex)
}

function handleKillsSubmit(pairingId: number, kills: Kill[]) {
  currentKillsCount.value = kills.length
  killsSubmitLogging.logClick()
  emit('submitKills', pairingId, kills)
}

function handleOpenScoresModal(pairingId: number) {
  emit('openScoresModal', pairingId)
}

function handleOpenVotesModal(pairingId: number, playerId: number) {
  emit('openVotesModal', pairingId, playerId)
}

function handleOpenKillModal(pairingId: number) {
  emit('openKillModal', pairingId)
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

function handleQuickTestFill(pairing: Pairing) {
  tableToFill.value = pairing.pairing_id
  showFillConfirm.value = true
}

function confirmQuickTestFill() {
  if (tableToFill.value !== null) {
    const pairing = props.pairings.find(p => p.pairing_id === tableToFill.value)
    if (pairing) {
      const playerIds = pairingPlayerIds(pairing)
      if (playerIds.length < 2) return

      props.rankings?.setRankingWithRanks(pairing.pairing_id, playerIds.map((id, i) => ({ playerId: id, rank: i + 1 })))
      if (playerIds.length >= 2) {
        props.killsStore?.addKill(playerIds[0]!, playerIds[1]!)
      }
      for (const id of playerIds) {
        props.commandersStore?.setCommanders(id, 'Test Commander', null)
      }
      for (let i = 0; i < playerIds.length; i++) {
        const nextIdx = (i + 1) % playerIds.length
        props.votesStore?.setVotes(playerIds[i]!, playerIds[nextIdx]!, playerIds[nextIdx]!)
      }
    }
  }
  showFillConfirm.value = false
  tableToFill.value = null
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

const tableKills = (pairing: Pairing): Kill[] => {
  const playerIds = pairingPlayerIds(pairing)
  return props.killsStore?.kills.filter((k: Kill) =>
    playerIds.includes(k.killerId) && playerIds.includes(k.victimId)
  ) ?? []
}

const isTableComplete = (pairing: Pairing): boolean => {
  const playerIds = pairingPlayerIds(pairing)

  // Verifica classifica
  if (!hasRanking(pairing.pairing_id)) return false

  // Verifica uccisioni (almeno una kill per il tavolo)
  if (tableKills(pairing).length === 0) return false

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
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold flex items-center gap-2">
              <UIcon name="i-lucide-table-2" class="size-4 text-muted" />
              Tavolo {{ index + 1 }}
            </h3>
            <UTooltip :key="`punteggi-${pairing.pairing_id}`" :content="{ side: 'top' }" text="Visualizza punteggi">
              <UButton
                size="xs"
                variant="outline"
                label="Punteggi"
                trailing-icon="i-lucide-eye"
                @click="handleOpenScoresModal(pairing.pairing_id)"
              />
            </UTooltip>
            <UTooltip :key="`reset-${pairing.pairing_id}`" :content="{ side: 'top' }" text="Resetta tavolo">
              <UButton
                size="xs"
                variant="outline"
                color="error"
                icon="i-lucide-rotate-ccw"
                aria-label="Resetta tavolo"
                @click="handleResetTable(pairing.pairing_id)"
              />
            </UTooltip>
            <UTooltip :key="`fill-${pairing.pairing_id}`" :content="{ side: 'top' }" text="Compila con dati di test">
              <UButton
                size="xs"
                variant="outline"
                color="warning"
                icon="i-lucide-bolt"
                aria-label="Compila test"
                @click="handleQuickTestFill(pairing)"
              />
            </UTooltip>
          </div>
          <UTooltip :key="`check-${pairing.pairing_id}`" :content="{ side: 'top' }" text="Tavolo completato">
            <UIcon
              v-if="isTableComplete(pairing)"
              name="i-lucide-check"
              class="size-5 text-success"
            />
          </UTooltip>
        </div>

        <div class="space-y-2">
          <div
            v-for="playerId in pairingPlayerIds(pairing)"
            :key="playerId"
            class="flex items-center gap-2 p-2 bg-elevated rounded"
          >
            <UAvatar size="xs" icon="i-lucide-user" />
            <span class="flex-1">{{ getPlayerName(playerId) }}</span>
            <UTooltip
              :key="`cmd-${playerId}-${commandersStore?.getCommander1(playerId) ? 1 : 0}`"
              :content="{ side: 'right' }"
              :text="commandersStore?.getCommander1(playerId) ? 'Commander inserito' : 'Inserisci commander'"
            >
              <UButton
                size="xs"
                variant="outline"
                :color="commandersStore?.getCommander1(playerId) ? 'neutral' : 'warning'"
                :icon="commandersStore?.getCommander1(playerId) ? 'i-lucide-shield-check' : 'i-lucide-shield-plus'"
                aria-label="Imposta comandanti"
                @click="emit('openCommanderModal', pairing.pairing_id, playerId)"
              />
            </UTooltip>
            <UTooltip
              :key="`vote-${playerId}-${votesStore?.hasVotes(playerId) ? 1 : 0}`"
              :content="{ side: 'right' }"
              :text="votesStore?.hasVotes(playerId) ? 'Voto inserito' : 'Inserisci voto'"
            >
              <UButton
                size="xs"
                variant="outline"
                :color="votesStore?.hasVotes(playerId) ? 'neutral' : 'warning'"
                :icon="votesStore?.hasVotes(playerId) ? 'i-lucide-check' : 'i-lucide-star'"
                aria-label="Imposta voti"
                @click="handleOpenVotesModal(pairing.pairing_id, playerId)"
              />
            </UTooltip>
          </div>
        </div>

        <div class="flex gap-2 mt-3">
          <UTooltip :content="{ side: 'top' }" :text="hasRanking(pairing.pairing_id) ? 'Classifica inserita' : 'Inserisci classifica'">
            <UButton
              :color="hasRanking(pairing.pairing_id) ? 'neutral' : 'warning'"
              class="flex-1"
              icon="i-lucide-trophy"
              variant="outline"
              @click="handleOpenScoreModal(pairing.pairing_id, index)"
            >
              Classifica
            </UButton>
          </UTooltip>
          <UTooltip :content="{ side: 'top' }" :text="tableKills(pairing).length > 0 ? 'Uccisioni inserite' : 'Inserisci uccisioni'">
            <UButton
              :color="tableKills(pairing).length > 0 ? 'neutral' : 'warning'"
              class="flex-1"
              icon="i-lucide-skull"
              variant="outline"
              @click="handleOpenKillModal(pairing.pairing_id)"
            >
              Uccisioni
            </UButton>
          </UTooltip>
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
      @confirm="confirmResetTable"
    />

    <ConfirmModal
      v-model:open="showFillConfirm"
      title="Compila con dati di test"
      description="Stai per compilare il tavolo con dati di test"
      question="Sei sicuro di voler compilare il tavolo"
      :subject="`Tavolo ${pairings.findIndex(p => p.pairing_id === tableToFill) + 1}`"
      warning="Questa azione sovrascriverà i dati esistenti."
      confirm-label="Compila"
      cancel-label="Annulla"
      confirm-icon="i-lucide-bolt"
      @confirm="confirmQuickTestFill"
    />
  </UCard>
</template>
