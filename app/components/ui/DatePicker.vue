<!-- app\components\Ui\DatePicker.vue -->
<script setup lang="ts">
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'

interface Props {
  modelValue: CalendarDate | null
  label?: string
  required?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Data',
  required: false
})

const emit = defineEmits<{
  'update:modelValue': [value: CalendarDate | null]
}>()

const open = ref(false)
const df = new DateFormatter('it-IT', { dateStyle: 'long' })

function getToday(): CalendarDate {
  const now = new Date()
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

const selectedDate = computed({
  get: () => props.modelValue ?? getToday(),
  set: (v: CalendarDate) => emit('update:modelValue', v)
})
</script>

<template>
  <div>
    <label class="block text-sm font-medium mb-1">
      {{ label }} <span v-if="required" class="text-error">*</span>
    </label>
    <UPopover v-model:open="open">
      <UButton color="neutral" variant="subtle" icon="i-lucide-calendar" class="w-full justify-between">
        <span class="truncate">
          {{ modelValue ? df.format(modelValue.toDate(getLocalTimeZone())) : "Seleziona una data" }}
        </span>
        <template #trailing>
          <span
            v-if="modelValue"
            class="inline-flex ml-2 p-0.5 rounded cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
            @click.stop="emit('update:modelValue', null)"
          >
            <UIcon name="i-lucide-circle-x" class="size-4" />
          </span>
        </template>
      </UButton>
      <template #content>
        <div class="p-2 space-y-2">
          <UCalendar v-model="selectedDate" prevent-deselect class="p-2" @update:model-value="open = false" />
          <div class="flex justify-center">
            <UButton color="neutral" variant="outline" size="sm" @click="() => { selectedDate = getToday(); open = false }">
              Oggi
            </UButton>
          </div>
        </div>
      </template>
    </UPopover>
  </div>
</template>
