<!-- app/components/Modals/DeckCreateModal.vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
const emit = defineEmits<{
  create: [deck: {
    player_id: number
    commander_1_name: string
    commander_2_name: string | null
    companion_name: string | null
    is_borrowed: boolean
    lender_id: number | null
  }]
}>()

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{
  playerId: number
}>()

const playersStore = usePlayerStore()

// — Form state —
const commander1 = ref('')
const commander2 = ref('')
const companion = ref('')
const isBorrowed = ref(false)
const lenderId = ref<string | undefined>(undefined)

const lenderOptions = computed(() =>
  playersStore.players
    .filter(p => p.player_id !== props.playerId)
    .map(p => ({
      label: `${p.player_name} ${p.player_surname}`,
      value: String(p.player_id)
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
)

const canSubmit = computed(() => {
  if (!commander1.value.trim()) return false
  if (isBorrowed.value && !lenderId.value) return false
  return true
})

watch(open, async (isOpen) => {
  if (!isOpen) return

  // Ensure players are loaded before showing options
  if (playersStore.players.length === 0) {
    await playersStore.fetchPlayers()
  }

  commander1.value = ''
  commander2.value = ''
  companion.value = ''
  isBorrowed.value = false
  lenderId.value = undefined
})

function handleSubmit() {
  if (!canSubmit.value) return

  emit('create', {
    player_id: props.playerId,
    commander_1_name: commander1.value.trim(),
    commander_2_name: commander2.value.trim() || null,
    companion_name: companion.value.trim() || null,
    is_borrowed: isBorrowed.value,
    lender_id: isBorrowed.value ? (lenderId.value ? Number(lenderId.value) : null) : null
  })

  open.value = false
}

function handleCancel() {
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    description="Aggiungi un nuovo commander deck al giocatore"
    :ui="{ footer: 'justify-between' }"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon :name="ICONS.add" class="text-primary" />
        <span>Nuovo Deck</span>
      </div>
    </template>

    <template #body>
      <form id="deck-create-form" class="space-y-4" @submit.prevent="handleSubmit">
        <!-- Commander 1 -->
        <UFormField label="Commander" required>
          <UInput
            v-model="commander1"
            placeholder="Es. Atraxa, Praetors' Voice"
            class="w-full"
          />
        </UFormField>

        <!-- Commander 2 -->
        <UFormField label="Partner (opzionale)">
          <UInput
            v-model="commander2"
            placeholder="Es. Thrasios, Triton Hero"
            class="w-full"
          />
        </UFormField>

        <!-- Companion -->
        <UFormField label="Compagno (opzionale)">
          <UInput
            v-model="companion"
            placeholder="Es. Lutri, the Spellchaser"
            class="w-full"
          />
        </UFormField>

        <!-- Borrowed -->
        <UCard variant="outline">
          <div class="flex items-center gap-3">
            <USwitch v-model="isBorrowed" />
            <div>
              <p class="font-medium">Deck prestato</p>
              <p class="text-sm text-muted">
                Attiva se questo deck non è di proprietà del giocatore
              </p>
            </div>
          </div>
        </UCard>

        <!-- Lender -->
        <UFormField
          v-if="isBorrowed"
          label="Prestato da"
          required
        >
          <USelectMenu
            v-model="lenderId"
            :items="lenderOptions"
            value-key="value"
            placeholder="Cerca e seleziona il proprietario"
            :search-input="{ placeholder: 'Cerca giocatore...' }"
            class="w-full"
          />
        </UFormField>
      </form>
    </template>

    <template #footer>
      <CancelButton @click="handleCancel" />
      <UButton
        type="submit"
        form="deck-create-form"
        color="primary"
        :trailing-icon="ICONS.add"
        :disabled="!canSubmit"
      >
        Aggiungi
      </UButton>
    </template>
  </UModal>
</template>
