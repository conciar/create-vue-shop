import { describe, it, expect } from 'vitest'
import { mountWithPlugins } from '@/test-support/mount'
import PromoBadge from './PromoBadge.vue'
import type { ConciarPriceRule } from '@/api/conciar-types'

// ConciarPriceRuleInfo requires description + language_id; these tests only
// care about the name, so fill the rest in one place.
const info = (name: string, description: string | null = null) => ({ name, description, language_id: 1 })

const rule = (over: Partial<ConciarPriceRule> = {}): ConciarPriceRule => ({
  type: { name: 'percentage' },
  scope_type: 'store',
  percentage: 10,
  ...over,
})

describe('PromoBadge', () => {
  it('renders nothing when there are no rules', () => {
    const wrapper = mountWithPlugins(PromoBadge, { props: { rules: null } })
    expect(wrapper.find('span').exists()).toBe(false)
  })

  it('renders nothing when no rule is currently active', () => {
    const wrapper = mountWithPlugins(PromoBadge, {
      props: { rules: [rule({ end_date: '2000-01-01' })] },
    })
    expect(wrapper.find('span').exists()).toBe(false)
  })

  it('renders a badge using the merchant-localized name when present', () => {
    const wrapper = mountWithPlugins(PromoBadge, {
      props: { rules: [rule({ defaultInfo: info('Summer sale') })] },
    })
    expect(wrapper.text()).toContain('Summer sale')
  })

  it('caps the number of badges shown via `max`', () => {
    const wrapper = mountWithPlugins(PromoBadge, {
      props: {
        rules: [
          rule({ defaultInfo: info('A') }),
          rule({ defaultInfo: info('B') }),
        ],
        max: 1,
      },
    })
    const badges = wrapper.findAll('span[title]')
    expect(badges).toHaveLength(1)
    expect(wrapper.text()).toContain('A')
    expect(wrapper.text()).not.toContain('B')
  })

  it('shows a scope suffix only when showScope is true', () => {
    const props = { rules: [rule({ defaultInfo: info('Deal'), scope_type: 'store' as const })] }
    const withoutScope = mountWithPlugins(PromoBadge, { props })
    expect(withoutScope.text()).not.toContain('·')

    const withScope = mountWithPlugins(PromoBadge, { props: { ...props, showScope: true } })
    expect(withScope.text()).toContain('·')
  })

  it('uses the rule description as the title, falling back to the auto-applied copy', () => {
    const withDescription = mountWithPlugins(PromoBadge, {
      props: { rules: [rule({ defaultInfo: info('Deal', 'Ends soon') })] },
    })
    expect(withDescription.find('span[title]').attributes('title')).toBe('Ends soon')

    const withoutDescription = mountWithPlugins(PromoBadge, {
      props: { rules: [rule({ defaultInfo: info('Deal') })] },
    })
    expect(withoutDescription.find('span[title]').attributes('title')).toBeTruthy()
  })

  it('returns null (no badge) for rule types that do not badge, e.g. fixed', () => {
    const wrapper = mountWithPlugins(PromoBadge, {
      props: { rules: [rule({ type: { name: 'fixed' } })] },
    })
    expect(wrapper.find('span').exists()).toBe(false)
  })
})
