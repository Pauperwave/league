<!-- app\components\commander\ManaCost.vue -->
<script setup lang="ts">
const props = defineProps<{
  manaCost?: string | null
  size?: 'sm' | 'md' | 'lg'
}>()

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl'
}

// Parse mana cost into individual symbols (e.g., "{2}{W}{U}" -> ["2", "W", "U"])
const manaSymbols = computed(() => {
  const cost = props.manaCost || ''
  if (!cost) return []

  // Extract symbols between curly braces: {2}, {W}, {U}, etc.
  const matches = cost.match(/\{([^}]+)\}/g)
  if (!matches) return []

  return matches.map(match => match.slice(1, -1)) // Remove { and }
})

function getSymbolClasses(symbol: string): string[] {
  const clean = symbol.toLowerCase()
    .replace('//', '')
    .replace('/', '')
    .replace('{', '')
    .replace('}', '')

  // All mana symbols need .ms-cost for the circular colored background
  return [`ms-${clean}`, 'ms-cost']
}
</script>

<template>
  <div v-if="manaSymbols.length > 0" class="flex items-center gap-0.5">
    <span
      v-for="(symbol, index) in manaSymbols"
      :key="index"
      :class="['ms', ...getSymbolClasses(symbol), sizeClasses[size || 'md']]"
    />
  </div>
  <span v-else class="text-muted text-xs">—</span>
</template>

<style scoped>
.ms {
  display: inline-block;
  vertical-align: middle;
  border-radius: 500px;
}
</style>
