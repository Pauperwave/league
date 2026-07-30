<!-- app\components\tournament\modal\TournamentScoresModal.vue -->
<script setup lang="ts">
import type { PairingWithResults, Ruleset, TablePlayer } from '#shared/utils/types'

const { t } = useI18n()

const {
  showScoresModal,
  selectedScoresPairingId,
  pairings,
  tournamentPlayers,
  ruleset = null,
} = defineProps<{
  showScoresModal: boolean
  selectedScoresPairingId: number | null
  pairings: PairingWithResults[]
  tournamentPlayers: TablePlayer[]
  ruleset?: Ruleset | null
}>()

const emit = defineEmits<{
  cancel: []
}>()

const open = computed({
  get: () => showScoresModal,
  set: (val) => { if (!val) emit('cancel') },
})

const pairing = computed(() =>
  selectedScoresPairingId !== null
    ? pairings.find(p => p.pairing_id === selectedScoresPairingId) ?? null
    : null
)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('tournament.scoresModal.title')"
    :ui="{ content: 'sm:max-w-2xl', body: 'p-2 sm:p-3' }"
  >
    <template #body>
      <TableScoresModal
        :pairing="pairing"
        :all-players="tournamentPlayers"
        :ruleset="ruleset"
      />
    </template>
  </UModal>
</template>
