<!-- app\components\event\modal\EventFormModal.vue -->
<script setup lang="ts">
// fallow-ignore-file code-duplication -- FormModal invocation boilerplate, see app/components/ui/CLAUDE.md
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import { type CalendarDate, getLocalTimeZone } from '@internationalized/date'
import type { Event } from '#shared/utils/types'
import * as v from 'valibot'
import { useButtonLogging } from '~/composables/ui/useButtonLogging'

const { t } = useI18n()

// — Constants —
const DEFAULT_ROUND_DURATION = 75 // 1:15 hours

// — Valibot Schema —
const EventFormSchema = v.object({
  eventName: v.pipe(v.string(), v.trim(), v.minLength(1)),
  eventDate: v.nullable(v.string()),
  numRound: v.pipe(v.number(), v.minValue(1), v.maxValue(10)),
  roundDuration: v.pipe(v.number(), v.minValue(10), v.maxValue(120)),
})

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

const props = defineProps<{
  event: Event | null
  leagueId: number
}>()

const emit = defineEmits<{
  create: [payload: EventCreatePayload]
  update: [payload: EventUpdatePayload]
}>()

const open = defineModel<boolean>('open', { default: false })

const submitLogging = useButtonLogging('Submit Event Form', { isEditing: () => isEditing.value, eventName: () => form.eventName })

// — Derived modal state —
const isEditing = computed(() => !!props.event)
const { title: modalTitle, description: modalDescription, icon: modalIcon, submitLabel, handleCancel } = useFormModalMeta({
  isEditing,
  namespace: 'event',
  createIcon: ICONS.calendarAdd,
  cancelLoggingLabel: 'Cancel Event Form',
  open
})

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
  const eventDate = toIsoDate(form.eventDate)
  const eventName = form.eventName.trim()

  const data = {
    eventName,
    eventDate,
    numRound: form.numRound,
    roundDuration: form.roundDuration,
  }

  const parsed = v.safeParse(EventFormSchema, data)
  if (!parsed.success) {
    logError('EventFormModal', 'Event form validation failed', parsed.issues)
    return
  }

  if (!isEditing.value && !parsed.output.eventDate) {
    logError('EventFormModal', 'Event date required for creation')
    return
  }

  submitLogging.logClick()

  if (isEditing.value && props.event) {
    emit('update', {
      id: props.event.event_id,
      data: parsed.output,
    })
  } else {
    emit('create', {
      ...parsed.output,
      eventDate: parsed.output.eventDate ?? '',
    })
    Object.assign(form, defaultForm())
  }

  open.value = false
}


</script>

<template>
  <FormModal
    v-model:open="open"
    :title="modalTitle"
    :description="modalDescription"
    :icon="modalIcon"
    :submit-label="submitLabel"
    form-id="event-form"
    :disabled="!isValid"
    @cancel="handleCancel"
  >
    <form id="event-form" class="space-y-4" @submit.prevent="handleSubmit">
        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="t('event.form.nameLabel')" required>
            <UInput
              id="field-name"
              v-model="form.eventName"
              :placeholder="t('event.form.namePlaceholder')"
              class="w-full"
            />
          </UFormField>
          <DatePicker v-model="form.eventDate" :label="t('event.form.dateLabel')" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="t('event.form.numRoundLabel')">
            <UInputNumber
              v-model="form.numRound"
              :min="1"
              :max="10"
              :default-value="2"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('event.form.roundDurationLabel')">
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
  </FormModal>
</template>
