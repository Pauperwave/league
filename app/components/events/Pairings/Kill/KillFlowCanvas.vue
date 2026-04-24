<script setup lang="ts">
import { VueFlow, MarkerType, useVueFlow, type Node, type Edge, type Connection, type EdgeMouseEvent } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls, ControlButton } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import KillPlayerNode from './KillPlayerNode.vue'
import type { TournamentPlayer } from '#shared/utils/types'

const { setViewport, fitView } = useVueFlow()

// ─── Props ────────────────────────────────────────────────────────────────────
const props = defineProps<{
  players: TournamentPlayer[]
}>()

// ─── Store & Toast ────────────────────────────────────────────────────────────
const killsStore = useKillsStore()
const toast = useToast()

// ─── Key for force re-render when kills change ───────────────────────────────
const flowKey = computed(() => killsStore.kills.length)

// ─── Registrazione nodi custom ────────────────────────────────────────────────
// IMPORTANTE: definire fuori dal template, altrimenti Vue Flow
// ri-renderizza in loop
const nodeTypes = { player: markRaw(KillPlayerNode) } as any

// ─── Calcolo posizioni circolari ──────────────────────────────────────────────
function getCircularPosition(index: number, total: number, radius = 150) {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2
  return {
    x: 200 + radius * Math.cos(angle),
    y: 200 + radius * Math.sin(angle),
  }
}

// ─── Nodi (giocatori) ─────────────────────────────────────────────────────────
const nodes = computed<Node[]>(() =>
  props.players.map((player, index) => ({
    id: String(player.id),
    type: 'player',                    // corrisponde a nodeTypes.player
    position: getCircularPosition(index, props.players.length),
    data: { player },
    draggable: false,                  // chip fisse nel canvas
  })),
)

// ─── Edges (uccisioni) — sincronizzati con lo store ───────────────────────────
const edges = computed<Edge[]>(() => {
  const validPlayerIds = new Set(props.players.map((p) => String(p.id)))
  return killsStore.kills
    .filter((kill) => validPlayerIds.has(String(kill.killerId)) && validPlayerIds.has(String(kill.victimId)))
    .map((kill) => {
      const isSuicide = kill.killerId === kill.victimId
      return {
        id: `${kill.killerId}-${kill.victimId}`,
        source: String(kill.killerId),
        target: String(kill.victimId),
        sourceHandle: 'source',
        targetHandle: 'target',
          type: isSuicide ? 'smoothstep' : 'default',
          animated: isSuicide, // Loop animato per suicidi
        deletable: true,
        style: { stroke: 'var(--ui-color-error-500)', strokeWidth: 2.5 },
        markerEnd: {
          type: MarkerType.Arrow,
          color: 'var(--ui-color-error-500)',
          width: 15,
          height: 15,
        }
      }
    })
})

// ─── Opzioni default per nuovi edge durante il drag ───────────────────────────
const defaultEdgeOptions = {
  style: { stroke: 'var(--ui-color-primary-500)', strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.Arrow,
    color: 'var(--ui-color-primary-500)',
    width: 15,
    height: 15,
  },
}

// ─── Validazione connessioni (impedisce duplicati) ───────────────────────────────
function validateConnection(connection: Connection): boolean {
  // Verifica che entrambi i giocatori esistano nel tavolo corrente
  const validPlayerIds = new Set(props.players.map((p) => String(p.id)))
  if (!validPlayerIds.has(connection.source) || !validPlayerIds.has(connection.target)) return false

  // No duplicati
  return !killsStore.isKillPresent(
    Number(connection.source),
    Number(connection.target),
  )
}

// ─── Evento: connessione completata (drag rilasciato su target valido) ─────────
function onConnect(connection: Connection) {
  const killerId = Number(connection.source)
  const victimId = Number(connection.target)

  const result = killsStore.addKill(killerId, victimId)
  if (!result.success) {
    toast.add({
      title: 'Non valido',
      description: result.error,
      color: 'warning',
      icon: 'i-lucide-alert-triangle',
    })
  }
}

// ─── Evento: click su freccia esistente → rimuovi ────────────────────────────
function onEdgeClick({ edge }: EdgeMouseEvent) {
  killsStore.removeKill(Number(edge.source), Number(edge.target))
  toast.add({
    title: 'Uccisione rimossa',
    color: 'neutral',
    icon: 'i-lucide-trash-2',
    duration: 2000,
  })
}

// ─── Funzioni per i controlli ───────────────────────────────────────────────────
const dark = ref(false)

function resetTransform() {
  setViewport({ x: 0, y: 0, zoom: 1 })
}

function handleFitView() {
  fitView()
}

function toggleDarkMode() {
  dark.value = !dark.value
}

function logToObject() {
  console.log('Vue Flow data:', { nodes: nodes.value, edges: edges.value })
}
</script>

<template>
  <div class="w-full rounded-lg overflow-hidden border border-default" style="height: 420px">
    <VueFlow
      :key="flowKey"
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :class="{ dark }"
      :connect-on-click="false"
      :nodes-draggable="false"
      :nodes-connectable="true"
      :zoom-on-scroll="true"
      :zoom-on-pinch="true"
      :pan-on-drag="true"
      :pan-on-scroll="false"
      fit-view-on-init
      :default-edge-options="defaultEdgeOptions"
      :is-valid-connection="validateConnection"
      @connect="onConnect"
      @edge-click="onEdgeClick"
    >
      <!-- Sfondo griglia opzionale -->
      <Background pattern-color="var(--ui-border)" :gap="20" />

      <!-- Controlli in alto a sinistra -->
      <Controls position="top-left">
        <ControlButton title="Reset Transform" @click="resetTransform">
          <UIcon name="i-lucide-refresh-cw" />
        </ControlButton>

        <ControlButton title="Fit View" @click="handleFitView">
          <UIcon name="i-lucide-maximize" />
        </ControlButton>

        <ControlButton title="Toggle Dark Mode" @click="toggleDarkMode">
          <UIcon v-if="dark" name="i-lucide-sun" />
          <UIcon v-else name="i-lucide-moon" />
        </ControlButton>

        <ControlButton title="Log Data" @click="logToObject">
          <UIcon name="i-lucide-terminal" />
        </ControlButton>
      </Controls>
    </VueFlow>
  </div>
</template>
