<!-- app\components\Modals\LeaguesUsingRulesetModal.vue -->
<script setup lang="ts">
import { useButtonLogging } from '~/composables/useButtonLogging'

interface LeagueInfo {
  id: number
  name: string
}

interface Props {
  rulesetId: number
  rulesetName: string
  getLeaguesByRuleset: (rulesetId: number) => LeagueInfo[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  navigate: [leagueId: number]
}>()

const open = defineModel<boolean>('open', { default: false })

const leagues = computed(() => props.getLeaguesByRuleset(props.rulesetId))

const currentLeagueId = ref<number | null>(null)
const navigateLogging = useButtonLogging('Navigate to League', { leagueId: () => currentLeagueId.value, rulesetId: () => props.rulesetId })
const closeLogging = useButtonLogging('Close Leagues Using Ruleset Modal')

function handleNavigate(leagueId: number) {
  currentLeagueId.value = leagueId
  navigateLogging.logClick()
  emit('navigate', leagueId)
  open.value = false
}

function handleClose() {
  closeLogging.logClick()
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :description="`${leagues.length} leghe trovate`"
    :ui="{ footer: 'justify-end' }"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-trophy" class="text-primary" />
        <span>Leghe che usano il regolamento "{{ rulesetName }}"</span>
      </div>
    </template>

    <template #body>
      <!-- Stato vuoto -->
      <div v-if="leagues.length === 0" class="flex flex-col items-center gap-2 py-8 text-muted">
        <UIcon name="i-lucide-inbox" class="size-8" />
        <p class="text-sm">Nessuna lega sta usando questo regolamento</p>
      </div>

      <!-- Lista leghe -->
      <ul v-else class="space-y-2">
        <li
          v-for="league in leagues"
          :key="league.id"
        >
          <UButton
            variant="ghost"
            color="neutral"
            block
            :trailing-icon="'i-lucide-arrow-right'"
            :to="`/league/${league.id}`"
            :ui="{ base: 'justify-between', trailingIcon: 'text-muted' }"
            @click="handleNavigate(league.id)"
          >
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-shield" class="size-4 text-primary shrink-0" />
              <span class="font-medium truncate">{{ league.name }}</span>
            </div>
          </UButton>
        </li>
      </ul>
    </template>

    <template #footer>
      <UButton color="neutral" @click="handleClose">
        Chiudi
      </UButton>
    </template>
  </UModal>
</template>
