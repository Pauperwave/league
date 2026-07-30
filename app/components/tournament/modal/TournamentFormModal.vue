<!-- app\components\tournament\modal\TournamentFormModal.vue -->
<script setup lang="ts">
// fallow-ignore-file code-duplication -- FormModal invocation boilerplate, see app/components/ui/CLAUDE.md
import type { CalendarDate } from '@internationalized/date'
import type { Tournament } from '#shared/utils/types'
import * as v from 'valibot'

const { t } = useI18n()

// — Constants —
const DEFAULT_ROUND_DURATION = 75 // 1:15 hours

// — Valibot Schema —
const EventFormSchema = v.object({
  tournamentName: v.pipe(v.string(), v.trim(), v.minLength(1)),
  tournamentDate: v.nullable(v.string()),
  numRound: v.pipe(v.number(), v.minValue(1), v.maxValue(10)),
  roundDuration: v.pipe(v.number(), v.minValue(10), v.maxValue(120)),
})

// — Types —

// Internal reactive form state
interface EventForm {
  tournamentName: string
  tournamentDate: CalendarDate | null  // CalendarDate for DatePicker binding
  numRound: number
  roundDuration: number
}

// Emitted payload — tournamentDate serialized to ISO string for callers.
// Exported: this is the single source of truth for the shape, consumed by
// useTournamentLifecycle.ts, useTournamentPage.ts, and pages/league/[id].vue instead
// of each redeclaring their own structurally-compatible-by-accident copy.
export interface TournamentCreatePayload {
  tournamentName: string
  tournamentDate: string
  numRound: number
  roundDuration: number
}

export interface TournamentUpdatePayload {
  id: number
  data: Omit<TournamentCreatePayload, 'tournamentDate'> & { tournamentDate: string | null }
}

const props = defineProps<{
  tournament: Tournament | null
  leagueId: number
}>()

const emit = defineEmits<{
  create: [payload: TournamentCreatePayload]
  update: [payload: TournamentUpdatePayload]
}>()

const open = defineModel<boolean>('open', { default: false })

const submitLogging = useButtonLogging('Submit Tournament Form', { isEditing: () => isEditing.value, tournamentName: () => form.tournamentName })

// — Derived modal state —
const isEditing = computed(() => !!props.tournament)
const { title: modalTitle, description: modalDescription, icon: modalIcon, submitLabel, handleCancel } = useFormModalMeta({
  isEditing,
  namespace: 'event',
  createIcon: ICONS.battle,
  cancelLoggingLabel: 'Cancel Tournament Form',
  open
})

// — Form —
const defaultForm = (): EventForm => ({
  tournamentName: '',
  tournamentDate: getToday(),
  numRound: 2,
  roundDuration: DEFAULT_ROUND_DURATION,
})

const form = shallowReactive<EventForm>(defaultForm())

const isValid = computed(() => !!form.tournamentName.trim())

watch(open, (isOpen) => {
  if (!isOpen) return

  const e = props.tournament
  Object.assign(form, e
    ? {
        tournamentName: e.tournament_name,
        tournamentDate: parseDateString(e.tournament_datetime),
        numRound: e.tournament_round_number ?? 2,
        roundDuration: e.tournament_round_duration ?? DEFAULT_ROUND_DURATION,
      }
    : defaultForm()
  )
})

function toIsoDate(date: CalendarDate | null): string | null {
  return date?.toString() ?? null
}

function handleSubmit() {
  const tournamentDate = toIsoDate(form.tournamentDate)
  const tournamentName = form.tournamentName.trim()

  const data = {
    tournamentName,
    tournamentDate,
    numRound: form.numRound,
    roundDuration: form.roundDuration,
  }

  const parsed = v.safeParse(EventFormSchema, data)
  if (!parsed.success) {
    logError('TournamentFormModal', 'Tournament form validation failed', parsed.issues)
    return
  }

  if (!isEditing.value && !parsed.output.tournamentDate) {
    logError('TournamentFormModal', 'Tournament date required for creation')
    return
  }

  submitLogging.logClick()

  if (isEditing.value && props.tournament) {
    emit('update', {
      id: props.tournament.tournament_id,
      data: parsed.output,
    })
  } else {
    emit('create', {
      ...parsed.output,
      tournamentDate: parsed.output.tournamentDate ?? '',
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
              v-model="form.tournamentName"
              :placeholder="t('event.form.namePlaceholder')"
              class="w-full"
            />
          </UFormField>
          <DatePicker v-model="form.tournamentDate" :label="t('event.form.dateLabel')" />
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
