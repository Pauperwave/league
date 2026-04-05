<script setup lang="ts">
import { CalendarDate, getLocalTimeZone } from '@internationalized/date'

function getToday(): CalendarDate {
  const now = new Date()
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

interface Props {
  leagueId: number
}

defineProps<Props>()

const emit = defineEmits<{
  create: [{ eventName: string, eventDate: string, numRound: number }]
}>()

const open = defineModel<boolean>('open', { default: false })

const selectedDate = ref<CalendarDate | null>(getToday())
const eventName = ref('')
const numRound = ref(2)

const loading = ref(false)

const isValid = computed(() => !!eventName.value && !!selectedDate.value)

function handleSubmit() {
  if (!eventName.value || !selectedDate.value) return

  loading.value = true
  const dateStr = selectedDate.value.toDate(getLocalTimeZone())
  const eventDate = dateStr.toISOString().split('T')[0] as string

  emit('create', {
    eventName: eventName.value,
    eventDate,
    numRound: numRound.value
  })

  eventName.value = ''
  numRound.value = 2
  selectedDate.value = getToday()
  loading.value = false
  open.value = false
}

function handleCancel() {
  eventName.value = ''
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Crea Nuovo Evento"
    description="Compila i campi per creare un nuovo evento"
    :ui="{ footer: 'justify-between' }"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon
          name="i-lucide-calendar-plus"
          class="text-primary"
        />
        <span>Crea Nuovo Evento</span>
      </div>
    </template>

    <template #body>
      <form
        class="space-y-4"
        @submit.prevent="handleSubmit"
      >
        <LazyDatePicker
          v-model="selectedDate"
          label="Data Evento"
          required
        />

        <div class="w-full">
          <label class="block text-sm font-medium mb-1">
            Nome Evento <span class="text-error">*</span>
          </label>
          <LazyUInput
            v-model="eventName"
            placeholder="Es. Commander Night #1"
            required
            class="w-full"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">
            Numero di Round <span class="text-error">*</span>
          </label>
          <LazyUInputNumber
            v-model="numRound"
            :min="1"
            :max="10"
            :default-value="2"
            class="w-24"
          />
        </div>
      </form>
    </template>

    <template #footer>
      <UButton
        color="primary"
        :loading="loading"
        :disabled="!isValid"
        @click="handleSubmit"
      >
        Crea Evento
      </UButton>
      <LazyCancelButton @click="handleCancel" />
    </template>
  </UModal>
</template>
