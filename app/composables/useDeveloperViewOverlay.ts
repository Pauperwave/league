// app\composables\useDeveloperViewOverlay.ts

const MISSING_LABEL_CLASS = 'developer-view-missing-label'
const INTERACTIVE_SELECTOR = 'button, a[href], [role="button"], summary'

function hasAccessibleName(el: Element): boolean {
  if (
    el.hasAttribute('aria-label')
    || el.hasAttribute('aria-labelledby')
    || el.hasAttribute('title')
    || (el.textContent?.trim().length ?? 0) > 0
  ) {
    return true
  }
  // A link/button whose only content is an <img alt="..."> (e.g. the header
  // logo) gets its accessible name from that alt text, not from textContent
  // (alt is an attribute, not a text node) — without this check every
  // image-only link/button would be a false positive here.
  const img = el.querySelector('img[alt]')
  return !!img?.getAttribute('alt')?.trim()
}

function markMissingAccessibleNames() {
  document.querySelectorAll(INTERACTIVE_SELECTOR).forEach((el) => {
    el.classList.toggle(MISSING_LABEL_CLASS, !hasAccessibleName(el))
  })
}

function clearMissingAccessibleNames() {
  document.querySelectorAll(`.${MISSING_LABEL_CLASS}`).forEach((el) => el.classList.remove(MISSING_LABEL_CLASS))
}

/**
 * Applies the developer-view debug overlay to the DOM: toggles the CSS hook
 * class on <html> (see main.css) and, while enabled, scans for interactive
 * elements with no accessible name (no aria-label/aria-labelledby/title/
 * visible text) so they get flagged the same way missing `alt` is flagged
 * on images. CSS alone can't select on "has a text node child", so this
 * class is set imperatively via a MutationObserver instead of a plain
 * attribute selector — the DOM is re-scanned (rAF-debounced) whenever it
 * changes, since most of this app's content is client-rendered after mount.
 *
 * Call once from app.vue — not from every component that reads
 * useDeveloperView(), or multiple observers would stack up.
 */
export function useDeveloperViewOverlay() {
  const { isDeveloperView } = useDeveloperView()
  let observer: MutationObserver | null = null
  let scheduled = false

  function scheduleMark() {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      markMissingAccessibleNames()
    })
  }

  onMounted(() => {
    watch(isDeveloperView, (enabled) => {
      document.documentElement.classList.toggle('developer-view-active', enabled)
      if (enabled) {
        markMissingAccessibleNames()
        // childList/subtree only — NOT attributes: toggling our own marker
        // class is itself an attribute mutation, so watching attributes
        // here would retrigger the observer on every scan, looping forever.
        observer = new MutationObserver(scheduleMark)
        observer.observe(document.body, { childList: true, subtree: true })
      } else {
        observer?.disconnect()
        observer = null
        clearMissingAccessibleNames()
      }
    }, { immediate: true })
  })

  onUnmounted(() => observer?.disconnect())
}
