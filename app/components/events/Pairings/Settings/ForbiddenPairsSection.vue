<script setup lang="ts">
interface ForbiddenPairDisplay {
  key: string
  playerA: number
  playerB: number
  label: string
}

interface Props {
  playerOptions: Array<{ label: string; value: string }>
  forbiddenPairsDisplay: ForbiddenPairDisplay[]
  canAddForbiddenPair: boolean
  pairingStorageKey: string
}

defineProps<Props>()

const emit = defineEmits<{
  addPair: []
  resolveConflicts: []
  removePair: [playerA: number, playerB: number]
}>()

const pairPlayerA = defineModel<string>('pairPlayerA', { default: '' })
const pairPlayerB = defineModel<string>('pairPlayerB', { default: '' })
</script>

<template>
  <section class="space-y-3">
    <div class="text-sm font-semibold">Coppie Vietate</div>

    <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
      <USelectMenu
        v-model="pairPlayerA"
        :items="playerOptions"
        value-key="value"
        placeholder="Giocatore A"
        :search-input="{ placeholder: 'Cerca giocatore...' }"
      />

      <USelectMenu
        v-model="pairPlayerB"
        :items="playerOptions"
        value-key="value"
        placeholder="Giocatore B"
        :search-input="{ placeholder: 'Cerca giocatore...' }"
      />

      <UButton
        ref="addButton"
        size="sm"
        color="neutral"
        variant="soft"
        icon="i-lucide-plus"
        :disabled="!canAddForbiddenPair"
        @click="emit('addPair')"
      >
        Aggiungi coppia
      </UButton>

      <UButton
        size="sm"
        color="warning"
        variant="outline"
        icon="i-lucide-refresh-cw"
        @click="emit('resolveConflicts')"
      >
        Risolvi conflitti
      </UButton>
    </div>

    <div class="max-h-48 overflow-auto space-y-1 pr-1">
      <div v-if="!forbiddenPairsDisplay.length" class="text-sm text-muted">
        Nessuna coppia vietata
      </div>

      <div
        v-for="pair in forbiddenPairsDisplay"
        :key="pair.key"
        class="flex items-center justify-between rounded border border-default/70 bg-muted/20 px-2 py-1.5"
      >
        <span class="text-sm">{{ pair.label }}</span>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-trash-2"
          @click="emit('removePair', pair.playerA, pair.playerB)"
        />
      </div>
    </div>

    <div class="text-xs text-muted">
      I valori sono salvati nel LocalStorage del browser con chiave
      <code>{{ pairingStorageKey }}</code>.
    </div>
  </section>
</template>
