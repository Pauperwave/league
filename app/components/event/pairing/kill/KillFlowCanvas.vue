<!-- app\components\event\pairing\kill\KillFlowCanvas.vue -->
<script setup lang="ts">
import { VueFlow, MarkerType, useVueFlow, type Node, type Edge, type Connection, type EdgeMouseEvent } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls, ControlButton } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import KillPlayerNode from './KillPlayerNode.vue'
import type { TournamentPlayer } from '#shared/utils/types'

// Explicit id shared with <VueFlow id="kill-flow"> below — calling
// useVueFlow() in the same component that renders <VueFlow>, before it
// mounts, is only guaranteed to share that component's store when the ids
// match; otherwise setEdges()/etc. can silently write to an orphaned store
// that <VueFlow> never renders.
const FLOW_ID = 'kill-flow'
const { setViewport, fitView, setEdges, onInit } = useVueFlow(FLOW_ID)

// ─── Props ────────────────────────────────────────────────────────────────────
const props = defineProps<{
  players: TournamentPlayer[]
}>()

// ─── Store & Toast ────────────────────────────────────────────────────────────
const killsStore = useKillsStore()
const toast = useToast()
const { t } = useI18n()

// ─── Custom node registration ────────────────────────────────────────────────
// IMPORTANT: define outside the template, otherwise Vue Flow
// re-renders in a loop
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes = { player: markRaw(KillPlayerNode) } as any

// ─── Rectangular position calculation ─────────────────────────────────────────
// Distributes `total` nodes evenly around a rectangle's perimeter, starting
// at the top-left corner and walking clockwise (top -> right -> bottom -> left).
function getRectangularPosition(index: number, total: number, width = 300, height = 300) {
  const perimeter = 2 * (width + height)
  const dist = (perimeter * index) / total

  if (dist < width) {
    return { x: dist, y: 0 }
  }
  if (dist < width + height) {
    return { x: width, y: dist - width }
  }
  if (dist < 2 * width + height) {
    return { x: width - (dist - width - height), y: height }
  }
  return { x: 0, y: height - (dist - 2 * width - height) }
}

// ─── Nodes (players) ─────────────────────────────────────────────────────────
const nodes = computed<Node[]>(() =>
  props.players.map((player, index) => ({
    id: String(player.id),
    // matches nodeTypes.player
    type: 'player',
    position: getRectangularPosition(index, props.players.length),
    data: { player },
    // fixed chips on the canvas
    draggable: false,
  })),
)

// ─── Helper: map store kills to Vue Flow edges ──────────────────────
function mapKillsToEdges(): Edge[] {
  const validPlayerIds = new Set(props.players.map((p) => String(p.id)))
  const edges = killsStore.kills
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
  logDebug('KillFlowCanvas', 'mapKillsToEdges:', { kills: killsStore.kills, edges })
  return edges
}

// ─── Sync Vue Flow edges with the kills store ────────────────────────────
onInit(() => {
  logDebug('KillFlowCanvas', 'onInit — setting initial edges')
  setEdges(mapKillsToEdges())
})

// Getter form, not `watch(killsStore.kills, ...)`: removeKill/hydrate/reset
// replace the array, which would leave a reference-based watcher attached to
// the old, dead array.
watch(() => killsStore.kills, () => {
  logDebug('KillFlowCanvas', 'kills store changed — resyncing edges')
  setEdges(mapKillsToEdges())
}, { deep: true })

// ─── Default options for new edges during drag ───────────────────────────
const defaultEdgeOptions = {
  style: { stroke: 'var(--ui-color-primary-500)', strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.Arrow,
    color: 'var(--ui-color-primary-500)',
    width: 15,
    height: 15,
  },
}

// ─── Connection validation (structural only) ───────────────────────────────
// Vue Flow re-runs `isValidConnection` against every edge on every setEdges()
// sync, not just live drag attempts (see createGraphEdges in
// @vue-flow/core) — so a duplicate check here (`isKillPresent`) would reject
// an edge the instant its own kill lands in the store, since by then the
// kill is obviously "already present". Duplicate/reverse-kill rejection is
// `killsStore.addKill`'s job (called from onConnect below, with a toast) —
// this only checks that both endpoints belong to the current table.
function validateConnection(connection: Connection): boolean {
  const validPlayerIds = new Set(props.players.map((p) => String(p.id)))
  return validPlayerIds.has(connection.source) && validPlayerIds.has(connection.target)
}

// ─── Event: connection completed (drag released on a valid target) ─────────
function onConnect(connection: Connection) {
  const killerId = Number(connection.source)
  const victimId = Number(connection.target)

  logDebug('KillFlowCanvas', 'onConnect:', connection)
  const result = killsStore.addKill(killerId, victimId)
  logDebug('KillFlowCanvas', 'addKill result:', result)
  if (!result.success) {
    toast.add({
      title: t('event.killFlow.invalidTitle'),
      description: result.error,
      color: 'warning',
      icon: ICONS.warning,
    })
  }
}

// ─── Event: click on an existing arrow → remove ────────────────────────────
function onEdgeClick({ edge }: EdgeMouseEvent) {
  killsStore.removeKill(Number(edge.source), Number(edge.target))
  toast.add({
    title: t('event.killFlow.killRemovedTitle'),
    color: 'neutral',
    icon: ICONS.delete,
    duration: 2000,
  })
}

// ─── Control functions ───────────────────────────────────────────────────
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
  logDebug('KillFlowCanvas', 'Vue Flow data:', { nodes: nodes.value, edges: mapKillsToEdges() })
}
</script>

<template>
  <div class="w-full rounded-lg overflow-hidden border border-default" style="height: 420px">
    <VueFlow
      :id="FLOW_ID"
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
      <!-- Optional grid background -->
      <Background pattern-color="var(--ui-border)" :gap="20" />

      <!-- Top-left controls -->
      <Controls position="top-left">
        <ControlButton :title="t('event.killFlow.resetTransform')" @click="resetTransform">
          <UIcon :name="ICONS.refresh" />
        </ControlButton>

        <ControlButton :title="t('event.killFlow.fitView')" @click="handleFitView">
          <UIcon :name="ICONS.fitView" />
        </ControlButton>

        <ControlButton :title="t('event.killFlow.toggleDarkMode')" @click="toggleDarkMode">
          <UIcon v-if="dark" :name="ICONS.lightMode" />
          <UIcon v-else :name="ICONS.darkMode" />
        </ControlButton>

        <ControlButton :title="t('event.killFlow.logData')" @click="logToObject">
          <UIcon :name="ICONS.terminal" />
        </ControlButton>
      </Controls>
    </VueFlow>
  </div>
</template>
