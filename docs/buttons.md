È migliore di tre componenti separati, ma ha ancora dei punti deboli.

Cosa funziona bene:

    L'ACTION_MAP è un pattern pulito — tutta la "verità" su icone/colori è in un posto solo
    Aggiungere una nuova azione è triviale
    L'override di ariaLabel con fallback a label è sensato

Cosa è discutibile:

Il componente è giustificato solo se l'ACTION_MAP è davvero il valore che porta — cioè se vuoi garantire che "rimuovi" sia sempre rosso con l'icona cestino in tutto il progetto. Se invece lo usi in 2-3 posti, stai aggiungendo un livello di indirezione senza guadagno reale.

Il problema principale è che ACTION_MAP è intrappolato dentro il componente. Se hai bisogno di leggere il colore o l'icona di un'azione altrove (es. in un tooltip, in una colonna di tabella, in un menu contestuale), non puoi riusarla. Meglio estrarla:

// utils/actionButton.ts  (o constants/)
export const ACTION_MAP = {
  remove: { color: 'error',   icon: 'i-lucide-trash-2', label: 'Rimuovi'    },
  edit:   { color: 'neutral', icon: 'i-lucide-pencil',  label: 'Modifica'   },
  view:   { color: 'neutral', icon: 'i-lucide-eye',     label: 'Visualizza' },
} as const satisfies Record<string, { color: string; icon: string; label: string }>

export type ActionType = keyof typeof ACTION_MAP

<!-- components/ActionButton.vue -->
<script setup lang="ts">
import { ACTION_MAP, type ActionType } from '~/utils/actionButton'

const { action, ariaLabel, ...rest } = defineProps<{
  action: ActionType
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'solid' | 'outline' | 'ghost' | 'link' | 'soft' | 'subtle'
  disabled?: boolean
  loading?: boolean
  ariaLabel?: string
}>()

const { color, icon, label } = ACTION_MAP[action]
</script>

<template>
  <UButton
    v-bind="rest"
    :color
    :icon
    :aria-label="ariaLabel ?? label"
  />
</template>

Nota v-bind="rest" che elimina la lista manuale di :size :variant :disabled :loading — se aggiungi un prop domani, non devi ricordarti di passarlo anche al template.

In sintesi: è un componente ragionevole se usato in molti punti dell'app e se il tuo team vuole vincolare lo stile delle azioni CRUD. Se lo usi poco, <UButton color="error" icon="i-lucide-trash-2" /> direttamente è più leggibile.

vorrei usare dappertutto lo stesso stile grafico e la stessa icona / colori

Allora il componente ha senso. Con le modifiche suggerite (ACTION_MAP esportata + v-bind="rest") è già una buona soluzione.

Un'unica cosa da aggiungere: i default di size e variant appartengono al tema globale, non al componente. Così puoi cambiarli in un posto solo per tutto il progetto:

// app.config.ts
export default defineAppConfig({
  ui: {
    button: {
      defaultVariants: {
        size: 'xs',
        variant: 'outline',
      }
    }
  }
})

E il componente finale diventa semplicissimo:

// utils/actionButton.ts
export const ACTION_MAP = {
  remove: { color: 'error',   icon: 'i-lucide-trash-2', label: 'Rimuovi'   },
  edit:   { color: 'neutral', icon: 'i-lucide-pencil',  label: 'Modifica'  },
  view:   { color: 'neutral', icon: 'i-lucide-eye',     label: 'Visualizza'},
} as const satisfies Record<string, { color: string; icon: string; label: string }>

export type ActionType = keyof typeof ACTION_MAP

<!-- components/ActionButton.vue -->
<script setup lang="ts">
import { ACTION_MAP, type ActionType } from '~/utils/actionButton'

const { action, ariaLabel, ...rest } = defineProps<{
  action: ActionType
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'solid' | 'outline' | 'ghost' | 'link' | 'soft' | 'subtle'
  disabled?: boolean
  loading?: boolean
  ariaLabel?: string
}>()

const { color, icon, label } = ACTION_MAP[action]
</script>

<template>
  <UButton
    v-bind="rest"
    :color
    :icon
    :aria-label="ariaLabel ?? label"
  />
</template>

<!-- utilizzo -->
<ActionButton action="remove" @click="handleRemove" />
<ActionButton action="edit"   @click="handleEdit" />
<ActionButton action="view"   @click="handleView" />

Se un giorno vuoi cambiare l'icona di "rimuovi" o lo stile globale dei bottoni, modifichi un solo file.
