import type { Product, SubscriptionBox, Order } from '@/types'

export const mockProducts: Product[] = [
  { id: 'p1', name: 'Sample product 1', price: 29, image: '' },
  // originalPrice → a compare_price ("was") so the discount UI shows in mock mode
  { id: 'p2', name: 'Sample product 2', price: 49, originalPrice: 65, image: '' },
  { id: 'p3', name: 'Sample product 3', price: 79, image: '' },
  { id: 'p4', name: 'Sample product 4', price: 119, originalPrice: 149, image: '' },
]

export const mockSubscriptions: SubscriptionBox[] = [
  {
    id: 's1',
    isSubscription: true,
    name: 'Starter plan',
    tagline: 'Everything you need to get going',
    description: 'A monthly plan with the essentials — a simple way to get started.',
    bottles: 3,
    price: 59,
    frequency: 'monthly',
    image: 'https://picsum.photos/seed/starter/600/400',
    highlights: ['3 items/month', 'Free delivery', 'Cancel anytime'],
  },
  {
    id: 's2',
    isSubscription: true,
    name: 'Pro plan',
    tagline: 'More items, every month',
    description: 'Our most popular plan — a larger monthly selection with extra perks.',
    bottles: 6,
    price: 119,
    originalPrice: 139,
    frequency: 'monthly',
    image: 'https://picsum.photos/seed/pro/600/400',
    highlights: ['6 items/month', 'Priority support', 'Free delivery', 'Cancel anytime'],
    popular: true,
  },
  {
    id: 's3',
    isSubscription: true,
    name: 'Premium plan',
    tagline: 'The full experience, quarterly',
    description: 'For enthusiasts — a premium quarterly selection with everything included.',
    bottles: 6,
    price: 349,
    frequency: 'quarterly',
    image: 'https://picsum.photos/seed/premium/600/400',
    highlights: ['6 premium items/quarter', 'Gift packaging', 'Priority delivery'],
  },
  {
    id: 's4',
    isSubscription: false,
    name: 'Sample bundle',
    tagline: 'A one-time selection of three items',
    description: 'Three hand-picked items in a single one-off bundle.',
    bottles: 3,
    price: 69,
    frequency: 'monthly',
    image: 'https://picsum.photos/seed/bundle-a/600/400',
    highlights: ['3 items', 'Free delivery'],
  },
  {
    id: 's5',
    isSubscription: false,
    name: 'Value bundle',
    tagline: 'Six items in one package',
    description: 'A larger one-off bundle of six items at a great value.',
    bottles: 6,
    price: 109,
    frequency: 'monthly',
    image: 'https://picsum.photos/seed/bundle-b/600/400',
    highlights: ['6 items', 'Free delivery'],
  },
  {
    id: 's6',
    isSubscription: false,
    name: 'Gift bundle',
    tagline: 'A ready-to-give selection',
    description: 'A curated one-off bundle, perfect for gifting on any occasion.',
    bottles: 3,
    price: 89,
    frequency: 'monthly',
    image: 'https://picsum.photos/seed/bundle-c/600/400',
    highlights: ['3 items', 'Gift packaging', 'Free delivery'],
  },
]

export const mockOrders: Order[] = [
  {
    id: 'ORD-2024-0042',
    createdAt: '2024-11-15T10:23:00Z',
    status: 'delivered',
    items: [
      { id: 'p3', type: 'product', product: mockProducts[2], quantity: 2, price: 79 },
      { id: 'p1', type: 'product', product: mockProducts[0], quantity: 1, price: 29 }
    ],
    subtotal: 187,
    shipping: 0,
    total: 187,
    address: {
      firstName: 'Jan',
      lastName: 'de Vries',
      email: 'jan@example.com',
      phone: '+31 6 12345678',
      address: 'Herengracht',
      houseNumber: '182',
      city: 'Amsterdam',
      postcode: '1016 BR',
      country: 'Netherlands'
    }
  },
  {
    id: 'ORD-2024-0038',
    createdAt: '2024-10-02T14:05:00Z',
    status: 'delivered',
    items: [
      { id: 's2', type: 'subscription', product: mockSubscriptions[1], quantity: 1, price: 119 }
    ],
    subtotal: 119,
    shipping: 0,
    total: 119,
    address: {
      firstName: 'Jan',
      lastName: 'de Vries',
      email: 'jan@example.com',
      phone: '+31 6 12345678',
      address: 'Herengracht',
      houseNumber: '182',
      city: 'Amsterdam',
      postcode: '1016 BR',
      country: 'Netherlands'
    }
  }
]
