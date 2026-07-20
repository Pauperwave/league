<!-- app\components\event\pairing\kill\KillFlowCanvas.vue -->
<script setup lang="ts">
import { VueFlow, MarkerType, useVueFlow, type Node, type Edge, type Connection, type EdgeMouseEvent } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls, ControlButton } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import KillPlayerNode from './KillPlayerNode.vue'
import KillLoopbackEdge from './KillLoopbackEdge.vue'
import type { TournamentPlayer } from '#shared/utils/types'

// Explicit id shared with <VueFlow id="kill-flow"> below — calling
// useVueFlow() in the same component that renders <VueFlow>, before it
// mounts, is only guaranteed to share that component's store when the ids
// match; otherwise setEdges()/etc. can silently write to an orphaned store
// that <VueFlow> never renders.
const FLOW_ID = 'kill-flow'
const { setEdges, onInit, zoomIn, zoomOut, fitView } = useVueFlow(FLOW_ID)

// Toggled by the lock/unlock control button — nodes stay permanently
// non-draggable (they're fixed chips), so "interactive" here only means
// "can the user still draw/edit kill connections right now".
const interactive = ref(true)

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edgeTypes = { loopback: markRaw(KillLoopbackEdge) } as any

// ─── Per-player color ───────────────────────────────────────────────────────
// Shared with KillSystemModal's registered-kills badge list, so a killer's
// edges/badges match across both components.
const playerColors = computed(() => getPlayerColorMap(props.players))

// ─── Shared node width ─────────────────────────────────────────────────────
// All nodes render at the same width, sized to fit the longest name+surname
// in full (no ellipsis) — `ch` approximates the width of one character in
// the current font, plus a fixed buffer for the avatar/gaps/padding in
// KillPlayerNode's chip content row (avatar 2.5rem + gap-2 0.5rem + px-2
// padding 1rem = 4rem).
const nodeWidth = computed(() => {
  const maxChars = Math.max(1, ...props.players.map((p) => `${p.name} ${p.surname}`.length))
  return `calc(${maxChars}ch + 4rem)`
})

// ─── Rectangular position calculation ─────────────────────────────────────────
// Distributes `total` nodes around a rectangle's perimeter, one side at a
// time: each side (top, right, bottom, left) gets a share of nodes
// proportional to its own length (largest-remainder rounding so the shares
// sum to `total` exactly), then that side's nodes are spaced evenly along
// its own length, starting at its own corner. Walking a single global arc-
// length fraction (the previous approach) only lines nodes up onto the
// corners when width === height — once the rectangle isn't square, opposite
// sides stop mirroring each other and nodes land unaligned.
function getRectangularPosition(index: number, total: number, width = 320, height = 240) {
  const sideLengths = [width, height, width, height] // top, right, bottom, left
  const perimeter = sideLengths.reduce((sum, length) => sum + length, 0)

  const rawShares = sideLengths.map((length) => (total * length) / perimeter)
  const counts = rawShares.map(Math.floor)
  const assigned = counts.reduce((sum, count) => sum + count, 0)
  const remainders = rawShares
    .map((share, i) => ({ i, frac: share - Math.floor(share) }))
    .sort((a, b) => b.frac - a.frac)
  for (let k = 0; k < total - assigned; k++) {
    counts[remainders[k]!.i]!++
  }

  let side = 0
  let posInSide = index
  while (side < 3 && posInSide >= counts[side]!) {
    posInSide -= counts[side]!
    side++
  }
  const t = posInSide / (counts[side] || 1)

  switch (side) {
    case 0: // top: left -> right
      return { x: t * width, y: 0 }
    case 1: // right: top -> bottom
      return { x: width, y: t * height }
    case 2: // bottom: right -> left
      return { x: width - t * width, y: height }
    default: // left: bottom -> top
      return { x: 0, y: height - t * height }
  }
}

