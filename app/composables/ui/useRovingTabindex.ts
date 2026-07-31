// app\composables\ui\useRovingTabindex.ts
// Roving-tabindex arrow-key navigation for a group of focusable items (e.g. a
// grid of cards acting like a radiogroup) — Tab enters/exits the group as one
// stop, ArrowRight/Down and ArrowLeft/Up (plus Home/End) move focus within
// it. Deliberately treats the group as a flat, wrapping 1D sequence rather
// than a true 2D grid — the grid's column count is responsive (2 vs 3 cols),
// so "move up/down a row" can't be computed reliably without measuring the
// live layout; Right/Down and Left/Up both just mean next/prev instead.

interface FocusableItem {
  focus: () => void
}

export type RovingNavigateDirection = 'next' | 'prev' | 'first' | 'last'

export function useRovingTabindex(itemCount: MaybeRefOrGetter<number>) {
  const activeIndex = ref(0)
  const itemRefs = ref<(FocusableItem | null)[]>([])

  function setItemRef(index: number, el: FocusableItem | null) {
    itemRefs.value[index] = el
  }

  function tabindexFor(index: number): number {
    return index === activeIndex.value ? 0 : -1
  }

  function focusIndex(index: number) {
    activeIndex.value = index
    // Synchronous, not nextTick: grid items are already mounted (only their
    // tabindex attribute reacts to activeIndex), and .focus() works
    // regardless of an element's current tabindex value. Deferring this
    // stacked an extra tick on top of any caller-side nextTick (e.g. modal
    // open autofocus), creating a window where a fast real Tab keypress won
    // the race and skipped past the intended first focus target.
    itemRefs.value[index]?.focus()
  }

  function onNavigate(currentIndex: number, direction: RovingNavigateDirection) {
    const count = toValue(itemCount)
    if (count === 0) return

    const next = {
      next: (currentIndex + 1) % count,
      prev: (currentIndex - 1 + count) % count,
      first: 0,
      last: count - 1,
    }[direction]

    focusIndex(next)
  }

  return { activeIndex, setItemRef, tabindexFor, onNavigate, focusIndex }
}
