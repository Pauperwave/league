<script setup lang="ts">
import type { Player } from '~/types/database'

const route = useRoute()
const router = useRouter()
const leagueId = parseInt(route.params.leagueId as string)
const eventId = parseInt(route.params.eventId as string)

const eventStore = useEventStore()
const playerStore = usePlayerStore()

// Fetch data via composables (SSR-friendly)
const { data: players } = usePlayers()
const { data: events } = useEvents(leagueId)

// SSR-friendly fetch of waiting players
await useAsyncData(`waiting-${eventId}`, async () => {
  await playerStore.fetchWaitingPlayers(eventId)
  return playerStore.waitingPlayers
})

const currentEvent = computed(() => events.value?.find(e => e.event_id === eventId))
const waitingPlayers = computed(() => playerStore.waitingPlayers)
const pairings = computed(() => eventStore.pairings)
const standings = computed(() => eventStore.standings)
const loading = computed(() => eventStore.loading)

const currentRound = computed(() => currentEvent.value?.event_current_round || 0)
const totalRounds = computed(() => currentEvent.value?.event_round_number || 0)
const isEventEnded = computed(() => currentRound.value > totalRounds.value)
const isPlaying = computed(() => currentEvent.value?.event_playing || false)
const isRegistrationOpen = computed(() => currentEvent.value?.event_registration_open || false)

// Player search for waiting list
const playerSearchQuery = ref('')
const showPlayerSearch = ref(false)

const filteredPlayers = computed(() => {
  if (!playerSearchQuery.value) return players.value.slice(0, 10)
  const query = playerSearchQuery.value.toLowerCase()
  return players.value
    .filter(
      (p: Player) =>
        p.player_name.toLowerCase().includes(query)
        || p.player_surname.toLowerCase().includes(query)
        || `${p.player_name} ${p.player_surname}`.toLowerCase().includes(query)
    )
    .slice(0, 10)
})

const isInWaitingList = computed(() => (playerId: number) => {
  return waitingPlayers.value.includes(playerId)
})

const canStartEvent = computed(() => {
  const count = waitingPlayers.value.length
  return count >= 3 && count !== 5
})

async function addToWaitingList(playerId: number) {
  await playerStore.addToWaitingList(eventId, playerId)
  playerSearchQuery.value = ''
}

async function removeFromWaitingList(playerId: number) {
  await playerStore.removeFromWaitingList(eventId, playerId)
}

async function startEvent() {
  if (!canStartEvent.value) return
  await eventStore.startEvent(eventId)
  await eventStore.fetchPairings(eventId, 1)
}

function navigateToScore(pairingId: number, playerId: number, tableId: number) {
  router.push(
    `/league/${leagueId}/event/${eventId}/round/${currentRound.value}/score?pairingId=${pairingId}&playerId=${playerId}&tableId=${tableId}`
  )
}

