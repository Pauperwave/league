<!-- app\components\Events\EventHeaderCard.vue -->
<script setup lang="ts">
import type { EventStatus } from '#shared/utils/types'
import { useButtonLogging } from '~/composables/useButtonLogging'

interface Props {
  eventName: string
  eventDate: string
  eventStatus: EventStatus
}

const props = defineProps<Props>()

const emit = defineEmits<{
  edit: []
}>()

const editLogging = useButtonLogging('Edit Event', { eventName: () => props.eventName })

function handleEdit() {
  editLogging.logClick()
  emit('edit')
}

const statusBadge = computed(() => {
  if (props.eventStatus === 'ended') return { color: 'neutral', label: 'Terminato' } as const
  if (props.eventStatus === 'playing') return { color: 'success', label: 'In Corso' } as const
  return { color: 'warning', label: 'Programmato' } as const
})
</script>

<template>
  <UCard variant="outline">
    <template #header>
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-calendar" class="size-5 text-primary mt-1" />
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-xl font-semibold">{{ eventName }}</h1>
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-pencil"
                size="xs"
                aria-label="Modifica evento"
                @click="handleEdit"
              />
            </div>
            <p class="text-sm text-muted">{{ eventDate }}</p>
          </div>
        </div>

        <div class="flex flex-row items-end gap-1">
          <UBadge :color="statusBadge.color">{{ statusBadge.label }}</UBadge>
          <UBadge :color="eventStatus === 'registration' ? 'success' : 'error'">
            {{ eventStatus === 'registration' ? 'Iscrizioni Aperte' : 'Iscrizioni Chiuse' }}
          </UBadge>
        </div>
      </div>
    </template>

    <slot />
  </UCard>
</template>
