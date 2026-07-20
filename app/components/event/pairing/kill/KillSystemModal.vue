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

/** Kill state as of the last hydrate — restored on cancel. */
let savedKillsSnapshot: Kill[] = []

/** Set only by the Confirm button, right before closing — distinguishes a
 * genuine save from Cancel/backdrop/ESC/X, which should all discard. */
let confirmed = false

/** Blocks canvas interaction while the DB fetch is in flight — otherwise a
 * kill drawn during that window gets silently overwritten the instant the
 * fetch resolves and hydrate() replaces the whole array. */
const hydrating = ref(false)

watch(open, async (isOpen) => {
  if (!isOpen) return
  hydrating.value = true
  await refetchKills()
  const kills = persistedKills.value ?? []
  killsStore.hydrate({ kills })
  savedKillsSnapshot = [...kills]
  confirmed = false
  hydrating.value = false
})

function getPlayerName(id: number): string {
  const p = props.players.find((pl) => pl.id === id)
  return p ? `${p.name} ${p.surname}` : t('event.killModal.playerFallback', { id })
}

// Matches KillFlowCanvas's edge/badge colors, so a kill's badge here is the
// same color as its arrow on the canvas.
const playerColors = computed(() => getPlayerColorMap(props.players))

// Kills are drawn live on the canvas — there's no separate draft/confirm
// step for individual kills, only for the batch as a whole. Confirm always
// saves, even when unchanged from the snapshot: that's what lets a genuine
// "zero kills, reviewed" state register (round_results.number_of_kills goes
// from null to 0, see PairingsCard's hasKills) instead of looking identical
// to a table nobody has opened yet. Cancel/backdrop/ESC/X all discard back
// to the snapshot from when the modal opened — every close funnels through
// this `open` watcher, and `confirmed` (set only by onConfirm, just before
// closing) is what tells the two paths apart.
watch(open, (isOpen, wasOpen) => {
  if (!wasOpen || isOpen) return
  if (confirmed) {
    logDebug('KillSystemModal', 'Saving kills on confirm - Table ID:', props.pairingId)
    emit('submit', [...killsStore.kills])
  } else {
    killsStore.hydrate({ kills: savedKillsSnapshot })
  }
})

function onConfirm() {
  confirmed = true
  open.value = false
}

function onCancel() {
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
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-muted">{{ t('event.killModal.registeredKillsLabel') }}</p>
            <UButton
              :label="t('event.killModal.resetButton')"
              :icon="ICONS.delete"
              color="error"
              variant="outline"
              size="xs"
              @click="killsStore.reset()"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="kill in killsStore.kills"
              :key="`${kill.killerId}-${kill.victimId}`"
              :color="playerColors.get(String(kill.killerId))"
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
      <ModalFooterActions
        :confirm-label="t('common.confirm')"
        @cancel="onCancel"
        @confirm="onConfirm"
      />
    </template>
  </UModal>
</template>
