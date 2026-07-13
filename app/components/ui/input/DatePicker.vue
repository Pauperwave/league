<!-- app\components\ui\input\DatePicker.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'

const {
  label,
  required = false,
} = defineProps<{
  label?: string
  required?: boolean
}>()

const modelValue = defineModel<CalendarDate | null>({ required: true })

const { t } = useI18n()

const displayLabel = computed(() => label ?? t('common.dateLabel'))

const open = ref(false)
const df = new DateFormatter('it-IT', { dateStyle: 'long' })

function getToday(): CalendarDate {
  const now = new Date()
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

const selectedDate = computed({
  get: () => modelValue.value ?? getToday(),
  set: (v: CalendarDate) => { modelValue.value = v }
})
</script>

<template>
  <div>
    <label class="block text-sm font-medium mb-1">
      {{ displayLabel }} <span v-if="required" class="text-error">*</span>
    </label>
    <UPopover v-model:open="open">
      <UButton color="neutral" variant="subtle" :icon="ICONS.calendar" class="w-full justify-between">
        <span class="truncate">
          {{ modelValue ? df.format(modelValue.toDate(getLocalTimeZone())) : t('common.selectDate') }}
        </span>
        <template #trailing>
          <span
            v-if="modelValue"
            class="inline-flex ml-2 p-0.5 rounded cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
            @click.stop="modelValue = null"
          >
            <UIcon :name="ICONS.clear" class="size-4" />
          </span>
        </template>
      </UButton>
      <template #content>
        <div class="p-2 space-y-2">
          <UCalendar v-model="selectedDate" prevent-deselect class="p-2" @update:model-value="open = false" />
          <div class="flex justify-center">
            <UButton color="neutral" size="sm" @click="() => { selectedDate = getToday(); open = false }">
              {{ t('common.today') }}
            </UButton>
          </div>
        </div>
      </template>
    </UPopover>
  </div>
</template>
