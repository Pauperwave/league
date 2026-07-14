<!-- app\components\event\pairing\kill\KillSystemModal.vue -->
<script setup lang="ts">
import type { TournamentPlayer, Kill } from '#shared/utils/types'

const props = defineProps<{
  players: TournamentPlayer[]
  pairingId: number | null
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  submit: [kills: Kill[]]
}>()

const { t } = useI18n()

const killsStore = useKillsStore()

// Filter kills to only valid players for this pairing when modal opens
watch(open, (val) => {
  if (val && props.players.length > 0) {
    const validPlayerIds = new Set(props.players.map((p) => p.id))
    killsStore.kills = killsStore.kills.filter(
      (kill) => validPlayerIds.has(kill.killerId) && validPlayerIds.has(kill.victimId)
    )
  }
})

function getPlayerName(id: number): string {
  const p = props.players.find((pl) => pl.id === id)
  return p ? `${p.name} ${p.surname}` : t('event.killModal.playerFallback', { id })
}

function handleSubmit() {
  logDebug('KillSystemModal', 'Confirm Kill System - Table ID:', props.pairingId)
  logDebug('KillSystemModal', 'Kills to confirm:', [...killsStore.kills])
  emit('submit', [...killsStore.kills])
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('event.killModal.title')"
    :description="t('event.killModal.description')"
    :ui="{ content: 'max-w-4xl' }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <!-- Vue Flow canvas — client-only to avoid SSR errors -->
        <ClientOnly>
          <KillFlowCanvas :players="players" />
          <template #fallback>
            <div class="h-96 flex items-center justify-center text-muted">
              <UIcon :name="ICONS.loading" class="animate-spin size-6" />
            </div>
          </template>
        </ClientOnly>

        <!-- Text list of registered kills -->
        <div v-if="killsStore.kills.length > 0" class="space-y-2">
          <p class="text-sm font-medium text-muted">{{ t('event.killModal.registeredKillsLabel') }}</p>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="kill in killsStore.kills"
              :key="`${kill.killerId}-${kill.victimId}`"
              color="error"
              variant="soft"
              class="gap-1.5"
            >
              {{ getPlayerName(kill.killerId) }}
              <UIcon :name="ICONS.forward" class="size-3" />
              {{ getPlayerName(kill.victimId) }}
            </UBadge>
          </div>
        </div>

        <p v-else class="text-sm text-muted text-center py-2">
          {{ t('event.killModal.noKills') }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-between w-full">
        <UButton
          :label="t('event.killModal.resetButton')"
          :icon="ICONS.delete"
          color="neutral"
          variant="ghost"
          :disabled="killsStore.kills.length === 0"
          @click="killsStore.reset()"
        />
        <div class="flex gap-2">
          <CancelButton
            variant="outline"
            @click="() => { open = false }"
          />
          <ConfirmButton
            :trailing-icon="ICONS.confirm"
            @click="handleSubmit"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
