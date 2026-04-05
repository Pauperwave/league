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

const df = new DateFormatter('it-IT', { dateStyle: 'medium' })

function getToday(): CalendarDate {
  const now = new Date()
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

function selectToday() {
  const today = getToday()
  selectedDate.value = today
  emit('update:modelValue', today) // always emits, even if already today
  open.value = false
}

// Use ref instead of computed to avoid the "already selected today" issue
const selectedDate = ref<CalendarDate>(props.modelValue ?? getToday())

// Sync with prop when it changes externally
watch(() => props.modelValue, (newValue) => {
  selectedDate.value = newValue ?? getToday()
})

// Emit changes when selectedDate changes
watch(selectedDate, (newValue) => {
  emit('update:modelValue', newValue)
})
</script>

<template>
  <div>
    <label class="block text-sm font-medium mb-1">
      {{ label }} <span
        v-if="required"
        class="text-error"
      >*</span>
    </label>
    <UPopover v-model:open="open">
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-lucide-calendar"
        class="w-full justify-between"
      >
        <span class="truncate">
          {{
            props.modelValue
              ? df.format(props.modelValue.toDate(getLocalTimeZone()))
              : "Seleziona una data"
          }}
        </span>
        <template #trailing>
          <span
            v-if="props.modelValue"
            class="ml-2 p-0.5 rounded cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
            @click.stop="emit('update:modelValue', null)"
          >
            <UIcon
              name="i-lucide-x"
              class="size-3"
            />
          </span>
        </template>
      </UButton>
      <template #content>
        <div class="p-2 space-y-2">
          <UCalendar
            v-model="selectedDate"
            class="p-2"
            @update:model-value="open = false"
          />
          <div class="flex justify-center">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              @click="selectToday"
            >
              Oggi
            </UButton>
          </div>
        </div>
      </template>
    </UPopover>
  </div>
</template>
