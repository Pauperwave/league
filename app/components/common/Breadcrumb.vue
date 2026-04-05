<!--
  Breadcrumb.vue

  Componente breadcrumb modulare per navigazione gerarchica.
  Props:
    - items: Array di { label: string, to?: string, icon?: string }
      - label: Testo visualizzato
      - to: Route per link (opzionale, se mancante è item corrente)
      - icon: Icona opzionale (es. 'i-lucide-home')
-->
<script setup lang="ts">
interface BreadcrumbItem {
  label: string
  to?: string
  icon?: string
}

defineProps<{
  items: BreadcrumbItem[]
}>()
</script>

<template>
  <nav aria-label="Breadcrumb" class="text-sm text-muted">
    <ol class="flex items-center gap-2">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="flex items-center gap-2"
      >
        <UIcon
          v-if="index > 0"
          name="i-lucide-chevron-right"
          class="size-4 text-muted"
        />
        <NuxtLink
          v-if="item.to"
          :to="item.to"
          class="flex items-center gap-1 hover:text-primary transition-colors"
        >
          <UIcon
            v-if="item.icon"
            :name="item.icon"
            class="size-4"
          />
          <span>{{ item.label }}</span>
        </NuxtLink>
        <span
          v-else
          class="flex items-center gap-1 text-default font-medium"
          aria-current="page"
        >
          <UIcon
            v-if="item.icon"
            :name="item.icon"
            class="size-4"
          />
          {{ item.label }}
        </span>
      </li>
    </ol>
  </nav>
</template>
