import { ICONS } from './icons'

export const ACTION_MAP = {
  remove: { color: 'error',   icon: ICONS.delete, labelKey: 'common.remove' },
  edit:   { color: 'neutral', icon: ICONS.edit,   labelKey: 'common.edit'   },
  view:   { color: 'neutral', icon: ICONS.show,   labelKey: 'common.view'   },
} as const satisfies Record<string, { color: string; icon: string; labelKey: string }>

export type ActionType = keyof typeof ACTION_MAP
