<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { CalendarDate } from '@internationalized/date'
import type { Ruleset, League } from '#shared/utils/types'

interface Props {
  league: League | null
  rulesets: Ruleset[]
  rulesetsLoading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  update: [{
    name: string
    startsAt: string | null
    endsAt: string | null
    rulesetId: number | null
  }]
}>()

const open = defineModel<boolean>('open', { default: false })

const name = ref('')
const selectedDate = ref<CalendarDate | null>(null)
const selectedEndDate = ref<CalendarDate | null>(null)
const selectedRulesetId = ref<number | undefined>()

const isValid = computed(() => !!name.value.trim())

const rulesetItems = computed(() =>
  props.rulesets.map((r) => ({
    label: r.name ?? `Ruleset ${r.ruleset_id}`,
    value: r.ruleset_id
  }))
)

function parseDateString(dateStr: string | null): CalendarDate | null {
  if (!dateStr) return null
  try {
    return parseDate(dateStr.split('T')[0])
  } catch {
    return null
  }
}

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen && props.league) {
      name.value = props.league.name
      selectedDate.value = parseDateString(props.league.starts_at)
      selectedEndDate.value = parseDateString(props.league.ends_at)
      selectedRulesetId.value = props.league.ruleset_id ?? undefined
    }
  }
)

function handleSubmit() {
  if (!name.value.trim()) return

  emit('update', {
    name: name.value.trim(),
    startsAt: selectedDate.value?.toString() ?? null,
    endsAt: selectedEndDate.value?.toString() ?? null,
    rulesetId: selectedRulesetId.value ?? null
  })

  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    description="Modifica i dati della lega"
    :ui="{ footer: 'justify-between' }"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon
          name="i-lucide-pencil"
          class="text-primary"
        />
        <span>Modifica Lega</span>
      </div>
    </template>

    <template #body>
      <form
        id="league-form"
        class="space-y-4"
        @submit.prevent="handleSubmit"
      >
        <div class="w-full">
          <label class="block text-sm font-medium mb-1">
            Nome Lega <span class="text-error">*</span>
          </label>
          <UInput
            v-model="name"
            placeholder="Es. Commander League 2025"
            class="w-full"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <DatePicker
            v-model="selectedDate"
            label="Data Inizio"
          />
          <DatePicker
            v-model="selectedEndDate"
            label="Data Fine"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">
            Regolamento
          </label>
          <USelect
            v-model="selectedRulesetId"
            :items="rulesetItems"
            :loading="rulesetsLoading"
            class="w-full"
            :ui="{ base: 'whitespace-normal', item: 'whitespace-normal' }"
          />
        </div>
      </form>
    </template>

    <template #footer>
      <UButton
        type="submit"
        form="league-form"
        color="primary"
        :disabled="!isValid"
      >
        Salva
      </UButton>
      <CancelButton @click="open = false" />
    </template>
  </UModal>
</template>
