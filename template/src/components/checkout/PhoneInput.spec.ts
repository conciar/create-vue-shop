import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mountWithPlugins } from '@/test-support/mount'
import PhoneInput from './PhoneInput.vue'
import { conciarApi } from '@/api/conciar'
import type { ConciarCountry } from '@/api/conciar-types'

const nl: ConciarCountry = { id: 1, name: 'netherlands', iso_code_2: 'NL', call_prefix: 31, phone_format: '06 12345678', phone_digits: 9 } as never
const de: ConciarCountry = { id: 2, name: 'germany', iso_code_2: 'DE', call_prefix: 49, phone_format: '0151 12345678', phone_digits: 10 } as never

beforeEach(() => {
  setActivePinia(createPinia())
  vi.restoreAllMocks()
  vi.spyOn(conciarApi.countries, 'list').mockResolvedValue([nl, de])
})

async function mountReady(props: Record<string, unknown> = {}) {
  const wrapper = mountWithPlugins(PhoneInput, { props })
  await vi.waitFor(() => expect(wrapper.find('input[type="tel"]').attributes('placeholder')).toBeTruthy())
  return wrapper
}

describe('PhoneInput — defaults', () => {
  it('defaults to the Netherlands once countries load', async () => {
    const wrapper = await mountReady()
    expect(wrapper.text()).toContain('+31')
  })

  it('falls back to the first country when NL is not in the list', async () => {
    vi.spyOn(conciarApi.countries, 'list').mockResolvedValue([de])
    const wrapper = await mountReady()
    expect(wrapper.text()).toContain('+49')
  })
})

describe('PhoneInput — typing', () => {
  it('strips non-digit characters and emits the full number (no trunk-0 stripping)', async () => {
    const wrapper = await mountReady()
    await wrapper.get('input[type="tel"]').setValue('06-1234 5678')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['+310612345678'])
  })

  it('emits an empty string once all digits are cleared', async () => {
    const wrapper = await mountReady()
    await wrapper.get('input[type="tel"]').setValue('0612345678')
    await wrapper.get('input[type="tel"]').setValue('')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([''])
  })
})

describe('PhoneInput — country dropdown', () => {
  it('opens on trigger click and lists countries', async () => {
    const wrapper = await mountReady()
    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toContain('Germany')
  })

  it('filters countries by name and by dial code', async () => {
    const wrapper = await mountReady()
    await wrapper.get('button').trigger('click')
    await wrapper.get('input[placeholder="Search country…"]').setValue('ger')
    expect(wrapper.text()).toContain('Germany')
    expect(wrapper.text()).not.toContain('Netherlands')

    await wrapper.get('input[placeholder="Search country…"]').setValue('49')
    expect(wrapper.text()).toContain('Germany')
  })

  it('shows a "no countries found" message when the filter matches nothing', async () => {
    const wrapper = await mountReady()
    await wrapper.get('button').trigger('click')
    await wrapper.get('input[placeholder="Search country…"]').setValue('zzz')
    expect(wrapper.text()).toContain('No countries found')
  })

  it('selects a country, updates the dial code and emits based on any existing digits', async () => {
    const wrapper = await mountReady()
    await wrapper.get('input[type="tel"]').setValue('12345678')
    await wrapper.get('button').trigger('click')
    await wrapper.findAll('.max-h-52 button').find(b => b.text().includes('Germany'))!.trigger('click')

    expect(wrapper.text()).toContain('+49')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['+4912345678'])
  })

  it('closes the dropdown on an outside click', async () => {
    const wrapper = await mountReady()
    document.body.appendChild(wrapper.element)
    await wrapper.get('button').trigger('click')
    expect(wrapper.find('input[placeholder="Search country…"]').exists()).toBe(true)

    document.body.dispatchEvent(new Event('mousedown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('input[placeholder="Search country…"]').exists()).toBe(false)
    wrapper.element.remove()
  })

  it('disables the trigger and input when disabled prop is set', async () => {
    const wrapper = await mountReady({ disabled: true })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('input[type="tel"]').attributes('disabled')).toBeDefined()
  })
})

describe('PhoneInput — external sync', () => {
  it('ignores a pre-filled modelValue at mount time, since countries load asynchronously (immediate watch runs before fetch resolves)', async () => {
    const wrapper = mountWithPlugins(PhoneInput, { props: { modelValue: '+4915112345' } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('+31')) // still defaults to NL
    expect((wrapper.get('input[type="tel"]').element as HTMLInputElement).value).toBe('')
  })

  it('parses modelValue into country + local digits once it changes after countries have loaded', async () => {
    const wrapper = await mountReady()
    await wrapper.setProps({ modelValue: '+4915112345' })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('+49')
    expect((wrapper.get('input[type="tel"]').element as HTMLInputElement).value).toBe('15112345')
  })

  it('follows an external countryId change while the phone number is still empty', async () => {
    const wrapper = await mountReady({ countryId: 1 })
    await wrapper.setProps({ countryId: 2 })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('+49')
  })

  it('ignores an external countryId change once the user has typed a number', async () => {
    const wrapper = await mountReady({ countryId: 1 })
    await wrapper.get('input[type="tel"]').setValue('612345678')
    await wrapper.setProps({ countryId: 2 })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('+31')
  })
})
