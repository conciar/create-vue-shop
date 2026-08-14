import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mountWithPlugins } from '@/test-support/mount'
import ProductsView from './ProductsView.vue'
import { conciarApi } from '@/api/conciar'
import type { ConciarConnectProductsData, ConciarFilter } from '@/api/conciar-types'

let ioCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null

class FakeIntersectionObserver {
  constructor(cb: (entries: { isIntersecting: boolean }[]) => void) { ioCallback = cb }
  observe() {}
  disconnect() {}
}

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/products', component: ProductsView }],
  })
}

const page = (over: Partial<ConciarConnectProductsData> = {}): ConciarConnectProductsData => ({
  data: [],
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: 0,
  ...over,
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.restoreAllMocks()
  vi.useFakeTimers()
  ioCallback = null
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function mountAt(path = '/products') {
  const router = testRouter()
  await router.push(path)
  const wrapper = mountWithPlugins(ProductsView, { global: { plugins: [router] } })
  await wrapper.vm.$nextTick()
  return { wrapper, router }
}

describe('ProductsView — initial load', () => {
  it('shows a loading skeleton, then the product grid', async () => {
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue([])
    let resolveList!: (v: ConciarConnectProductsData) => void
    vi.spyOn(conciarApi.connect.products, 'list').mockReturnValue(new Promise(r => (resolveList = r)))

    const { wrapper } = await mountAt()
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)

    resolveList(page({ data: [{ id: 1, resolved_info: { name: 'Wine A' }, files: [] }] as never, total: 1 }))
    await vi.waitFor(() => expect(wrapper.text()).toContain('Wine A'))
  })

  it('shows the empty state with a "clear filters" action', async () => {
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue([])
    vi.spyOn(conciarApi.connect.products, 'list').mockResolvedValue(page())
    const { wrapper, router } = await mountAt('/products?q=nothing')
    await vi.waitFor(() => expect(wrapper.text()).toContain('No products match'))

    await wrapper.findAll('button').find(b => b.text().includes('Clear all filters'))!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.q).toBeUndefined())
  })

  it('builds fetch params from the initial URL query', async () => {
    const list = vi.spyOn(conciarApi.connect.products, 'list').mockResolvedValue(page())
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue([])
    await mountAt('/products?q=red&page=2&price_min=10&price_max=50&property[color]=red')
    expect(list).toHaveBeenCalledWith(expect.objectContaining({
      q: 'red', page: 2, price_min: 10, price_max: 50, properties: { color: ['red'] },
    }))
  })
})

describe('ProductsView — search', () => {
  it('debounces search input and updates the URL query', async () => {
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue([])
    vi.spyOn(conciarApi.connect.products, 'list').mockResolvedValue(page())
    const { wrapper, router } = await mountAt()

    await wrapper.get('input[type="search"]').setValue('merlot')
    await vi.advanceTimersByTimeAsync(400)
    expect(router.currentRoute.value.query.q).toBe('merlot')
  })

  it('syncs the search box when the URL query changes externally (back/forward)', async () => {
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue([])
    vi.spyOn(conciarApi.connect.products, 'list').mockResolvedValue(page())
    const { wrapper, router } = await mountAt()
    await router.push('/products?q=syrah')
    await wrapper.vm.$nextTick()
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('syrah')
  })
})

describe('ProductsView — price filter', () => {
  it('applies a price range and shows it as a removable chip', async () => {
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue([])
    vi.spyOn(conciarApi.connect.products, 'list').mockResolvedValue(page())
    const { wrapper, router } = await mountAt()

    const [min, max] = wrapper.findAll('input[type="number"]')
    await min.setValue('10')
    await max.setValue('50')
    await wrapper.findAll('button').find(b => b.text() === 'Apply')!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.price_min).toBe('10'))
    expect(wrapper.text()).toContain('€10 – €50')

    await wrapper.findAll('button').find(b => b.text().includes('€10'))!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.price_min).toBeUndefined())
  })
})

describe('ProductsView — property filters', () => {
  const filters: ConciarFilter[] = [{
    key: 'color', label: 'Color',
    options: [{ value: 'Red', count: 3 }, { value: 'White', count: 2 }],
  }] as never

  it('toggles a property filter on and off via checkbox, updating the URL and chips', async () => {
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue(filters)
    vi.spyOn(conciarApi.connect.products, 'list').mockResolvedValue(page())
    const { wrapper, router } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Color'))

    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    await vi.waitFor(() => expect(router.currentRoute.value.query['property[color]']).toBe('Red'))
    expect(wrapper.text()).toContain('Color: Red')

    await checkbox.setValue(false)
    await vi.waitFor(() => expect(router.currentRoute.value.query['property[color]']).toBeUndefined())
  })

  it('shows "show more" only when a filter has more options than the initial cap, and expands it', async () => {
    const manyOptions: ConciarFilter[] = [{
      key: 'size', label: 'Size',
      options: Array.from({ length: 7 }, (_, i) => ({ value: `S${i}`, count: 1 })),
    }] as never
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue(manyOptions)
    vi.spyOn(conciarApi.connect.products, 'list').mockResolvedValue(page())
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('2 more'))

    await wrapper.findAll('button').find(b => b.text().includes('2 more'))!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Show less'))
  })
})

describe('ProductsView — mobile filter panel', () => {
  it('toggles open/closed and clears all filters from the panel', async () => {
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue([])
    vi.spyOn(conciarApi.connect.products, 'list').mockResolvedValue(page())
    const { wrapper, router } = await mountAt('/products?q=test&price_min=5')
    await vi.waitFor(() => expect(wrapper.text()).toContain('€5'))

    await wrapper.findAll('button').find(b => b.text().includes('Filters'))!.trigger('click')
    expect(wrapper.text()).toContain('Done')

    await wrapper.findAll('button').find(b => b.text() === 'Clear all')!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.price_min).toBeUndefined())
    expect(router.currentRoute.value.query.q).toBe('test') // clearAll from mobile panel preserves q
  })
})

describe('ProductsView — infinite scroll', () => {
  it('loads the next page when the sentinel intersects, and appends deduped results', async () => {
    const list = vi.spyOn(conciarApi.connect.products, 'list')
      .mockResolvedValueOnce(page({ data: [{ id: 1, resolved_info: { name: 'A' }, files: [] }] as never, current_page: 1, last_page: 2, total: 2 }))
      .mockResolvedValueOnce(page({ data: [{ id: 2, resolved_info: { name: 'B' }, files: [] }] as never, current_page: 2, last_page: 2, total: 2 }))
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue([])

    const { wrapper, router } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('A'))

    ioCallback?.([{ isIntersecting: true }])
    await vi.waitFor(() => expect(router.currentRoute.value.query.page).toBe('2'))
    await vi.waitFor(() => expect(wrapper.text()).toContain('B'))
    expect(wrapper.text()).toContain('A') // page 1 results retained
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('shows an "all loaded" message once there are no more pages', async () => {
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue([])
    vi.spyOn(conciarApi.connect.products, 'list').mockResolvedValue(
      page({ data: [{ id: 1, resolved_info: { name: 'A' }, files: [] }] as never, total: 1 }),
    )
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('1 products loaded'))
  })
})
