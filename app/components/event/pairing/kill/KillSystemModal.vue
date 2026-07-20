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

// Persisted kills for this pairing (round_kills, ADR-015 Colada query) — the
// local session store has no other way to show already-saved kills once a
// different pairing's modal was opened in between (that flow used to just
// filter the store down to this pairing's valid players, discarding
// whatever was actually saved for it) or after a reload past the
// localStorage crash-insurance TTL. Refetched and re-hydrated on every open
// so what's shown always matches the DB, not stale in-memory state.
const pairingIdRef = computed(() => props.pairingId)
const { data: persistedKills, refetch: refetchKills } = useRoundKillsQuery(pairingIdRef)

/** Kill state as of the last hydrate — diffed against on close so an
 * open/close cycle with no edits doesn't resave (and re-trigger the stats
 * triggers) for nothing. */
let savedKillsSnapshot: Kill[] = []

/** Blocks canvas interaction while the DB fetch is in flight — otherwise a
 * kill drawn during that window gets silently overwritten the instant the
 * fetch resolves and hydrate() replaces the whole array. */
const hydrating = ref(false)

function killKey(k: Kill): string {
  return `${k.killerId}-${k.victimId}`
}

function sameKills(a: Kill[], b: Kill[]): boolean {
  if (a.length !== b.length) return false
  const keysA = new Set(a.map(killKey))
  return b.every((k) => keysA.has(killKey(k)))
}

watch(open, async (isOpen) => {
  if (!isOpen) return
  hydrating.value = true
  await refetchKills()
  const kills = persistedKills.value ?? []
  killsStore.hydrate({ kills, confirmedPairings: Array.from(killsStore.confirmedPairings) })
  savedKillsSnapshot = [...kills]
  hydrating.value = false
})

function getPlayerName(id: number): string {
  const p = props.players.find((pl) => pl.id === id)
  return p ? `${p.name} ${p.surname}` : t('event.killModal.playerFallback', { id })
}

// Kills are drawn live on the canvas — there's no separate draft/confirm
// step, so the whole batch is saved once, whenever the modal closes
// (button, backdrop, ESC, or X — all funnel through this `open` watcher).
// Skipped entirely if nothing changed since open, so a no-edit open/close
// doesn't fire a save for nothing.
watch(open, (isOpen, wasOpen) => {
  if (!wasOpen || isOpen) return
  if (sameKills(killsStore.kills, savedKillsSnapshot)) return
  logDebug('KillSystemModal', 'Saving kills on close - Table ID:', props.pairingId)
  emit('submit', [...killsStore.kills])
})
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
        <!-- Vue Flow canvas — client-only to avoid SSR errors. Also gated on
             `hydrating` so drawing can't start before the persisted-kills
             fetch resolves (see the race explained above `hydrating`'s
             declaration). -->
        <ClientOnly>
          <KillFlowCanvas v-if="!hydrating" :players="players" />
          <div v-else class="h-96 flex items-center justify-center text-muted">
            <UIcon :name="ICONS.loading" class="animate-spin size-6" />
          </div>
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
              <UIcon
                :name="ICONS.close"
                class="size-4 cursor-pointer hover:opacity-70"
                :aria-label="t('event.killModal.removeKillAriaLabel')"
                @click="killsStore.removeKill(kill.killerId, kill.victimId)"
              />
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
          color="error"
          variant="outline"
          :disabled="killsStore.kills.length === 0"
          @click="killsStore.reset()"
        />
        <CancelButton
          :label="t('common.close')"
          :icon="ICONS.close"
          variant="outline"
          @click="() => { open = false }"
        />
      </div>
    </template>
  </UModal>
</template>
