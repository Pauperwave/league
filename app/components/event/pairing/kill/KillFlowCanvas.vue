<!-- app\components\events\Pairings\Kill\KillFlowCanvas.vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
import { VueFlow, MarkerType, useVueFlow, type Node, type Edge, type Connection, type EdgeMouseEvent } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls, ControlButton } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import KillPlayerNode from './KillPlayerNode.vue'
import type { TournamentPlayer } from '#shared/utils/types'

const { setViewport, fitView, setEdges, onInit } = useVueFlow()

// ─── Props ────────────────────────────────────────────────────────────────────
const props = defineProps<{
  players: TournamentPlayer[]
}>()

// ─── Store & Toast ────────────────────────────────────────────────────────────
const killsStore = useKillsStore()
const toast = useToast()

// ─── Registrazione nodi custom ────────────────────────────────────────────────
// IMPORTANTE: definire fuori dal template, altrimenti Vue Flow
// ri-renderizza in loop
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// ─── Helper: mappa kills dello store in edge di Vue Flow ──────────────────────
function mapKillsToEdges(): Edge[] {
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
        animated: isSuicide,
        deletable: true,
        style: { stroke: 'var(--ui-color-error-500)', strokeWidth: 2.5 },
        markerEnd: {
          type: MarkerType.Arrow,
          color: 'var(--ui-color-error-500)',
          width: 15,
          height: 15,
        },
      }
    })
}

// ─── Sincronizza edges Vue Flow con lo store kills ────────────────────────────
onInit(() => {
  setEdges(mapKillsToEdges())
})

watch(killsStore.kills, () => {
  setEdges(mapKillsToEdges())
}, { deep: true })

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
      icon: ICONS.warning,
    })
  }
}

// ─── Evento: click su freccia esistente → rimuovi ────────────────────────────
function onEdgeClick({ edge }: EdgeMouseEvent) {
  killsStore.removeKill(Number(edge.source), Number(edge.target))
  toast.add({
    title: 'Uccisione rimossa',
    color: 'neutral',
    icon: ICONS.delete,
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
  console.log('Vue Flow data:', { nodes: nodes.value, edges: mapKillsToEdges() })
}
</script>

<template>
  <div class="w-full rounded-lg overflow-hidden border border-default" style="height: 420px">
    <VueFlow
      :nodes="nodes"
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
          <UIcon :name="ICONS.refresh" />
        </ControlButton>

        <ControlButton title="Fit View" @click="handleFitView">
          <UIcon :name="ICONS.fitView" />
        </ControlButton>

        <ControlButton title="Toggle Dark Mode" @click="toggleDarkMode">
          <UIcon v-if="dark" :name="ICONS.lightMode" />
          <UIcon v-else :name="ICONS.darkMode" />
        </ControlButton>

        <ControlButton title="Log Data" @click="logToObject">
          <UIcon :name="ICONS.terminal" />
        </ControlButton>
      </Controls>
    </VueFlow>
  </div>
</template>
