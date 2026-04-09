<!-- app\components\Modals\EventFormModal.vue -->
<script setup lang="ts">
import { type CalendarDate, getLocalTimeZone } from '@internationalized/date'
import type { Event } from '#shared/utils/types'

// — Constants —
const DEFAULT_ROUND_DURATION = 75 // 1:15 hours

// — Types —

// Internal reactive form state
interface EventForm {
  eventName: string
  eventDate: CalendarDate | null  // CalendarDate for DatePicker binding
  numRound: number
  roundDuration: number
}

// Emitted payload — eventDate serialized to ISO string for callers
interface EventCreatePayload {
  eventName: string
  eventDate: string
  numRound: number
  roundDuration: number
}

interface EventUpdatePayload {
  id: number
  data: Omit<EventCreatePayload, 'eventDate'> & { eventDate: string | null }
}

interface Props {
  event: Event | null
  leagueId: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  create: [payload: EventCreatePayload]
  update: [payload: EventUpdatePayload]
}>()

const open = defineModel<boolean>('open', { default: false })

// — Derived modal state —
const isEditing = computed(() => !!props.event)
const modalTitle = computed(() => isEditing.value ? 'Modifica Evento' : 'Crea Nuovo Evento')
const modalDescription = computed(() => isEditing.value ? "Modifica i dati dell'evento" : 'Compila i campi per creare un nuovo evento')
const modalIcon = computed(() => isEditing.value ? 'i-lucide-pencil' : 'i-lucide-calendar-plus')
const submitLabel = computed(() => isEditing.value ? 'Salva' : 'Crea Evento')

// — Form —
const defaultForm = (): EventForm => ({
  eventName: '',
  eventDate: getToday(),
  numRound: 2,
  roundDuration: DEFAULT_ROUND_DURATION,
})

const form = shallowReactive<EventForm>(defaultForm())

const isValid = computed(() => !!form.eventName.trim())

watch(open, (isOpen) => {
  if (!isOpen) return

  const e = props.event
  Object.assign(form, e
    ? {
        eventName: e.event_name,
        eventDate: parseDateString(e.event_datetime),
        numRound: e.event_round_number ?? 2,
        roundDuration: e.event_round_duration ?? DEFAULT_ROUND_DURATION,
      }
    : defaultForm()
  )
})

function toIsoDate(date: CalendarDate | null): string | null {
  return date?.toDate(getLocalTimeZone()).toISOString().split('T')[0] ?? null
}

function handleSubmit() {
  if (!isValid.value) return

  const eventDate = toIsoDate(form.eventDate)
  const eventName = form.eventName.trim()

  if (isEditing.value && props.event) {
    emit('update', {
      id: props.event.event_id,
      data: { eventName, eventDate, numRound: form.numRound, roundDuration: form.roundDuration },
    })
  } else {
    emit('create', {
      eventName,
      eventDate: eventDate ?? '',
      numRound: form.numRound,
      roundDuration: form.roundDuration,
    })
    Object.assign(form, defaultForm())
  }

  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :description="modalDescription"
    :ui="{ footer: 'justify-between' }"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon :name="modalIcon" class="text-primary" />
        <span>{{ modalTitle }}</span>
      </div>
    </template>

    <template #body>
      <form id="event-form" class="space-y-4" @submit.prevent="handleSubmit">
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Nome Evento" required>
            <UInput
              id="field-name"
              v-model="form.eventName"
              placeholder="Es. Commander Night #1"
              class="w-full"
            />
          </UFormField>
          <DatePicker v-model="form.eventDate" label="Data" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Numero Round">
            <UInputNumber
              v-model="form.numRound"
              :min="1"
              :max="10"
              :default-value="2"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Durata Round (min)">
            <UInputNumber
              v-model="form.roundDuration"
              :min="10"
              :max="120"
              :step="5"
              :default-value="75"
              class="w-full"
            />
          </UFormField>
        </div>
      </form>
    </template>

    <template #footer>
      <UButton
        type="submit"
        form="event-form"
        color="primary"
        :disabled="!isValid"
      >
        {{ submitLabel }}
      </UButton>
      <CancelButton @click="open = false" />
    </template>
  </UModal>
</template>
