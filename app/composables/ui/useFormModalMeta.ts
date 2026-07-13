import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'

interface UseFormModalMetaOptions {
  isEditing: Ref<boolean> | ComputedRef<boolean>
  namespace: string
  createIcon: string
  cancelLoggingLabel: string
  open: Ref<boolean>
}

/**
 * Shared create/edit modal chrome: title/description/icon/submitLabel driven by
 * `isEditing`, plus the cancel handler. Every namespace must define the four
 * `<namespace>.form.{createTitle,editTitle,createDescription,editDescription}`
 * and `<namespace>.form.submitCreate` i18n keys (see i18n/locales/it.json).
 */
export function useFormModalMeta({ isEditing, namespace, createIcon, cancelLoggingLabel, open }: UseFormModalMetaOptions) {
  const { t } = useI18n()

  const title = computed(() => isEditing.value ? t(`${namespace}.form.editTitle`) : t(`${namespace}.form.createTitle`))
  const description = computed(() => isEditing.value ? t(`${namespace}.form.editDescription`) : t(`${namespace}.form.createDescription`))
  const icon = computed(() => isEditing.value ? ICONS.edit : createIcon)
  const submitLabel = computed(() => isEditing.value ? t('common.save') : t(`${namespace}.form.submitCreate`))

  const cancelLogging = useButtonLogging(cancelLoggingLabel)
  function handleCancel() {
    cancelLogging.logClick()
    open.value = false
  }

  return { title, description, icon, submitLabel, handleCancel }
}
