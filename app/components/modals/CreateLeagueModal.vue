<script setup lang="ts">
import { CalendarDate, getLocalTimeZone } from '@internationalized/date'
import type { Ruleset } from '~/types/database'

function getToday(): CalendarDate {
  const now = new Date()
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

interface Props {
  rulesets: Ruleset[]
  rulesetsLoading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  create: [{ name: string, startsAt: string, rulesetId: number }]
}>()

const open = defineModel<boolean>('open', { default: false })

const selectedDate = ref<CalendarDate | null>(getToday())

const leagueName = ref('')
const selectedRulesetId = ref<number>()

const loading = ref(false)

const isValid = computed(
  () => !!leagueName.value && !!selectedDate.value && !!selectedRulesetId.value
)

watch(
  () => props.rulesets,
  (newRulesets) => {
    if (newRulesets.length > 0 && !selectedRulesetId.value) {
      selectedRulesetId.value = newRulesets[0].ruleset_id
    }
  },
  { immediate: true }
)

function handleSubmit() {
  if (!leagueName.value || !selectedDate.value || !selectedRulesetId.value) return

  loading.value = true
  const dateStr = selectedDate.value.toDate(getLocalTimeZone())
  const startsAt = dateStr.toISOString().split('T')[0] as string

  emit('create', {
    name: leagueName.value,
    startsAt,
    rulesetId: selectedRulesetId.value
  })

  leagueName.value = ''
  selectedDate.value = getToday()
  selectedRulesetId.value = props.rulesets[0]?.rulesetId
  loading.value = false
  open.value = false
}

function handleCancel() {
  leagueName.value = ''
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Crea Nuova Lega"
    description="Compila i campi per creare una nuova lega"
    :ui="{ footer: 'justify-between' }"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon
          name="i-lucide-trophy"
          class="text-primary"
        />
        <span>Crea Nuova Lega</span>
      </div>
    </template>

    <template #body>
      <form
        class="space-y-4"
        @submit.prevent="handleSubmit"
      >
        <div class="w-full">
          <label class="block text-sm font-medium mb-1">
            Nome Lega <span class="text-error">*</span>
          </label>
          <UInput
            v-model="leagueName"
            placeholder="Es. Commander League 2025"
            required
            class="w-full"
          />
        </div>

        <DatePicker
          v-model="selectedDate"
          label="Data Inizio"
          required
        />

        <div>
          <label class="block text-sm font-medium mb-1">
            Regolamento <span class="text-error">*</span>
          </label>
          <USelect
            v-model="selectedRulesetId"
            :options="
              rulesets.map((r) => ({
                label: r.name ?? `Ruleset ${r.ruleset_id}`,
                value: r.ruleset_id
              }))
            "
            :loading="rulesetsLoading"
            required
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
        Crea Lega
      </UButton>
      <CancelButton @click="handleCancel" />
    </template>
  </UModal>
</template>
