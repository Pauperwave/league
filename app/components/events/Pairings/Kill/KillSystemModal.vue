<script setup lang="ts">
import type { TournamentPlayer, Kill } from '#shared/utils/types'

const props = defineProps<{
  players: TournamentPlayer[]
  tableId: number
}>()

const emit = defineEmits<{
  submit: [kills: Kill[]]
}>()

const killsStore = useKillsStore()
const isOpen = ref(false)

// Reset store ad ogni apertura della modale e rimuovi kills non valide
watch(isOpen, (val) => {
  if (val) {
    const validPlayerIds = new Set(props.players.map((p) => p.id))
    // Rimuovi solo le kills che non appartengono al tavolo corrente
    killsStore.kills = killsStore.kills.filter(
      (kill) => validPlayerIds.has(kill.killerId) && validPlayerIds.has(kill.victimId)
    )
  }
})

function getPlayerName(id: number): string {
  const p = props.players.find((pl) => pl.id === id)
  return p ? `${p.name} ${p.surname}` : `#${id}`
}

function handleSubmit() {
  console.log('Conferma Sistema Uccisioni - Table ID:', props.tableId)
  console.log('Uccisioni da confermare:', [...killsStore.kills])
  emit('submit', [...killsStore.kills])
  isOpen.value = false
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="Sistema Uccisioni"
    description="Trascina dall'handle inferiore di un giocatore verso quello superiore della vittima. Clicca una freccia per rimuoverla."
    :ui="{ content: 'max-w-4xl' }"
  >
    <!-- Trigger: bottone che apre la modale -->
    <UButton
      label="Uccisioni"
      icon="i-lucide-skull"
      :color="killsStore.kills.length > 0 ? 'success' : 'warning'"
      variant="outline"
      size="lg"
      class="flex-1"
    />

    <template #body>
      <div class="flex flex-col gap-4">
        <!-- Canvas Vue Flow — solo client side per evitare errori SSR -->
        <ClientOnly>
          <KillFlowCanvas :players="players" />
          <template #fallback>
            <div class="h-96 flex items-center justify-center text-muted">
              <UIcon name="i-lucide-loader-circle" class="animate-spin size-6" />
            </div>
          </template>
        </ClientOnly>

        <!-- Lista testuale delle uccisioni registrate -->
        <div v-if="killsStore.kills.length > 0" class="space-y-2">
          <p class="text-sm font-medium text-muted">Uccisioni registrate:</p>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="kill in killsStore.kills"
              :key="`${kill.killerId}-${kill.victimId}`"
              color="error"
              variant="soft"
              class="gap-1.5"
            >
              {{ getPlayerName(kill.killerId) }}
              <UIcon name="i-lucide-arrow-right" class="size-3" />
              {{ getPlayerName(kill.victimId) }}
            </UBadge>
          </div>
        </div>

        <p v-else class="text-sm text-muted text-center py-2">
          Nessuna uccisione registrata. Trascina tra i giocatori per aggiungerne.
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-between w-full">
        <UButton
          label="Azzera"
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          :disabled="killsStore.kills.length === 0"
          @click="killsStore.reset()"
        />
        <div class="flex gap-2">
          <UButton
            label="Annulla"
            color="neutral"
            variant="outline"
            @click="isOpen = false"
          />
          <UButton
            label="Conferma"
            icon="i-lucide-check"
            color="primary"
            @click="handleSubmit"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
