<!-- app\components\ruleset\RulesetFormModal.vue -->
<script setup lang="ts">
// fallow-ignore-file code-duplication -- FormModal invocation boilerplate + props/emit shape coincidence, see app/components/ui/CLAUDE.md
import type { Ruleset } from '#shared/utils/types'
import * as v from 'valibot'

const props = defineProps<{
  ruleset: Ruleset | null
}>()

const { t } = useI18n()

const emit = defineEmits<{
  create: [Omit<Ruleset, 'ruleset_id'>]
  update: [{ id: number; data: Partial<Ruleset> }]
}>()

const open = defineModel<boolean>('open', { default: false })

const submitLogging = useButtonLogging('Submit Ruleset Form', { isEditing: () => isEditing.value, name: () => form.name })

const RulesetCreateSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1)),
  rule_set_partecipation: v.number(),
  rule_set_kill: v.number(),
  rule_set_brew: v.number(),
  rule_set_play: v.number(),
  rule_set_rank1: v.number(),
  rule_set_rank2: v.number(),
  rule_set_rank3: v.number(),
  rule_set_rank4: v.number(),
  rule_set_valid_events: v.number(),
})

const RulesetUpdateSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1)),
  rule_set_partecipation: v.nullable(v.number()),
  rule_set_kill: v.nullable(v.number()),
  rule_set_brew: v.nullable(v.number()),
  rule_set_play: v.nullable(v.number()),
  rule_set_rank1: v.nullable(v.number()),
  rule_set_rank2: v.nullable(v.number()),
  rule_set_rank3: v.nullable(v.number()),
  rule_set_rank4: v.nullable(v.number()),
  rule_set_valid_events: v.nullable(v.number()),
})

const isEditing = computed(() => !!props.ruleset)
const { title, description, icon, submitLabel, handleCancel } = useFormModalMeta({
  isEditing,
  namespace: 'ruleset',
  createIcon: ICONS.rules,
  cancelLoggingLabel: 'Cancel Ruleset Form',
  open
})

const defaultForm = () => ({
  name: '',
  partecipation: undefined as number | undefined,
  kill: undefined as number | undefined,
  brew: undefined as number | undefined,
  play: undefined as number | undefined,
  rank1: undefined as number | undefined,
  rank2: undefined as number | undefined,
  rank3: undefined as number | undefined,
  rank4: undefined as number | undefined,
  validEvents: undefined as number | undefined,
})

const form = reactive(defaultForm())

const isValid = computed(() => {
  if (!form.name.trim()) return false
  if (!isEditing.value) {
    return [form.partecipation, form.kill, form.brew, form.play, form.rank1, form.rank2, form.rank3, form.rank4, form.validEvents]
      .every(v => v !== undefined && v !== null)
  }
  return true
})

watch(open, (isOpen) => {
  if (!isOpen) return
  const r = props.ruleset
  if (r) {
    Object.assign(form, {
      name: r.name,
      partecipation: r.rule_set_partecipation ?? undefined,
      kill: r.rule_set_kill ?? undefined,
      brew: r.rule_set_brew ?? undefined,
      play: r.rule_set_play ?? undefined,
      rank1: r.rule_set_rank1 ?? undefined,
      rank2: r.rule_set_rank2 ?? undefined,
      rank3: r.rule_set_rank3 ?? undefined,
      rank4: r.rule_set_rank4 ?? undefined,
      validEvents: r.rule_set_valid_events ?? undefined,
    })
  } else {
    Object.assign(form, defaultForm())
  }
})

const gameActionFields = [
  { key: 'partecipation', label: t('ruleset.actions.partecipation'), icon: ICONS.player },
  { key: 'kill', label: t('ruleset.actions.kill'), icon: ICONS.ruleKill },
  { key: 'brew', label: t('ruleset.actions.brew'), icon: ICONS.ruleBrew },
  { key: 'play', label: t('ruleset.actions.play'), icon: ICONS.play },
] as const

const rankFields = [
  { key: 'rank1', label: '1°', icon: ICONS.victories },
  { key: 'rank2', label: '2°', icon: ICONS.victories },
  { key: 'rank3', label: '3°', icon: ICONS.victories },
  { key: 'rank4', label: '4°', icon: ICONS.victories },
] as const

function handleFieldUpdate(key: string, value: number | undefined) {
  (form as unknown as Record<string, number | undefined>)[key] = value
}

function handleSubmit() {
  const scoreData = {
    name: form.name.trim(),
    rule_set_partecipation: form.partecipation ?? null,
    rule_set_kill: form.kill ?? null,
    rule_set_brew: form.brew ?? null,
    rule_set_play: form.play ?? null,
    rule_set_rank1: form.rank1 ?? null,
    rule_set_rank2: form.rank2 ?? null,
    rule_set_rank3: form.rank3 ?? null,
    rule_set_rank4: form.rank4 ?? null,
    rule_set_valid_events: form.validEvents ?? null,
  }

  const schema = isEditing.value ? RulesetUpdateSchema : RulesetCreateSchema
  const parsed = v.safeParse(schema, scoreData)
  if (!parsed.success) {
    logError('RulesetFormModal', 'Ruleset form validation failed', parsed.issues)
    return
  }

  submitLogging.logClick()

  if (isEditing.value && props.ruleset) {
    emit('update', { id: props.ruleset.ruleset_id, data: parsed.output })
  } else {
    emit('create', parsed.output)
    Object.assign(form, defaultForm())
  }

  open.value = false
}
</script>

<template>
  <FormModal
    v-model:open="open"
    :title="title"
    :description="description"
    :icon="icon"
    :submit-label="submitLabel"
    form-id="ruleset-form"
    :disabled="!isValid"
    @cancel="handleCancel"
  >
    <form id="ruleset-form" class="space-y-4" @submit.prevent="handleSubmit">

        <!-- Name -->
        <UFormField :label="t('ruleset.form.nameLabel')" required>
          <UInput
            id="field-name"
            v-model="form.name"
            :placeholder="t('ruleset.form.namePlaceholder')"
            class="w-full"
          />
        </UFormField>

        <RulesetFieldGrid
          :heading-icon="ICONS.battle"
          :heading-text="t('ruleset.form.gameActionsHeading')"
          :items="gameActionFields"
          :form="form"
          @update-field="handleFieldUpdate"
        />

        <RulesetFieldGrid
          :heading-icon="ICONS.standings"
          :heading-text="t('ruleset.form.positionsHeading')"
          :items="rankFields"
          :form="form"
          @update-field="handleFieldUpdate"
        />

        <!-- Valid events required -->
        <div class="flex flex-col items-center gap-1">
          <label class="flex text-xs font-medium text-muted items-center gap-1.5">
            <UIcon :name="ICONS.calendarConfirmed" class="size-3" /> {{ t('ruleset.form.validEventsLabel') }}
          </label>
          <UInputNumber
            id="field-valid-events"
            v-model="form.validEvents"
            :min="0"
            placeholder="0"
          />
        </div>

      </form>
  </FormModal>
</template>
