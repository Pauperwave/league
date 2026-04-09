<script setup lang="ts">
interface Standing {
  player_id: number
  standing_player_score: number
  victories?: number
  brew_received?: number
  play_received?: number
  players?: {
    player_name: string
    player_surname: string
  }
}

interface Props {
  standings: Standing[]
  loading?: boolean
}

defineProps<Props>()
</script>

<template>
  <div class="bg-linear-to-b from-primary/10 to-transparent rounded-xl p-6 border-2 border-primary/30 shadow-lg">
    <div class="flex items-center justify-center gap-2 mb-4">
      <UIcon name="i-lucide-trophy" class="size-5 text-primary" />
      <h4 class="text-lg font-bold text-primary">Classifica</h4>
    </div>

    <ClientOnly>
      <div v-if="loading" class="flex items-center justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-primary" />
      </div>
      <div v-else-if="standings.length > 0" class="space-y-2">
        <div
          v-for="(standing, index) in standings"
          :key="standing.player_id"
          class="flex items-center justify-between p-3 bg-elevated rounded-lg"
        >
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 flex items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-sm">
              {{ index + 1 }}
            </span>
            <div>
              <p class="font-medium text-sm">
                {{ standing.players?.player_name }} {{ standing.players?.player_surname }}
              </p>
              <p class="text-xs text-muted">
                V: {{ standing.victories ?? 0 }} | Brew: {{ standing.brew_received ?? 0 }} | Play: {{ standing.play_received ?? 0 }}
              </p>
            </div>
          </div>
          <span class="text-lg font-bold text-primary">{{ standing.standing_player_score }} PT</span>
        </div>
      </div>
      <div v-else class="text-center py-8 text-muted">
        <UIcon name="i-lucide-bar-chart" class="text-4xl mb-2" />
        <p class="text-sm">Nessun punteggio</p>
      </div>

      <template #fallback>
        <div class="flex items-center justify-center py-8">
          <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-primary" />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
