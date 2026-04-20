<script setup lang="ts">
const props = withDefaults(defineProps<{
  showEdit?: boolean
  showView?: boolean
  showDelete?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'solid' | 'outline' | 'ghost' | 'link' | 'soft' | 'subtle'
  disabled?: boolean
  loading?: boolean
}>(), {
  showEdit: true,
  showView: false,
  showDelete: true,
  size: 'xs',
  variant: 'outline',
  disabled: false,
  loading: false,
})

const emit = defineEmits<{
  edit: []
  view: []
  delete: []
}>()
</script>

<template>
  <div class="flex items-center justify-center gap-1" @click.stop>
    <BaseButton
      v-if="props.showEdit"
      action="edit"
      :size="props.size"
      :variant="props.variant"
      :disabled="props.disabled"
      :loading="props.loading"
      @click="emit('edit')"
    />
    <BaseButton
      v-if="props.showView"
      action="view"
      :size="props.size"
      :variant="props.variant"
      :disabled="props.disabled"
      :loading="props.loading"
      @click="emit('view')"
    />
    <BaseButton
      v-if="props.showDelete"
      action="remove"
      :size="props.size"
      :variant="props.variant"
      :disabled="props.disabled"
      :loading="props.loading"
      @click="emit('delete')"
    />
  </div>
</template>
