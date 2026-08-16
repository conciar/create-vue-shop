import { productImage } from '@/utils/images'
import type { ConciarConnectProduct } from '@/api/conciar-types'
import type { Product, SubscriptionBox } from '@/types'

/**
 * Turn a catalogue product into the shape the cart stores.
 *
 * Shared rather than inlined at each call site: the cart persists these objects
 * to localStorage, so two call sites building them slightly differently means
 * two different shapes living in one cart, and a field that only some entries
 * carry is a bug that surfaces long after the code that caused it.
 */
export function toCartProduct(product: ConciarConnectProduct): Product | SubscriptionBox {
  const base = {
    id: String(product.id),
    name: product.resolved_info?.name ?? `Product ${product.id}`,
    price: product.converted_retail_price?.amount ?? 0,
    image: productImage(product) ?? '',
    priceRules: product.price_rules,
  }

  if (!product.is_subscription) return { ...base } satisfies Product

  const detail = product.subscription_detail
  return {
    ...base,
    isSubscription: true,
    tagline: '',
    description: product.resolved_info?.description ?? '',
    frequency: detail?.billing_cycle_unit === 'quarterly' ? 'quarterly' : 'monthly',
    highlights: [],
    minimumCommitmentCycles: detail?.minimum_commitment_cycles ?? null,
    renewCommitmentOnCycle: detail?.renew_commitment_on_cycle ?? null,
  } satisfies SubscriptionBox
}
