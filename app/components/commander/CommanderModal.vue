<!-- app\components\commander\CommanderModal.vue -->
<script setup lang="ts">

const props = defineProps<{
  playerId: number
  playerName: string
  commander1?: string | null
  commander2?: string | null
  /** Every player seated at the same table/round as `playerId` — see
   *  useCommanderSearch's `tablePlayerIds` option for why this is worth passing. */
  tablePlayerIds?: number[]
}>()

const { t } = useI18n()

const emit = defineEmits<{
  submit: [commander1: string | null, commander2: string | null]
}>()

const commander1 = ref(props.commander1 || '')
const commander2 = ref(props.commander2 || '')

// Whitelists — backed by a shared, localStorage-persisted Pinia Colada query
// (useCommanderCatalogQuery): fetches once app-wide, no manual load needed.
// isLoading/refetch for the "Aggiorna elenco carte" button live in
// EventCommanderModal (footer), which calls this same composable — the
// underlying query is shared/cached, so both stay in sync.
const { whitelists, getPartnerType, getAllowedPartners, getExactPartnerName } = useCommanderWhitelists()

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
  logDebug('CommanderModal', '📋 Commander whitelist updated:', newVal.length, 'items')
})

// Clear commander2 when commander1 changes
watch(() => props.commander1, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    commander2.value = ''
  }
})

// "Partner with <specific card>" is a fixed, named pair (e.g. Cazur, Ruthless
// Stalker ↔ Ukkima, Stalking Shadow) — there's only ever one legal commander2
// once commander1 is picked, so auto-fill it instead of making the player
// search for and pick the one card the whitelist already narrowed to.
// Resolved entirely from the cached catalog (getExactPartnerName), no DB
// round-trip. Non-immediate: only reacts to the player actually (re)selecting
// commander1 in this session, not to the initial value coming in from props.
watch(commander1, (name) => {
  if (!name) return
  const partnerName = getExactPartnerName(name)
  if (partnerName) commander2.value = partnerName
})

// Blocks submit when commander1 requires a second card (partner/background/
// companion/etc., see canHaveCommander2) but commander2 hasn't been picked yet.
const canSubmit = computed(() => !canHaveCommander2.value || !!commander2.value)

function submit() {
  emit('submit', commander1.value || null, commander2.value || null)
}

defineExpose({ submit, canSubmit })
</script>

<template>
  <div class="space-y-4">
    <div class="flex gap-4">
      <!-- Commander 1 — always 50% when commander 2 is showing, full width otherwise -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center min-h-6 mb-1">
          <label class="block text-sm font-medium">{{ t('commander.label') }}</label>
        </div>
        <CommanderSearch
          v-model="commander1"
          :player-id="props.playerId"
          :table-player-ids="props.tablePlayerIds"
        />
      </div>

      <!-- Commander 2 (partner/background/doctor's companion/friends forever) — slides/fades in at 50% -->
      <AnimatePresence>
        <Motion
          v-if="canHaveCommander2"
          :initial="{ opacity: 0, x: -16 }"
          :animate="{ opacity: 1, x: 0 }"
          :exit="{ opacity: 0, x: -16 }"
          :transition="{ duration: 0.2, ease: 'easeOut' }"
          class="flex-1 min-w-0"
        >
          <div class="flex items-center gap-2 min-h-6 mb-1">
            <label class="block text-sm font-medium">{{ commander2Label }}</label>
            <UBadge
              v-if="commander2Whitelist.length > 0"
              size="sm"
              color="info"
              variant="soft"
            >
              {{ t('commander.compatibleCards', { count: commander2Whitelist.length }) }}
            </UBadge>
          </div>
          <CommanderSearch
            v-model="commander2"
            :whitelist="commander2Whitelist"
            :player-id="props.playerId"
            :table-player-ids="props.tablePlayerIds"
          />
        </Motion>
      </AnimatePresence>
    </div>
  </div>
</template>

