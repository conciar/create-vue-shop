import { onMounted, onBeforeUnmount, watch, nextTick, type Ref } from 'vue'

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Dialog accessibility: Escape-to-close, a Tab focus trap, initial focus into
 * the dialog, and focus restore to the trigger on close. Pair with
 * role="dialog" aria-modal="true" and an aria-label / aria-labelledby.
 *
 * `active` is optional:
 *  - omit it for modals that are themselves mounted only while open (v-if on the
 *    component) — lifecycle is tied to mount/unmount.
 *  - pass an open-state ref for modals living inside an always-mounted component
 *    (e.g. a drawer toggled by v-if) — lifecycle follows that ref.
 */
export function useModalA11y(container: Ref<HTMLElement | null>, onClose: () => void, active?: Ref<unknown>) {
  let previouslyFocused: HTMLElement | null = null

  function focusable(): HTMLElement[] {
    if (!container.value) return []
    return Array.from(container.value.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement)
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key !== 'Tab') return
    const els = focusable()
    if (!els.length) return
    const first = els[0], last = els[els.length - 1]
    const el = document.activeElement as HTMLElement
    if (e.shiftKey && (el === first || !container.value?.contains(el))) {
      e.preventDefault(); last.focus()
    } else if (!e.shiftKey && el === last) {
      e.preventDefault(); first.focus()
    }
  }

  function activate() {
    previouslyFocused = document.activeElement as HTMLElement | null
    nextTick(() => (focusable()[0] ?? container.value)?.focus())
    document.addEventListener('keydown', onKeydown, true)
  }

  function deactivate() {
    document.removeEventListener('keydown', onKeydown, true)
    previouslyFocused?.focus?.()
  }

  if (active) {
    watch(active, (v) => (v ? activate() : deactivate()))
    onBeforeUnmount(deactivate)
  } else {
    onMounted(activate)
    onBeforeUnmount(deactivate)
  }
}
