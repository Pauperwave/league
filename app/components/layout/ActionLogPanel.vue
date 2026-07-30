<!-- app\components\layout\ActionLogPanel.vue -->
<script setup lang="ts">
import type { ActionLogEntry } from '~/composables/ui/useActionLog'

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const toast = useToast()
const { entries, clearLog } = useActionLog()

const expandedIds = ref<Set<string>>(new Set())

const sortedEntries = computed<ActionLogEntry[]>(() => [...entries.value].reverse())

function toggleExpanded(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
}

/** Renders an ISO timestamp as `YYYY-MM-DD HH:MM:SS` (local time, not locale-dependent) for the log list. */
function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const clearLogLogging = useButtonLogging(t('logging.actionLog.clear'))

function handleClear() {
  clearLogLogging.logClick()
  clearLog()
  toast.add({ title: t('actionLogPanel.clearedToast'), color: 'success' })
}
</script>

<template>
  <USlideover v-model:open="open" :title="t('actionLogPanel.title')">
    <template #actions>
      <span class="text-sm text-muted">{{ t('actionLogPanel.entryCount', { count: entries.length }) }}</span>
      <UButton
        size="xs"
        color="error"
        variant="outline"
        :icon="ICONS.delete"
        :label="t('actionLogPanel.clear')"
        @click="handleClear"
      />
    </template>

    <template #body>
      <UEmpty
        v-if="sortedEntries.length === 0"
        :icon="ICONS.actionLog"
        :title="t('actionLogPanel.empty')"
      />

      <div v-else class="space-y-1.5">
        <UCard
          v-for="entry in sortedEntries"
          :key="entry.id"
          variant="outline"
          :ui="{ body: 'p-2 sm:p-2' }"
          :class="entry.context ? 'cursor-pointer' : ''"
          @click="entry.context && toggleExpanded(entry.id)"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="font-medium truncate">{{ entry.button }}</p>
              <p class="text-xs text-muted">{{ formatTimestamp(entry.timestamp) }}</p>
            </div>
            <UIcon
              v-if="entry.context"
              :name="ICONS.chevronDown"
              class="size-4 text-muted shrink-0 transition-transform"
              :class="expandedIds.has(entry.id) ? '' : '-rotate-90'"
            />
          </div>

          <pre
            v-if="entry.context && expandedIds.has(entry.id)"
            class="mt-2 text-xs bg-muted/20 rounded p-2 overflow-x-auto"
          >{{ JSON.stringify(entry.context, null, 2) }}</pre>
        </UCard>
      </div>
    </template>
  </USlideover>
</template>
