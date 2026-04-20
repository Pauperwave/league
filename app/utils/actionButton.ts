export const ACTION_MAP = {
  remove: { color: 'error',   icon: 'i-lucide-trash-2', label: 'Rimuovi'   },
  edit:   { color: 'neutral', icon: 'i-lucide-pencil',  label: 'Modifica'  },
  view:   { color: 'neutral', icon: 'i-lucide-eye',     label: 'Visualizza'},
} as const satisfies Record<string, { color: string; icon: string; label: string }>

export type ActionType = keyof typeof ACTION_MAP
