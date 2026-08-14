import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useModalA11y } from './useModalA11y'

// jsdom never computes layout, so offsetWidth/offsetHeight are always 0 —
// stub them so the composable's "is this element visible" filter passes.
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 100 })
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 40 })

// A minimal dialog with two focusable buttons, wired through useModalA11y.
function makeDialog(onClose: () => void, active?: ReturnType<typeof ref>) {
  return defineComponent({
    setup() {
      const container = ref<HTMLElement | null>(null)
      useModalA11y(container, onClose, active as never)
      return () =>
        h('div', { ref: container }, [
          h('button', { id: 'first' }, 'First'),
          h('button', { id: 'last' }, 'Last'),
        ])
    },
  })
}

function keydown(key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
  document.dispatchEvent(event)
  return event
}

describe('useModalA11y — mount-tied lifecycle (no `active` ref)', () => {
  it('focuses the first focusable element on mount', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const wrapper = mount(makeDialog(() => {}), { attachTo: document.body })
    await nextTick()
    await nextTick()

    expect(document.activeElement?.id).toBe('first')
    wrapper.unmount()
    trigger.remove()
  })

  it('Escape calls onClose', async () => {
    const onClose = vi.fn()
    const wrapper = mount(makeDialog(onClose), { attachTo: document.body })
    await nextTick()

    keydown('Escape')
    expect(onClose).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('Tab from the last element wraps to the first', async () => {
    const wrapper = mount(makeDialog(() => {}), { attachTo: document.body })
    await nextTick()
    await nextTick()

    const last = wrapper.get('#last').element as HTMLElement
    last.focus()
    const event = keydown('Tab')
    expect(document.activeElement?.id).toBe('first')
    expect(event.defaultPrevented).toBe(true)
    wrapper.unmount()
  })

  it('Shift+Tab from the first element wraps to the last', async () => {
    const wrapper = mount(makeDialog(() => {}), { attachTo: document.body })
    await nextTick()
    await nextTick()

    const first = wrapper.get('#first').element as HTMLElement
    first.focus()
    keydown('Tab', true)
    expect(document.activeElement?.id).toBe('last')
    wrapper.unmount()
  })

  it('other keys are ignored', async () => {
    const onClose = vi.fn()
    const wrapper = mount(makeDialog(onClose), { attachTo: document.body })
    await nextTick()

    const event = keydown('a')
    expect(onClose).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    wrapper.unmount()
  })

  it('restores focus to the previously-focused trigger on unmount', async () => {
    const trigger = document.createElement('button')
    trigger.id = 'trigger'
    document.body.appendChild(trigger)
    trigger.focus()

    const wrapper = mount(makeDialog(() => {}), { attachTo: document.body })
    await nextTick()
    await nextTick()
    expect(document.activeElement?.id).toBe('first')

    wrapper.unmount()
    expect(document.activeElement?.id).toBe('trigger')
    trigger.remove()
  })

  it('removing the keydown listener on unmount stops Escape from firing onClose', async () => {
    const onClose = vi.fn()
    const wrapper = mount(makeDialog(onClose), { attachTo: document.body })
    await nextTick()
    wrapper.unmount()

    keydown('Escape')
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('useModalA11y — externally driven `active` ref', () => {
  it('activates when the ref flips true and deactivates when it flips false', async () => {
    const onClose = vi.fn()
    const active = ref(false)
    const wrapper = mount(makeDialog(onClose, active), { attachTo: document.body })
    await nextTick()

    // Not yet active — Escape should do nothing.
    keydown('Escape')
    expect(onClose).not.toHaveBeenCalled()

    active.value = true
    await nextTick()
    await nextTick()
    expect(document.activeElement?.id).toBe('first')

    keydown('Escape')
    expect(onClose).toHaveBeenCalledTimes(1)

    active.value = false
    await nextTick()
    keydown('Escape')
    expect(onClose).toHaveBeenCalledTimes(1) // no additional call once deactivated

    wrapper.unmount()
  })
})
