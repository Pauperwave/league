<!-- app\components\event\modal\EventKillModal.vue -->
<script setup lang="ts">
import type { Kill, TournamentPlayer } from '#shared/utils/types'

const {
  showKillModal,
  selectedKillPlayers,
  selectedKillPairingId,
} = defineProps<{
  showKillModal: boolean
  selectedKillPlayers: TournamentPlayer[]
  selectedKillPairingId: number | null
}>()

const emit = defineEmits<{
  submit: [kills: Kill[]]
  cancel: []
}>()

const open = computed({
  get: () => showKillModal,
  set: (val) => { if (!val) emit('cancel') },
})
</script>

<template>
  <KillSystemModal
    v-model:open="open"
    :players="selectedKillPlayers"
    :pairing-id="selectedKillPairingId"
    @submit="(kills) => emit('submit', kills)"
  />
</template>