// ─── Nodes (players) ─────────────────────────────────────────────────────────
const nodes = computed<Node[]>(() =>
  props.players.map((player, index) => ({
    id: String(player.id),
    // matches nodeTypes.player
    type: 'player',
    position: getRectangularPosition(index, props.players.length),
    data: { player, width: nodeWidth.value, color: playerColors.value.get(String(player.id))! },
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
      const color = `var(--ui-color-${playerColors.value.get(String(kill.killerId))}-500)`
      return {
        id: `${kill.killerId}-${kill.victimId}`,
        source: String(kill.killerId),
        target: String(kill.victimId),
        sourceHandle: 'source',
        targetHandle: 'target',
        type: isSuicide ? 'loopback' : 'default',
        animated: isSuicide,
        deletable: true,
        style: { stroke: color, strokeWidth: 2.5 },
        markerEnd: {
          type: MarkerType.Arrow,
          color,
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

// Default options for new edges during drag
const defaultEdgeOptions = {
  style: { stroke: 'var(--ui-color-primary-500)', strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.Arrow,
    color: 'var(--ui-color-primary-500)',
    width: 15,
    height: 15,
  },
}

// Connection validation (structural only)
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

// Event: connection completed (drag released on a valid target)
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

// Event: click on an existing arrow → remove
function onEdgeClick({ edge }: EdgeMouseEvent) {
  killsStore.removeKill(Number(edge.source), Number(edge.target))
  toast.add({
    title: t('event.killFlow.killRemovedTitle'),
    color: 'neutral',
    icon: ICONS.delete,
    duration: 2000,
  })
}

// Control functions
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
      :edge-types="edgeTypes"
      :connect-on-click="false"
      :nodes-draggable="false"
      :nodes-connectable="interactive"
      :zoom-on-scroll="true"
      :zoom-on-pinch="true"
      :pan-on-drag="true"
      :pan-on-scroll="false"
      fit-view-on-init
      :connection-radius="30"
      :default-edge-options="defaultEdgeOptions"
      :is-valid-connection="validateConnection"
      @connect="onConnect"
      @edge-click="onEdgeClick"
    >
      <!-- Optional grid background -->
      <Background pattern-color="var(--ui-border)" :gap="20" />

      <!-- Top-left controls — the library's own zoom/fit-view/lock buttons
           render raw <svg> icons with no title tooltip and can't be
           restyled to match (see the style block below), so every control
           here is a custom ControlButton instead of the defaults. -->
      <Controls position="top-left" :show-zoom="false" :show-fit-view="false" :show-interactive="false">
        <ControlButton :title="t('event.killFlow.zoomIn')" @click="zoomIn()">
          <UIcon :name="ICONS.add" class="size-5" />
        </ControlButton>

        <ControlButton :title="t('event.killFlow.zoomOut')" @click="zoomOut()">
          <UIcon :name="ICONS.subtract" class="size-5" />
        </ControlButton>

        <ControlButton :title="t('event.killFlow.fitView')" @click="fitView()">
          <UIcon :name="ICONS.fitView" class="size-5" />
        </ControlButton>

        <ControlButton
          :title="interactive ? t('event.killFlow.lock') : t('event.killFlow.unlock')"
          @click="interactive = !interactive"
        >
          <UIcon :name="interactive ? ICONS.unlock : ICONS.lock" class="size-5" />
        </ControlButton>

        <ControlButton :title="t('event.killFlow.logData')" @click="logToObject">
          <UIcon :name="ICONS.terminal" class="size-5" />
        </ControlButton>
      </Controls>
    </VueFlow>
  </div>
</template>

<style scoped>
/* Controls is a @vue-flow/controls internal, not our own template markup —
   :deep() is required to reach its DOM. @vue-flow/controls' own stylesheet
   hardcodes a white button background regardless of app theme, so any
   theme-following text color needs a theme-following background to match —
   the panel itself needs theme-aware colors, not just the icon. */
:deep(.vue-flow__controls) {
  background: var(--ui-bg-elevated);
  border: 1px solid var(--ui-border);
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}

:deep(.vue-flow__controls-button) {
  width: 1.25rem;
  height: 1.25rem;
  background: var(--ui-bg-elevated);
  border: none;
  border-bottom: 1px solid var(--ui-border);
  color: var(--ui-text);
}

:deep(.vue-flow__controls-button:last-child) {
  border-bottom: none;
}

:deep(.vue-flow__controls-button:hover) {
  background: var(--ui-bg-accented);
}
</style>
