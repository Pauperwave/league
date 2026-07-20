<!-- app\components\event\pairing\kill\KillLoopbackEdge.vue -->
<script setup lang="ts">
import { BaseEdge, Position, getSmoothStepPath, type EdgeProps } from '@vue-flow/core'

const props = defineProps<EdgeProps>()

// Suicide kills connect a node's own Bottom (source) handle to its own Top
// (target) handle — the default smoothstep routing degenerates to a
// straight line through the node itself when source and target coincide.
// Routing the path's center out to one side (mirrors @vue-flow's own
// loopback example) makes it read as a visible loop instead.
const path = computed(() => {
  const isVerticalLoop = (props.sourcePosition === Position.Bottom && props.targetPosition === Position.Top)
    || (props.sourcePosition === Position.Top && props.targetPosition === Position.Bottom)

  if (!isVerticalLoop) {
    return getSmoothStepPath(props)
  }

  const width = props.sourceNode.dimensions.width
  return getSmoothStepPath({
    ...props,
    centerX: props.sourceX - 40 - width / 2,
    centerY: (props.sourceY + props.targetY) / 2,
  })
})
</script>

<template>
  <BaseEdge :id="id" :path="path[0]" :marker-end="markerEnd" :style="style" />
</template>
