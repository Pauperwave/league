// app\utils\paymentMethod.ts
import type { PaymentMethod } from '#shared/utils/types'
import type { IconName } from '~/utils/icons'
import type { SemanticColor } from '~/utils/semanticColor'

interface PaymentMethodDisplay {
  icon: IconName
  /** 'neutral' isn't one of the 6 app.config.ts semantic tokens, but is a valid Nuxt UI badge/icon color — used for the 'free' method, which has no dedicated semantic meaning. */
  color: SemanticColor | 'neutral'
  /** Static Tailwind class (not built via string interpolation — the JIT scanner can't see interpolated color names). */
  textClass: string
  labelKey: string
}

/** Icon/color/i18n-key for each `PaymentMethod` value — single source shared by StandingsCard, TournamentRegistrationTable, and the league payments page. Module-scope const, can't call `useI18n()`: resolve `t(labelKey)` at the consuming component's own `setup()`. */
export const PAYMENT_METHOD_DISPLAY: Record<PaymentMethod, PaymentMethodDisplay> = {
  pos: { icon: ICONS.paymentPos, color: 'info', textClass: 'text-info', labelKey: 'tournament.waitingListTable.posLabel' },
  cash: { icon: ICONS.paymentCash, color: 'success', textClass: 'text-success', labelKey: 'tournament.waitingListTable.cashLabel' },
  free: { icon: ICONS.paymentFree, color: 'neutral', textClass: 'text-muted', labelKey: 'tournament.waitingListTable.freeLabel' },
}
