<!-- app\components\ui\actions\RowActionButtons.vue -->
<script setup lang="ts">
const {
  showEdit = true,
  showView = false,
  showDelete = true,
  size = 'xs',
  variant = 'outline',
  disabled = false,
  loading = false,
} = defineProps<{
  showEdit?: boolean
  showView?: boolean
  showDelete?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'solid' | 'outline' | 'ghost' | 'link' | 'soft' | 'subtle'
  disabled?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  edit: []
  view: []
  delete: []
}>()
</script>

<template>
  <div class="flex items-center justify-center gap-1" @click.stop>
    <RowActionButton
      v-if="showEdit"
      action="edit"
      :size="size"
      :variant="variant"
      :disabled="disabled"
      :loading="loading"
      @click="emit('edit')"
    />
    <RowActionButton
      v-if="showView"
      action="view"
      :size="size"
      :variant="variant"
      :disabled="disabled"
      :loading="loading"
      @click="emit('view')"
    />
    <RowActionButton
      v-if="showDelete"
      action="remove"
      :size="size"
      :variant="variant"
      :disabled="disabled"
      :loading="loading"
      @click="emit('delete')"
    />
  </div>
</template>
