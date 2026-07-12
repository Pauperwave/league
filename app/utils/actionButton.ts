import { ICONS } from './icons'

export const ACTION_MAP = {
  remove: { color: 'error',   icon: ICONS.delete, label: 'Rimuovi'   },
  edit:   { color: 'neutral', icon: ICONS.edit,   label: 'Modifica'  },
  view:   { color: 'neutral', icon: ICONS.show,   label: 'Visualizza'},
} as const satisfies Record<string, { color: string; icon: string; label: string }>

export type ActionType = keyof typeof ACTION_MAP
