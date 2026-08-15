import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mountWithPlugins } from '@/test-support/mount'
import SubscriptionCard from './SubscriptionCard.vue'
import { useCartStore } from '@/stores/cart'
import type { SubscriptionBox } from '@/types'

const box = (over: Partial<SubscriptionBox> = {}): SubscriptionBox => ({
  id: 's1',
  isSubscription: true,
  name: 'Starter plan',
  tagline: 'Everything you need',
  description: 'A monthly plan.',
  price: 59,
  frequency: 'monthly',
  image: 'https://example.com/img.jpg',
  highlights: ['3 items/month', 'Free delivery'],
  ...over,
})

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('SubscriptionCard', () => {
  it('renders name, tagline, description and highlights', () => {
    const wrapper = mountWithPlugins(SubscriptionCard, { props: { box: box() } })
    expect(wrapper.text()).toContain('Starter plan')
    expect(wrapper.text()).toContain('Everything you need')
    expect(wrapper.text()).toContain('3 items/month')
  })

  it('shows a "Most popular" badge only when popular', () => {
    const popular = mountWithPlugins(SubscriptionCard, { props: { box: box({ popular: true }) } })
    expect(popular.text()).toContain('Most popular')

    const notPopular = mountWithPlugins(SubscriptionCard, { props: { box: box({ popular: false }) } })
    expect(notPopular.text()).not.toContain('Most popular')
  })

  it('formats price and shows a struck-through original price when present', () => {
    const wrapper = mountWithPlugins(SubscriptionCard, { props: { box: box({ price: 59, originalPrice: 79 }) } })
    expect(wrapper.text()).toContain('€59.00')
    expect(wrapper.text()).toContain('€79.00')
  })

  it('labels the CTA "Subscribe" for subscriptions and "Add to cart" otherwise', () => {
    const sub = mountWithPlugins(SubscriptionCard, { props: { box: box({ isSubscription: true }) } })
    expect(sub.get('button').text()).toBe('Subscribe')

    const oneTime = mountWithPlugins(SubscriptionCard, { props: { box: box({ isSubscription: false }) } })
    expect(oneTime.get('button').text()).toBe('Add to cart')
  })

  it('adds the box to the cart with the correct purchase type on click', async () => {
    const wrapper = mountWithPlugins(SubscriptionCard, { props: { box: box({ isSubscription: true }) } })
    const cart = useCartStore()
    await wrapper.get('button').trigger('click')
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].type).toBe('subscription')
  })

  it('shows "per month" vs "per quarter" based on frequency', () => {
    const monthly = mountWithPlugins(SubscriptionCard, { props: { box: box({ frequency: 'monthly' }) } })
    expect(monthly.text()).toContain('per month')

    const quarterly = mountWithPlugins(SubscriptionCard, { props: { box: box({ frequency: 'quarterly' }) } })
    expect(quarterly.text()).toContain('per quarter')
  })
})
