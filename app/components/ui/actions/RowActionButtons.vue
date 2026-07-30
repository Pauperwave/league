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
  entityLabel,
} = defineProps<{
  showEdit?: boolean
  showView?: boolean
  showDelete?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'solid' | 'outline' | 'ghost' | 'link' | 'soft' | 'subtle'
  disabled?: boolean
  loading?: boolean
  /** Row's display name (e.g. league/tournament/player name), so the action log shows which entity was affected instead of just "edit was clicked somewhere". */
  entityLabel?: string
}>()

const emit = defineEmits<{
  edit: []
  view: []
  delete: []
}>()

const { t } = useI18n()

const editLogging = useButtonLogging(t('logging.rowActions.edit'), { entityLabel: () => entityLabel })
const viewLogging = useButtonLogging(t('logging.rowActions.view'), { entityLabel: () => entityLabel })
const removeLogging = useButtonLogging(t('logging.rowActions.remove'), { entityLabel: () => entityLabel })

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
