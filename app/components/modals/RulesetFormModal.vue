<!-- app\components\Modals\RulesetFormModal.vue -->
<script setup lang="ts">
import type { Ruleset } from '#shared/utils/types'

interface Props {
  ruleset: Ruleset | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  create: [Omit<Ruleset, 'ruleset_id'>]
  update: [{ id: number; data: Partial<Ruleset> }]
}>()

const open = defineModel<boolean>('open', { default: false })

const isEditing = computed(() => !!props.ruleset)
const title = computed(() => isEditing.value ? 'Modifica Regolamento' : 'Crea Regolamento')
const description = computed(() => isEditing.value ? 'Modifica il regolamento e i punteggi' : 'Crea un nuovo regolamento con i relativi punteggi')
const icon = computed(() => isEditing.value ? 'i-lucide-pencil' : 'i-lucide-scale')
const submitLabel = computed(() => isEditing.value ? 'Salva' : 'Crea')

const defaultForm = () => ({
  name: '',
  partecipation: undefined as number | undefined,
  kill: undefined as number | undefined,
  brew: undefined as number | undefined,
  play: undefined as number | undefined,
  rank1: undefined as number | undefined,
  rank2: undefined as number | undefined,
  rank3: undefined as number | undefined,
  rank4: undefined as number | undefined,
  validEvents: undefined as number | undefined,
})

const form = reactive(defaultForm())

const isValid = computed(() => {
  if (!form.name.trim()) return false
  if (!isEditing.value) {
    return [form.partecipation, form.kill, form.brew, form.play, form.rank1, form.rank2, form.rank3, form.rank4, form.validEvents]
      .every(v => v !== undefined && v !== null)
  }
  return true
})

watch(open, (isOpen) => {
  if (!isOpen) return
  const r = props.ruleset
  if (r) {
    Object.assign(form, {
      name: r.name,
      partecipation: r.rule_set_partecipation ?? undefined,
      kill: r.rule_set_kill ?? undefined,
      brew: r.rule_set_brew ?? undefined,
      play: r.rule_set_play ?? undefined,
      rank1: r.rule_set_rank1 ?? undefined,
      rank2: r.rule_set_rank2 ?? undefined,
      rank3: r.rule_set_rank3 ?? undefined,
      rank4: r.rule_set_rank4 ?? undefined,
      validEvents: r.rule_set_valid_events ?? undefined,
    })
  } else {
    Object.assign(form, defaultForm())
  }
})

const gameActionFields = [
  { key: 'partecipation', label: 'Partecipazione', icon: 'i-lucide-user' },
  { key: 'kill', label: 'Kill', icon: 'i-lucide-sword' },
  { key: 'brew', label: 'Brew', icon: 'i-lucide-beer' },
  { key: 'play', label: 'Play', icon: 'i-lucide-play' },
] as const

const rankFields = ['rank1', 'rank2', 'rank3', 'rank4'] as const

function handleSubmit() {
  if (!form.name.trim()) return

  const scoreData = {
    name: form.name.trim(),
    rule_set_partecipation: form.partecipation ?? null,
    rule_set_kill: form.kill ?? null,
    rule_set_brew: form.brew ?? null,
    rule_set_play: form.play ?? null,
    rule_set_rank1: form.rank1 ?? null,
    rule_set_rank2: form.rank2 ?? null,
    rule_set_rank3: form.rank3 ?? null,
    rule_set_rank4: form.rank4 ?? null,
    rule_set_valid_events: form.validEvents ?? null,
  }

  if (isEditing.value && props.ruleset) {
    emit('update', { id: props.ruleset.ruleset_id, data: scoreData })
  } else {
    emit('create', scoreData)
    Object.assign(form, defaultForm())
  }

  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :description="description"
    :ui="{ footer: 'justify-between' }"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon :name="icon" class="text-primary" />
        <span>{{ title }}</span>
      </div>
    </template>

    <template #body>
      <form id="ruleset-form" class="space-y-4" @submit.prevent="handleSubmit">

        <!-- Nome -->
        <UFormField label="Nome" required>
          <UInput
            id="field-name"
            v-model="form.name"
            placeholder="Es. Regolamento Standard"
            class="w-full"
          />
        </UFormField>

        <!-- Punti per azioni di gioco -->
        <div>
          <label class="flex text-xs font-medium mb-2 text-muted items-center justify-center gap-1.5">
            <UIcon name="i-lucide-swords" class="size-3" /> Punti per azioni di gioco
          </label>
          <div class="grid grid-cols-4 gap-3">
            <UFormField
              v-for="{ key, label, icon: fieldIcon } in gameActionFields"
              :key="key"
              :name="key"
            >
              <template #label>
                <span class="flex items-center justify-center gap-1.5 text-muted">
                  <UIcon :name="fieldIcon" class="size-3" /> {{ label }}
                </span>
              </template>
              <UInputNumber
                :id="`field-${key}`"
                v-model="form[key]"
                :min="0"
                placeholder="0"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <!-- Punti per posizione -->
        <div>
          <label class="flex text-xs font-medium mb-2 text-muted items-center justify-center gap-1.5">
            <UIcon name="i-lucide-trophy" class="size-3" /> Punti per posizione
          </label>
          <div class="grid grid-cols-4 gap-2">
            <UFormField
              v-for="(rank, index) in rankFields"
              :key="rank"
              :name="rank"
            >
              <template #label>
                <span class="flex items-center justify-center gap-1 text-muted">
                  <UIcon name="i-lucide-medal" class="size-3" /> {{ index + 1 }}°
                </span>
              </template>
              <UInputNumber
                :id="`field-${rank}`"
                v-model="form[rank]"
                :min="0"
                placeholder="0"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <!-- Eventi validi richiesti -->
        <div class="flex flex-col items-center gap-1">
          <label class="flex text-xs font-medium text-muted items-center gap-1.5">
            <UIcon name="i-lucide-calendar-check" class="size-3" /> Eventi validi richiesti
          </label>
          <UInputNumber
            id="field-valid-events"
            v-model="form.validEvents"
            :min="0"
            placeholder="0"
          />
        </div>

      </form>
    </template>

    <template #footer>
      <UButton type="submit" form="ruleset-form" color="primary" :disabled="!isValid">
        {{ submitLabel }}
      </UButton>
      <CancelButton @click="open = false" />
    </template>
  </UModal>
</template>
