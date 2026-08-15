import { describe, it, expect } from 'vitest'
import { mountWithPlugins } from '@/test-support/mount'
import AppFooter from './AppFooter.vue'
import { SHOP_NAME } from '@/config'

describe('AppFooter', () => {
  it('renders the shop name and footer links', () => {
    const wrapper = mountWithPlugins(AppFooter)
    expect(wrapper.text()).toContain(SHOP_NAME)
    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['/products', '/subscriptions', '/account/orders']))
  })

  it('renders the current year in the copyright line', () => {
    const wrapper = mountWithPlugins(AppFooter)
    expect(wrapper.text()).toContain(String(new Date().getFullYear()))
  })
})
