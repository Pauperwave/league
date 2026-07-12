<!-- app\components\Modals\LeaguesUsingRulesetModal.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import { useButtonLogging } from '~/composables/ui/useButtonLogging'

interface LeagueInfo {
  id: number
  name: string
}

const props = defineProps<{
  rulesetId: number
  rulesetName: string
  getLeaguesByRuleset: (rulesetId: number) => LeagueInfo[]
}>()

const { t } = useI18n()

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
    :description="t('league.usingRulesetModal.foundCount', leagues.length, { named: { count: leagues.length } })"
    :ui="{ footer: 'justify-end' }"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon :name="ICONS.standings" class="text-primary" />
        <span>{{ t('league.usingRulesetModal.title', { name: rulesetName }) }}</span>
      </div>
    </template>

    <template #body>
      <!-- Stato vuoto -->
      <div v-if="leagues.length === 0" class="flex flex-col items-center gap-2 py-8 text-muted">
        <UIcon :name="ICONS.empty" class="size-8" />
        <p class="text-sm">{{ t('league.usingRulesetModal.empty') }}</p>
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
            :trailing-icon="ICONS.forward"
            :to="`/league/${league.id}`"
            :ui="{ base: 'justify-between', trailingIcon: 'text-muted' }"
            @click="handleNavigate(league.id)"
          >
            <div class="flex items-center gap-2">
              <UIcon :name="ICONS.commander" class="size-4 text-primary shrink-0" />
              <span class="font-medium truncate">{{ league.name }}</span>
            </div>
          </UButton>
        </li>
      </ul>
    </template>

    <template #footer>
      <UButton color="neutral" @click="handleClose">
        {{ t('common.close') }}
      </UButton>
    </template>
  </UModal>
</template>
