<!-- app\components\event\WinnerChecklist.vue -->
<script setup lang="ts">
import type { WinnerChecklistEntry } from '~/composables/event/useWinnerChecklist'

const { winners, checked } = defineProps<{
  winners: WinnerChecklistEntry[]
  checked: Record<number, boolean>
}>()

const emit = defineEmits<{
  toggle: [playerId: number]
}>()

const { t } = useI18n()

const isOpen = ref(true)
</script>

<template>
  <div v-if="winners.length > 0" class="bg-elevated rounded-xl p-2.5 border border-default shadow-lg">
    <UCollapsible v-model:open="isOpen">
      <button type="button" class="flex items-center gap-1.5 mb-1.5 w-full cursor-pointer">
        <UIcon :name="ICONS.booster" class="size-4 text-warning" />
        <h4 class="text-sm font-bold">{{ t('event.winnerChecklist.title') }}</h4>
        <UIcon :name="ICONS.chevronDown" class="size-3.5 text-muted transition-transform" :class="isOpen ? '' : '-rotate-90'" />
      </button>

      <template #content>
        <p class="text-xs text-muted mb-1.5">{{ t('event.winnerChecklist.hint') }}</p>

        <div class="space-y-1">
          <template v-for="entry in winners" :key="entry.pairingId">
            <div
              v-for="player in entry.players"
              :key="player.id"
              class="flex items-center justify-between gap-2 p-1.5 rounded-lg cursor-pointer"
              :class="checked[player.id] ? 'bg-success/10' : 'bg-muted/30'"
              @click="emit('toggle', player.id)"
            >
              <div class="flex items-center gap-1.5 min-w-0">
                <div class="flex items-center gap-1 shrink-0">
                  <UIcon :name="ICONS.tableView" class="size-3.5 text-primary" />
                  <span class="text-sm font-semibold">{{ entry.tableNumber }}</span>
                </div>
                <PlayerNameTag
                  :name="player.name"
                  :surname="player.surname"
                  :player-id="player.id"
                  :avatar-url="player.avatarUrl"
                  :linkable="false"
                  avatar-size="xs"
                  :class="checked[player.id] ? 'line-through opacity-60' : ''"
                />
              </div>

              <UCheckbox
                :model-value="checked[player.id] ?? false"
                :aria-label="t('event.winnerChecklist.handedOutAriaLabel', { name: `${player.name} ${player.surname}` })"
                @click.stop
                @update:model-value="emit('toggle', player.id)"
              />
            </div>
          </template>
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
