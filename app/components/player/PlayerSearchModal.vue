<!-- app\components\Modals\PlayerSearchModal.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import type { Player } from '#shared/utils/types'
import { usePlayerOptions } from '~/composables/supabase/usePlayers'
import { useButtonLogging } from '~/composables/ui/useButtonLogging'

const props = defineProps<{
  players: Player[]
  waitingPlayers: number[]
}>()

const { t } = useI18n()

const emit = defineEmits<{
  select: [playerIds: number[]]
  createNew: []
}>()

const open = defineModel<boolean>('open', { default: false })

const selectedPlayerIds = ref<string[]>([])

const confirmLogging = useButtonLogging('Confirm Player Selection', { selectedCount: () => selectedPlayerIds.value.length })
const createNewLogging = useButtonLogging('Create New Player')
const closeLogging = useButtonLogging('Close Player Search Modal')

const hasSelection = computed(() => selectedPlayerIds.value.length > 0)

const allPlayersInQueue = computed(() =>
  props.players.every(p => props.waitingPlayers.includes(p.player_id))
)

const availablePlayers = computed(() =>
  props.players.filter(p => !props.waitingPlayers.includes(p.player_id))
)

const items = usePlayerOptions(availablePlayers)

// Reset selection whenever the modal opens
watch(open, (isOpen) => {
  if (isOpen) selectedPlayerIds.value = []
})

function handleConfirm() {
  confirmLogging.logClick()
  emit('select', selectedPlayerIds.value.map(Number))
  selectedPlayerIds.value = []
  open.value = false
}

function handleCreateNew() {
  createNewLogging.logClick()
  emit('createNew')
  open.value = false
}

function handleClose() {
  closeLogging.logClick()
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open">
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon :name="ICONS.addPlayer" class="text-primary" />
        <span>{{ t('player.searchModal.title') }}</span>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <USelectMenu
          v-model="selectedPlayerIds"
          :items="items"
          value-key="value"
          multiple
          :placeholder="t('player.searchModal.searchPlaceholder')"
          :search-input="{ placeholder: t('player.searchModal.searchInputPlaceholder') }"
          class="w-full"
        />

        <p v-if="players.length === 0" class="text-muted text-center py-4">
          {{ t('player.searchModal.noPlayersRegistered') }}
        </p>
        <p v-else-if="allPlayersInQueue" class="text-muted text-center py-4">
          {{ t('player.searchModal.allInQueue') }}
        </p>
        <p v-else-if="hasSelection" class="text-sm text-muted">
          {{ t('player.searchModal.selectedCount', { count: selectedPlayerIds.length }) }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-between w-full">
        <UButton
          color="neutral"
          :icon="ICONS.close"
          @click="handleClose"
        >
          {{ t('common.close') }}
        </UButton>
        <div class="flex items-center gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :icon="ICONS.addPlayer"
            @click="handleCreateNew"
          >
            {{ t('player.searchModal.createNew') }}
          </UButton>
          <UButton
            color="primary"
            :icon="ICONS.playerConfirmed"
            :disabled="!hasSelection"
            @click="handleConfirm"
          >
            {{ t('player.searchModal.addCount', { count: selectedPlayerIds.length }) }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
