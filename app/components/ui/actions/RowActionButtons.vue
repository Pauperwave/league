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

const editLogging = useButtonLogging('Row Action: Edit')
const viewLogging = useButtonLogging('Row Action: View')
const removeLogging = useButtonLogging('Row Action: Remove')

function handleEdit() {
  editLogging.logClick()
  emit('edit')
}

function handleView() {
  viewLogging.logClick()
  emit('view')
}

function handleDelete() {
  removeLogging.logClick()
  emit('delete')
}
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
      @click="handleEdit"
    />
    <RowActionButton
      v-if="showView"
      action="view"
      :size="size"
      :variant="variant"
      :disabled="disabled"
      :loading="loading"
      @click="handleView"
    />
    <RowActionButton
      v-if="showDelete"
      action="remove"
      :size="size"
      :variant="variant"
      :disabled="disabled"
      :loading="loading"
      @click="handleDelete"
    />
  </div>
</template>
