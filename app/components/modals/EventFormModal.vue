<script setup lang="ts">
import { getLocalTimeZone } from '@internationalized/date'
import type { Event } from '#shared/utils/types'
import { getToday, parseDateString } from '~/composables/useTableUtils'

interface Props {
  event: Event | null
  leagueId: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  create: [{
    eventName: string
    eventDate: string
    numRound: number
  }]
  update: [{
    id: number
    data: {
      eventName: string
      eventDate: string | null
      numRound: number
    }
  }]
}>()

const open = defineModel<boolean>('open', { default: false })

const isEditing = computed(() => !!props.event)
const title = computed(() => isEditing.value ? 'Modifica Evento' : 'Crea Nuovo Evento')
const description = computed(() => isEditing.value ? 'Modifica i dati dell\'evento' : 'Compila i campi per creare un nuovo evento')
const icon = computed(() => isEditing.value ? 'i-lucide-pencil' : 'i-lucide-calendar-plus')
const submitLabel = computed(() => isEditing.value ? 'Salva' : 'Crea Evento')

const defaultForm = () => ({
  eventName: '',
  eventDate: getToday(),
  numRound: 2,
})

const form = shallowReactive(defaultForm())

const isValid = computed(() => !!form.eventName.trim())

watch(open, (isOpen) => {
  if (!isOpen) return
  const e = props.event
  if (e) {
    Object.assign(form, {
      eventName: e.event_name,
      eventDate: parseDateString(e.event_datetime),
      numRound: e.event_round_number ?? 2,
    })
  } else {
    Object.assign(form, defaultForm())
  }
})

function handleSubmit() {
  if (!form.eventName.trim()) return

  const dateStr = form.eventDate?.toDate(getLocalTimeZone())
  const eventDate = dateStr ? dateStr.toISOString().split('T')[0] : null

  if (isEditing.value && props.event) {
    emit('update', {
      id: props.event.event_id,
      data: {
        eventName: form.eventName.trim(),
        eventDate: eventDate ?? null,
        numRound: form.numRound,
      }
    })
  } else {
    emit('create', {
      eventName: form.eventName.trim(),
      eventDate: eventDate ?? '',
      numRound: form.numRound,
    })
    Object.assign(form, defaultForm())
  }

  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :description="description"
    :ui="{ footer: 'justify-between' }"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon :name="icon" class="text-primary" />
        <span>{{ title }}</span>
      </div>
    </template>

    <template #body>
      <form id="event-form" class="space-y-4" @submit.prevent="handleSubmit">
        <UFormField label="Nome Evento" required>
          <UInput
            id="field-name"
            v-model="form.eventName"
            placeholder="Es. Commander Night #1"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <DatePicker
            v-model="form.eventDate"
            label="Data Evento"
          />
          <UFormField label="Numero Round">
            <UInputNumber
              v-model="form.numRound"
              :min="1"
              :max="10"
              :default-value="2"
              class="w-full"
            />
          </UFormField>
        </div>
      </form>
    </template>

    <template #footer>
      <UButton type="submit" form="event-form" color="primary" :disabled="!isValid">
        {{ submitLabel }}
      </UButton>
      <CancelButton @click="open = false" />
    </template>
  </UModal>
</template>
