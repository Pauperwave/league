When I add players to the table can I add a little animation?

Since UTable renders rows internally, you can't use <TransitionGroup> directly. The cleanest approach is to track newly added player IDs and apply a CSS animation class via the meta.class.tr function you already have.

In <script setup>, add this after your existing refs:

const newPlayerIds = ref(new Set<number>())

watch(() => props.data, (newData, oldData) => {
  const oldIds = new Set(oldData?.map(p => p.playerId) ?? [])
  const addedIds = newData.filter(p => !oldIds.has(p.playerId)).map(p => p.playerId)

  if (addedIds.length) {
    addedIds.forEach(id => newPlayerIds.value.add(id))
    // Remove the animation class after it completes
    setTimeout(() => {
      addedIds.forEach(id => newPlayerIds.value.delete(id))
    }, 600)
  }
})

Update your meta to include the animation class:

const meta = {
  class: {
    tr: (row: { original: WaitingPlayer }) => {
      const { playerId } = row.original
      const paid = paidPlayers.value.has(playerId)
      const companion = companionPlayers.value.has(playerId)

      const classes: string[] = []

      if (newPlayerIds.value.has(playerId)) classes.push('player-enter')
      if (paid && companion) classes.push('bg-success/10')
      else if (paid || companion) classes.push('bg-warning/10')

      return classes.join(' ')
    },
  },
}

Add the CSS animation at the bottom of the component:

<style scoped>
@keyframes playerSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
    background-color: var(--ui-color-primary-100);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    background-color: transparent;
  }
}

.player-enter {
  animation: playerSlideIn 0.5s ease-out forwards;
}
</style>

This gives you a slide down + fade in + green flash when a new player is added. The animation class is automatically cleaned up after 600ms so it doesn't interfere with subsequent state changes on that row. 


---

Punti positivi dell'approccio:

Non modifica UTable - usa il meta.class.tr esistente
Pulizia automatica - rimuove la classe dopo l'animazione
Semplice - codice minimo
Potenziali problemi:

Watch su props.data troppo ampio - triggera per qualsiasi cambio (ordinamento, filtri), non solo aggiunte. Potrebbe applicare l'animazione inappropriatamente
setTimeout impreciso - 600ms vs 500ms animation, potrebbe causare sfarfallii
Race conditions - se props.data cambia rapidamente, i setTimeout potrebbero sovrapporsi
Variabile CSS - var(--ui-color-primary-100) potrebbe non essere definita nel tema
Miglioramenti suggeriti:

Usare nextTick invece di setTimeout per timing più preciso
Verificare che i dati siano effettivamente nuovi (confronto deep)
Sincronizzare cleanup con animation duration (500ms)
Usare un colore CSS definito o fallback

---

All valid points! Here's the improved version addressing each issue:

const ANIMATION_MS = 500 // Single source of truth, synced with CSS

const newPlayerIds = ref(new Set<number>())
const animationTimers = new Map<number, ReturnType<typeof setTimeout>>()

watch(
  // Watch only the array of IDs, not the full objects — avoids triggering on paid/companion changes
  () => props.data.map(p => p.playerId),
  (newIds, oldIds) => {
    const oldSet = new Set(oldIds ?? [])
    const addedIds = newIds.filter(id => !oldSet.has(id))

    addedIds.forEach(id => {
      // Cancel existing timer for this ID before creating a new one
      if (animationTimers.has(id)) clearTimeout(animationTimers.get(id)!)

      newPlayerIds.value = new Set([...newPlayerIds.value, id])

      const timer = setTimeout(() => {
        newPlayerIds.value = new Set([...newPlayerIds.value].filter(x => x !== id))
        animationTimers.delete(id)
      }, ANIMATION_MS)

      animationTimers.set(id, timer)
    })
  }
)

// Prevent memory leaks / dangling timers on unmount
onUnmounted(() => {
  animationTimers.forEach(clearTimeout)
  animationTimers.clear()
})

Key improvements:

    Watches only IDs array — sorting, filtering, or toggling paid/companion won't trigger it
    Per-player timers via Map — each ID has its own independent timer, no overlapping
    ANIMATION_MS constant — timeout and CSS duration are always in sync
    onUnmounted cleanup — no dangling timers if the component is destroyed mid-animation

For the CSS, replace the potentially undefined variable with a safer color-mix:

<style scoped>
.player-enter {
  animation: playerSlideIn v-bind("ANIMATION_MS + 'ms'") ease-out forwards;
}

@keyframes playerSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
    background-color: color-mix(in oklch, var(--ui-primary) 20%, transparent);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    background-color: transparent;
  }
}
</style>

    color-mix with --ui-primary — always resolves correctly with any Nuxt UI theme, no hardcoded shades
    v-bind on duration — CSS animation duration stays in sync with the JS constant automatically
