<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import type { Ruleset, League } from '#shared/utils/types'

interface Props {
  league: League | null
  rulesets: Ruleset[]
  rulesetsLoading?: boolean
}

const props = defineProps<Props>()

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

const isEditing = computed(() => !!props.league)
const title = computed(() => isEditing.value ? 'Modifica Lega' : 'Crea Nuova Lega')
const description = computed(() => isEditing.value ? 'Modifica i dati della lega' : 'Compila i campi per creare una nuova lega')
const icon = computed(() => isEditing.value ? 'i-lucide-pencil' : 'i-lucide-trophy')
const submitLabel = computed(() => isEditing.value ? 'Salva' : 'Crea Lega')

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
    label: r.name ?? `Ruleset ${r.ruleset_id}`,
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
  if (!form.name.trim()) return

  const data = {
    name: form.name.trim(),
    startsAt: form.startsAt?.toString() ?? null,
    endsAt: form.endsAt?.toString() ?? null,
    rulesetId: form.rulesetId ?? null,
  }

  if (isEditing.value && props.league) {
    emit('update', { id: props.league.id, data })
  } else {
    emit('create', data)
    Object.assign(form, defaultForm())
    const firstRuleset = props.rulesets[0]
    if (firstRuleset) {
      form.rulesetId = firstRuleset.ruleset_id
    }
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
      <form id="league-form" class="space-y-4" @submit.prevent="handleSubmit">
        <UFormField label="Nome Lega" required>
          <UInput
            id="field-name"
            v-model="form.name"
            placeholder="Es. Commander League 2025"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <DatePicker
            v-model="form.startsAt"
            label="Data Inizio"
          />
          <DatePicker
            v-model="form.endsAt"
            label="Data Fine"
          />
        </div>

        <UFormField label="Regolamento">
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
      <UButton type="submit" form="league-form" color="primary" :disabled="!isValid">
        {{ submitLabel }}
      </UButton>
      <CancelButton @click="open = false" />
    </template>
  </UModal>
</template>
