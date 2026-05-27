<!-- app\components\modals\CommanderModal.vue -->
<script setup lang="ts">

const props = defineProps<{
  playerId: number
  playerName: string
  commander1?: string | null
}>()

const emit = defineEmits<{
  submit: [commander1: string | null]
  cancel: []
}>()

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

function submit() {
  emit('submit', commander1.value || null)
}

defineExpose({ submit })
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

