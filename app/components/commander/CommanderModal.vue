<!-- app\components\modals\CommanderModal.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  playerId: number
  playerName: string
  commander1?: string | null
  commander2?: string | null
}>()

const { t } = useI18n()

const emit = defineEmits<{
  submit: [commander1: string | null, commander2: string | null]
}>()

const commander1 = ref(props.commander1 || '')
const commander2 = ref(props.commander2 || '')

// Load the commander whitelists
const { whitelists, isLoading, loadAllLists, getPartnerType, getAllowedPartners } = useCommanderWhitelists()

// Load whitelists when the component mounts
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
  if (!type || type === 'commander') return t('commander.partnerTypes.commander2Unavailable')
  if (type === 'partner') return t('commander.partnerTypes.partner')
  if (type === 'partner_with') return t('commander.partnerTypes.partnerWith')
  if (type === 'background' || type === 'background_commander') return t('commander.partnerTypes.background')
  if (type === 'friends_forever') return t('commander.partnerTypes.friendsForever')
  if (type === 'doctors_companion') return t('commander.partnerTypes.doctorsCompanion')
  if (type === 'companion') return t('commander.partnerTypes.companion')
  return t('commander.partnerTypes.commander2')
})

// Watch for debugging
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
      <label class="block text-sm font-medium mb-1">{{ t('commander.label') }}</label>
      <div v-if="isLoading" class="text-sm text-gray-500 mb-2">
        {{ t('commander.loadingLists') }}
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
        {{ t('commander.compatibleCards', { count: commander2Whitelist.length }) }}
      </UBadge>
      <CommanderSearch
        v-model="commander2"
        :whitelist="commander2Whitelist"
        :player-id="props.playerId"
      />
    </div>
    <div v-else-if="commander1" class="text-sm text-gray-500">
      {{ t('commander.noSecondCommander') }}
    </div>
  </div>
</template>

