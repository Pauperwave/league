<!-- app\components\Modals\LeagueFormModal.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import type { CalendarDate } from '@internationalized/date'
import type { Ruleset, League } from '#shared/utils/types'
import * as v from 'valibot'
import { useButtonLogging } from '~/composables/ui/useButtonLogging'

const { t } = useI18n()

const LeagueFormSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1, 'League name required')),
  startsAt: v.nullable(v.string()),
  endsAt: v.nullable(v.string()),
  rulesetId: v.nullable(v.number()),
})

const props = defineProps<{
  league: League | null
  rulesets: Ruleset[]
  rulesetsLoading?: boolean
}>()

const emit = defineEmits<{
  create: [{
    name: string
    startsAt: string | null
    endsAt: string | null
    rulesetId: number | null
  }]
  update: [{
    id: number
    data: {
      name: string
      startsAt: string | null
      endsAt: string | null
      rulesetId: number | null
    }
  }]
}>()

const open = defineModel<boolean>('open', { default: false })

const submitLogging = useButtonLogging('Submit League Form', { isEditing: () => isEditing.value, data: () => ({ name: form.name, startsAt: form.startsAt?.toString(), endsAt: form.endsAt?.toString(), rulesetId: form.rulesetId }) })
const cancelLogging = useButtonLogging('Cancel League Form')

const isEditing = computed(() => !!props.league)
const title = computed(() => isEditing.value ? t('league.form.editTitle') : t('league.form.createTitle'))
const description = computed(() => isEditing.value ? t('league.form.editDescription') : t('league.form.createDescription'))
const icon = computed(() => isEditing.value ? ICONS.edit : ICONS.standings)
const submitLabel = computed(() => isEditing.value ? t('common.save') : t('league.form.submitCreate'))

const defaultForm = () => ({
  name: '',
  startsAt: getToday(),
  endsAt: null as CalendarDate | null,
  rulesetId: undefined as number | undefined,
})

const form = shallowReactive(defaultForm())

const isValid = computed(() => !!form.name.trim())

const rulesetItems = computed(() =>
  props.rulesets.map((r) => ({
    label: r.name ?? t('league.form.rulesetFallback', { id: r.ruleset_id }),
    value: r.ruleset_id
  }))
)

watch(
  () => props.rulesets,
  (newRulesets) => {
    const firstRuleset = newRulesets[0]
    if (firstRuleset && !form.rulesetId && !isEditing.value) {
      form.rulesetId = firstRuleset.ruleset_id
    }
  },
  { immediate: true }
)

watch(open, (isOpen) => {
  if (!isOpen) return
  const l = props.league
  if (l) {
    Object.assign(form, {
      name: l.name,
      startsAt: parseDateString(l.starts_at),
      endsAt: parseDateString(l.ends_at),
      rulesetId: l.ruleset_id ?? undefined,
    })
  } else {
    Object.assign(form, defaultForm())
    const firstRuleset = props.rulesets[0]
    if (firstRuleset && !form.rulesetId) {
      form.rulesetId = firstRuleset.ruleset_id
    }
  }
})

function handleSubmit() {
  const data = {
    name: form.name.trim(),
    startsAt: form.startsAt?.toString() ?? null,
    endsAt: form.endsAt?.toString() ?? null,
    rulesetId: form.rulesetId ?? null,
  }

  const parsed = v.safeParse(LeagueFormSchema, data)
  if (!parsed.success) {
    logError('LeagueFormModal', 'League form validation failed', parsed.issues)
    return
  }

  submitLogging.logClick()

  if (isEditing.value && props.league) {
    emit('update', { id: props.league.id, data: parsed.output })
  } else {
    emit('create', parsed.output)
    Object.assign(form, defaultForm())
    const firstRuleset = props.rulesets[0]
    if (firstRuleset) {
      form.rulesetId = firstRuleset.ruleset_id
    }
  }

  open.value = false
}

function handleCancel() {
  cancelLogging.logClick()
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
      <form id="league-form" class="space-y-4" @submit.prevent="handleSubmit">
        <UFormField :label="t('league.form.nameLabel')" required>
          <UInput
            id="field-name"
            v-model="form.name"
            :placeholder="t('league.form.namePlaceholder')"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <DatePicker
            v-model="form.startsAt"
            :label="t('league.form.startsLabel')"
          />
          <DatePicker
            v-model="form.endsAt"
            :label="t('league.form.endsLabel')"
          />
        </div>

        <UFormField :label="t('league.form.rulesetLabel')">
          <USelect
            v-model="form.rulesetId"
            :items="rulesetItems"
            :loading="rulesetsLoading"
            class="w-full"
            :ui="{ base: 'whitespace-normal', item: 'whitespace-normal' }"
          />
        </UFormField>
      </form>
    </template>

    <template #footer>
      <CancelButton @click="handleCancel" />
      <UButton
        type="submit"
        form="league-form"
        color="primary"
        :disabled="!isValid"
      >
        {{ submitLabel }}
      </UButton>
    </template>
  </UModal>
</template>
