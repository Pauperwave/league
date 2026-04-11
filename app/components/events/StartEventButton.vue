<!-- app/components/Events/StartEventButton.vue -->

<!--
  StartEventButton

  A full-width primary button used to start an event.
  Displays a play icon with the label "Avvia Evento".

  Props:
  - disabled: Prevents the button from being clicked (e.g. when event requirements are not met)
  - loading:  Shows a loading spinner (e.g. while the start request is in progress)

  Events:
  - No custom emits defined. Native DOM events (e.g. @click) fall through automatically
    to the root <UButton> element via Vue's fallthrough attributes.

  Usage:
  <EventsStartEventButton
    :disabled="!canStartEvent"
    :loading="isStarting"
    @click="handleStart"
  />
-->

<script setup lang="ts">
defineProps<{
  /** Prevents the button from being clicked. Use when event requirements are not met */
  disabled?: boolean
  /** Shows a loading spinner. Use while the start request is in progress */
  loading?: boolean
}>()
</script>

<template>
  <UButton
    color="primary"
    size="lg"
    block
    :disabled
    :loading
    icon="i-lucide-play"
  >
    Avvia Evento
  </UButton>
</template>
