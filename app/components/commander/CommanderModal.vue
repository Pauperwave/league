<!-- app\components\modals\CommanderModal.vue -->
<script setup lang="ts">

const props = defineProps<{
  playerId: number
  playerName: string
  commander1?: string | null
  commander2?: string | null
}>()

const emit = defineEmits<{
  submit: [commander1: string | null, commander2: string | null]
  cancel: []
}>()

const commander1 = ref(props.commander1 || '')
const commander2 = ref(props.commander2 || '')

// Carica le whitelist dei comandanti
const { whitelists, isLoading, loadAllLists, getPartnerType, getAllowedPartners } = useCommanderWhitelists()

// Carica le whitelist quando il componente è montato
onMounted(() => {
  console.log('[CommanderModal] 🚀 Component mounted, loading whitelists...')
  loadAllLists().then(() => {
    console.log('[CommanderModal] ✅ Whitelists loaded, commander count:', whitelists.value.commander.length)
  })
})

// Computed: what partner type does commander1 have?
const commander1PartnerType = computed(() => {
  if (!commander1.value) return null
  return getPartnerType(commander1.value)
})

// Computed: should commander2 be enabled?
const canHaveCommander2 = computed(() => {
  return commander1PartnerType.value !== null && commander1PartnerType.value !== 'commander'
})

// Computed: whitelist for commander2 based on commander1's partner type
const commander2Whitelist = computed(() => {
  if (!commander1.value || !canHaveCommander2.value) return []
  return getAllowedPartners(commander1.value)
})

// Computed: label text for commander2 field
const commander2Label = computed(() => {
  const type = commander1PartnerType.value
  if (!type || type === 'commander') return 'Comandante 2 (non disponibile)'
  if (type === 'partner') return 'Partner'
  if (type === 'partner_with') return 'Partner With'
  if (type === 'background' || type === 'background_commander') return 'Background'
  if (type === 'friends_forever') return 'Friends Forever'
  if (type === 'doctors_companion') return 'Doctor\'s Companion'
  if (type === 'companion') return 'Companion'
  return 'Comandante 2'
})

// Watch per debug
watch(() => whitelists.value.commander, (newVal) => {
  console.log('[CommanderModal] 📋 Commander whitelist updated:', newVal.length, 'items')
})

// Clear commander2 when commander1 changes
watch(() => props.commander1, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    commander2.value = ''
  }
})

function submit() {
  emit('submit', commander1.value || null, commander2.value || null)
}

defineExpose({ submit })
</script>

<template>
  <div class="space-y-4">
    <!-- Commander 1 -->
    <div>
      <label class="block text-sm font-medium mb-1">Comandante</label>
      <div v-if="isLoading" class="text-sm text-gray-500 mb-2">
        Caricamento liste carte...
      </div>
      <CommanderSearch
        v-model="commander1"
        :player-id="props.playerId"
      />
    </div>

    <!-- Commander 2 (conditional) -->
    <div v-if="canHaveCommander2">
      <label class="block text-sm font-medium mb-1">{{ commander2Label }}</label>
      <UBadge
        v-if="commander2Whitelist.length > 0"
        size="sm"
        color="info"
        variant="soft"
        class="mb-2"
      >
        {{ commander2Whitelist.length }} carte compatibili
      </UBadge>
      <CommanderSearch
        v-model="commander2"
        :whitelist="commander2Whitelist"
        :player-id="props.playerId"
      />
    </div>
    <div v-else-if="commander1" class="text-sm text-gray-500">
      Questo comandante non supporta un secondo comandante
    </div>
  </div>
</template>

