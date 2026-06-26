import type { ConciarPriceRule } from '@/api/conciar-types'

export interface Product {
  id: string
  name: string
  price: number
  originalPrice?: number
  image: string
  variantId?: string        // Conciar product_variant_id — required for cart sync
  priceRules?: ConciarPriceRule[]
}

export interface SubscriptionBox {
  id: string
  variantId?: string        // Conciar product_variant_id — required for cart sync
  isSubscription: boolean
  name: string
  tagline: string
  description: string
  bottles: number
  price: number
  originalPrice?: number
  frequency: 'monthly' | 'quarterly'
  image: string
  highlights: string[]
  popular?: boolean
  minimumCommitmentCycles?: number | null
  renewCommitmentOnCycle?: boolean | null  // whether the commitment renews after each minimum-cycle period
  priceRules?: ConciarPriceRule[]   // automatic promotions, carried for cart badges
}

export interface CartItem {
  id: string
  type: 'product' | 'subscription'
  product: Product | SubscriptionBox
  quantity: number
  price: number
  interval?: string  // billing cycle label for subscription items e.g. "Every 4 weeks"
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

export interface Order {
  id: string
  createdAt: string
  status: OrderStatus
  items: CartItem[]
  subtotal: number
  shipping: number
  total: number
  address: ShippingAddress
}

export interface ShippingAddress {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  houseNumber: string
  city: string
  postcode: string
  state?: string
  country: string
}

export interface CheckoutForm extends ShippingAddress {
  notes?: string
}

export interface BillingAddress {
  address: string
  houseNumber: string
  city: string
  postcode: string
  state: string
  country: string
}
