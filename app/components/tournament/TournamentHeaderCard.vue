<!-- app\components\tournament\TournamentHeaderCard.vue -->
<script setup lang="ts">
import type { TournamentStatus } from '#shared/utils/types'

const props = defineProps<{
  tournamentName: string
  tournamentDate: string
  tournamentStatus: TournamentStatus
}>()

const emit = defineEmits<{
  edit: []
}>()

const { t } = useI18n()

const editLogging = useButtonLogging('Edit Tournament', { tournamentName: () => props.tournamentName })

function handleEdit() {
  editLogging.logClick()
  emit('edit')
}

const statusBadge = computed(() => {
  if (props.tournamentStatus === 'ended') return { color: 'neutral', label: t('tournament.status.ended') } as const
  if (props.tournamentStatus === 'playing') return { color: 'success', label: t('tournament.status.playing') } as const
  return { color: 'warning', label: t('tournament.status.registration') } as const
})
</script>

<template>
  <div class="flex items-center gap-3">
    <UIcon :name="ICONS.calendar" class="size-5 text-primary mt-1" />
    <div>
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-bold">{{ tournamentName }}</h1>
        <UButton
          color="neutral"
          variant="ghost"
          :icon="ICONS.edit"
          size="xs"
          :aria-label="t('tournament.editAriaLabel')"
          @click="handleEdit"
        />
        <UBadge :color="statusBadge.color" :icon="tournamentStatus === 'ended' ? ICONS.flag : undefined">
          {{ statusBadge.label }}
        </UBadge>
      </div>
      <p class="text-sm text-muted">{{ tournamentDate }}</p>
    </div>
  </div>
</template>
