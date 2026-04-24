<script setup lang="ts">

interface Props {
  playerId: number
  playerName: string
  commander1?: string | null
}

const props = defineProps<Props>()

const commander1 = ref(props.commander1 || '')

// Carica le whitelist delle carte
const { whitelists, isLoading, loadAllLists } = useCardWhitelists()

// Carica le whitelist quando il componente è montato
onMounted(() => {
  console.log('[CommanderModal] 🚀 Component mounted, loading whitelists...')
  loadAllLists().then(() => {
    console.log('[CommanderModal] ✅ Whitelists loaded, commander count:', whitelists.value.commander.length)
  })
})

// Computed per la whitelist (risolve problema readonly)
const commanderWhitelist = computed(() => [...whitelists.value.commander])

// Watch per debug
watch(() => whitelists.value.commander, (newVal) => {
  console.log('[CommanderModal] 📋 Commander whitelist updated:', newVal.length, 'items')
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium mb-1">Comandante</label>
      <div v-if="isLoading" class="text-sm text-gray-500 mb-2">
        Caricamento liste carte...
      </div>
      <CommanderSearch
        v-model="commander1"
        :whitelist="commanderWhitelist"
      />
    </div>
  </div>
</template>