async function nextRound() {
  if (!confirm('Procedere al prossimo round?')) return
  const nextRoundNum = currentRound.value + 1
  await eventStore.fetchPairings(eventId, nextRoundNum)
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('it-IT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getPlayerName(playerId: number): string {
  const player = players.value.find((p: Player) => p.player_id === playerId)
  return player ? `${player.player_name} ${player.player_surname}` : `Player ${playerId}`
}

function hasSubmittedScore(pairingId: number, playerId: number): boolean {
  const pairing = pairings.value.find(p => p.pairing_id === pairingId)
  if (!pairing?.round_results) return false
  return pairing.round_results.some(s => s.player_id === playerId)
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <!-- Header -->
    <div class="flex items-center justify-between p-6 bg-elevated border-b border-default">
      <div class="flex items-center gap-4">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
          @click="router.push(`/league/${leagueId}`)"
        />
        <div>
          <h1 class="text-2xl font-bold">
            {{ currentEvent?.event_name || "Evento" }}
          </h1>
          <p class="text-sm text-muted">
            {{ currentEvent?.event_datetime ? formatDate(currentEvent.event_datetime) : "" }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <UBadge
          :color="isEventEnded ? 'neutral' : isPlaying ? 'success' : 'warning'"
          size="lg"
        >
          Round {{ currentRound }} / {{ totalRounds }}
        </UBadge>
      </div>
    </div>

    <!-- Event Controls -->
    <div class="px-6 pb-4">
      <div
        v-if="!isPlaying && isRegistrationOpen"
        class="space-y-4"
      >
        <!-- Start Event Button -->
        <UButton
          color="primary"
          size="lg"
          block
          :disabled="!canStartEvent"
          :title="!canStartEvent ? 'Servono almeno 3 giocatori (non 5)' : ''"
          @click="startEvent"
        >
          <UIcon
            name="i-lucide-play"
            class="mr-2"
          />
          Avvia Evento ({{ waitingPlayers.length }} giocatori)
        </UButton>

        <!-- Waiting List -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">
                Lista d'Attesa
              </h3>
              <UButton
                color="primary"
                variant="soft"
                size="sm"
                icon="i-lucide-user-plus"
                @click="showPlayerSearch = true"
              >
                Aggiungi Giocatore
              </UButton>
            </div>
          </template>

          <!-- Waiting Players -->
          <div
            v-if="waitingPlayers.length > 0"
            class="space-y-2"
          >
            <div
              v-for="playerId in waitingPlayers"
              :key="playerId"
              class="flex items-center justify-between p-2 bg-elevated/50 rounded"
            >
              <span>{{ getPlayerName(playerId) }}</span>
              <UButton
                color="error"
                variant="ghost"
                size="xs"
                icon="i-lucide-x"
                @click="removeFromWaitingList(playerId)"
              />
            </div>
          </div>
          <p
            v-else
            class="text-muted text-center py-4"
          >
            Nessun giocatore in lista d'attesa
          </p>
        </UCard>
      </div>

      <!-- Round Controls -->
      <div
        v-else-if="isPlaying && !isEventEnded"
        class="flex gap-2"
      >
        <UButton
          color="primary"
          variant="soft"
          icon="i-lucide-arrow-right"
          @click="nextRound"
        >
          Prossimo Round
        </UButton>
      </div>
    </div>

    <!-- Tables / Pairings -->
    <div
      v-if="isPlaying || isEventEnded"
      class="px-6 pb-6"
    >
      <h2 class="text-xl font-semibold mb-4">
        Tavoli
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <UCard
          v-for="(pairing, index) in pairings"
          :key="pairing.pairing_id"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-semibold">
                Tavolo {{ index + 1 }}
              </h3>
              <UBadge size="sm">
                Round {{ currentRound }}
              </UBadge>
            </div>
          </template>

          <div class="space-y-2">
            <div
              v-for="playerId in [
                pairing.pairing_player1_id,
                pairing.pairing_player2_id,
                pairing.pairing_player3_id,
                pairing.pairing_player4_id
              ].filter((id): id is number => !!id)"
              :key="playerId"
              class="flex items-center justify-between p-2 bg-elevated/50 rounded"
            >
              <div class="flex items-center gap-2">
                <UIcon
                  :name="
                    hasSubmittedScore(pairing.pairing_id, playerId)
                      ? 'i-lucide-check-circle'
                      : 'i-lucide-circle'
                  "
                  :class="
                    hasSubmittedScore(pairing.pairing_id, playerId) ? 'text-success' : 'text-muted'
                  "
                />
                <span>{{ getPlayerName(playerId) }}</span>
              </div>
              <UButton
                :color="hasSubmittedScore(pairing.pairing_id, playerId) ? 'success' : 'primary'"
                size="xs"
                @click="navigateToScore(pairing.pairing_id, playerId, index)"
              >
                {{ hasSubmittedScore(pairing.pairing_id, playerId) ? "Modifica" : "Inserisci" }}
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <!-- No Pairings -->
      <div
        v-if="pairings.length === 0 && !loading"
        class="text-center py-12 text-muted"
      >
        <UIcon
          name="i-lucide-users"
          class="text-6xl mb-4"
        />
        <p>Nessun tavolo disponibile</p>
      </div>
    </div>

    <!-- Standings -->
    <div class="px-6 pb-6">
      <h2 class="text-xl font-semibold mb-4">
        Classifica
      </h2>

      <div
        v-if="standings.length > 0"
        class="bg-elevated rounded-lg p-4 border border-default"
      >
        <div
          v-for="(standing, index) in standings"
          :key="standing.player_id"
          class="flex items-center justify-between p-3 border-b border-default last:border-0"
        >
          <div class="flex items-center gap-3">
            <span class="text-lg font-bold w-8">{{ index + 1 }}</span>
            <div>
              <p class="font-medium">
                {{ standing.players?.player_name }} {{ standing.players?.player_surname }}
              </p>
              <p class="text-xs text-muted">
                V: {{ standing.victories }} | Brew: {{ standing.brew_received }} | Play:
                {{ standing.play_received }}
              </p>
            </div>
          </div>
          <span class="text-xl font-bold text-primary">{{ standing.standing_player_score }} PT</span>
        </div>
      </div>

      <div
        v-else
        class="text-center py-8 text-muted"
      >
        <UIcon
          name="i-lucide-trophy"
          class="text-4xl mb-2"
        />
        <p>Nessun punteggio disponibile</p>
      </div>
    </div>

    <!-- Player Search Modal -->
    <UModal
      v-model:open="showPlayerSearch"
      title="Aggiungi Giocatore"
    >
      <template #body>
        <div class="space-y-4">
          <UInput
            v-model="playerSearchQuery"
            placeholder="Cerca per nome..."
            icon="i-lucide-search"
          />

          <div class="max-h-64 overflow-y-auto space-y-1">
            <div
              v-for="player in filteredPlayers"
              :key="player.player_id"
              class="flex items-center justify-between p-2 hover:bg-elevated/50 rounded cursor-pointer"
              :class="{ 'opacity-50': isInWaitingList(player.player_id) }"
              @click="!isInWaitingList(player.player_id) && addToWaitingList(player.player_id)"
            >
              <span>{{ player.player_name }} {{ player.player_surname }}</span>
              <UIcon
                v-if="isInWaitingList(player.player_id)"
                name="i-lucide-check"
                class="text-success"
              />
              <UIcon
                v-else
                name="i-lucide-plus"
                class="text-primary"
              />
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          block
          @click="showPlayerSearch = false"
        >
          Chiudi
        </UButton>
      </template>
    </UModal>
  </div>
</template>
