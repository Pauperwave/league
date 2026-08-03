<!-- app\components\ui\input\SearchInput.vue -->
<!-- A UInput with a search icon and a clear ("x") trailing button that only
     shows once there's text to clear — used by commanders/index.vue and
     payments/index.vue's search boxes. -->
<script setup lang="ts">
const modelValue = defineModel<string>({ default: '' })
const { placeholder } = defineProps<{ placeholder: string }>()
</script>

<template>
  <UInput
    v-model="modelValue"
    :icon="ICONS.search"
    :placeholder="placeholder"
  >
    <template v-if="modelValue" #trailing>
      <UButton
        color="neutral"
        variant="link"
        size="xs"
        :icon="ICONS.clear"
        :padded="false"
        @click="modelValue = ''"
      />
    </template>
  </UInput>
</template>
