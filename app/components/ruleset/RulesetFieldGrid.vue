<!-- app\components\ruleset\RulesetFieldGrid.vue -->
<script setup lang="ts">
interface FieldItem {
  key: string
  label: string
  icon: string
}

interface Props {
  headingIcon: string
  headingText: string
  items: readonly FieldItem[]
  form: Record<string, unknown>
}

const { form } = defineProps<Props>()

const emit = defineEmits<{
  updateField: [key: string, value: number | undefined]
}>()

function getValue(key: string): number | undefined {
  return form[key] as number | undefined
}
</script>

<template>
  <div>
    <label class="flex text-xs font-medium mb-2 text-muted items-center justify-center gap-1.5">
      <UIcon :name="headingIcon" class="size-3" /> {{ headingText }}
    </label>
    <div class="grid grid-cols-4 gap-3">
      <UFormField
        v-for="item in items"
        :key="item.key"
        :name="item.key"
      >
        <template #label>
          <span class="flex items-center justify-center gap-1.5 text-muted">
            <UIcon :name="item.icon" class="size-3" /> {{ item.label }}
          </span>
        </template>
        <UInputNumber
          :id="`field-${item.key}`"
          :model-value="getValue(item.key)"
          :min="0"
          placeholder="0"
          class="w-full"
          @update:model-value="(value) => emit('updateField', item.key, value as number | undefined)"
        />
      </UFormField>
    </div>
  </div>
</template>
