import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'

interface BreadcrumbSegment {
  label: string
  to?: string
}

/** Prepends the shared home crumb to a page's own trailing breadcrumb segments. */
export function useBreadcrumb(segments: () => BreadcrumbSegment[]) {
  const { t } = useI18n()

  return computed(() => [
    { label: t('common.home'), to: '/', icon: ICONS.home },
    ...segments()
  ])
}
