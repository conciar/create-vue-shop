import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import type { Component } from 'vue'
import { i18n } from '@/i18n'

// Stub RouterLink as a plain anchor so component tests don't need a real
// router instance; the `to` prop is rendered as href for assertions.
const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>',
}

// Mirrors main.ts's `v-click-outside` directive registration so components
// using it behave the same under test as in the real app.
const clickOutsideDirective = {
  mounted(el: HTMLElement & { _clickOutside?: (e: Event) => void }, binding: { value: (e: Event) => void }) {
    el._clickOutside = (e: Event) => {
      if (!el.contains(e.target as Node)) binding.value(e)
    }
    document.addEventListener('pointerdown', el._clickOutside)
  },
  unmounted(el: HTMLElement & { _clickOutside?: (e: Event) => void }) {
    if (el._clickOutside) document.removeEventListener('pointerdown', el._clickOutside)
  },
}

// Shared mount helper: wires up i18n (real messages, so `t()` renders actual
// copy), a RouterLink stub, and the click-outside directive. Requires an
// active Pinia to already be set via setActivePinia(createPinia()) in the
// test's beforeEach, same as store specs.
export function mountWithPlugins<T extends Component>(component: T, options: ComponentMountingOptions<T> = {}) {
  // Force English so component specs can assert on real (predictable) copy,
  // regardless of whatever 'locale' happens to be in localStorage.
  i18n.global.locale.value = 'en'
  const { global: g, ...rest } = options
  return mount(component, {
    ...rest,
    global: {
      ...g,
      plugins: [i18n, ...(g?.plugins ?? [])],
      directives: { 'click-outside': clickOutsideDirective, ...g?.directives },
      stubs: { RouterLink: RouterLinkStub, ...g?.stubs },
    },
  })
}
