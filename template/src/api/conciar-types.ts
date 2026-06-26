export interface ConciarCurrency {
  id: number
  name: string
  decimal_separator: string
  decimal_places: number
  thousand_separator: string
  icon: string
  symbol_icon: string
  symbol: string
}

export interface ConciarRetailPrice {
  id: number
  amount: string
  display_price: string
  currency: ConciarCurrency
}

export interface ConciarConvertedPrice {
  amount: number
  display_price: string
  currency: ConciarCurrency
}

// Per-component tax/fee line, named after the merchant's rule (e.g. "BTW", "Accijns")
export interface ConciarTaxComponent {
  name: string
  type: 'percentage' | 'fixed_per_unit' | string
  rate: number
  amount: number
}

// Tax breakdown, already converted to the customer's currency. null = no tax
// rule (treat net = gross, no tax line). gross is the price the customer pays.
export interface ConciarTax {
  net: number
  tax_total: number
  gross: number
  components: ConciarTaxComponent[]
  currency: ConciarCurrency
}

export interface ConciarVariant {
  id: number
  product_id: number
  sku: string | null
  out_of_stock: boolean
  active: boolean
  created_at: string
  updated_at: string
  resolved_info: ConciarProductInfo | null
  default_info: ConciarProductInfo | null
  converted_retail_price: ConciarConvertedPrice | null
  retail_price: ConciarRetailPrice | null
  // Merchant's reference/original price for the strike-through + "save X%" UI.
  // Optional — absent/null when there's no "was" price. Display reference only:
  // never charged, never added to any total.
  compare_price?: ConciarRetailPrice | null
  converted_compare_price?: ConciarConvertedPrice | null
  tax?: ConciarTax | null
}

export interface ConciarProductInfo {
  id: number
  product_id: number
  language_id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface ConciarProductType {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export interface ConciarSubscriptionDetail {
  id: number
  product_id: number
  billing_cycle_unit: 'weekly' | 'monthly' | 'four_weekly' | 'quarterly' | 'yearly' | string
  billing_cycle_interval: number
  trial_period_days: number
  cancellation_notice_days: number
  auto_renew: boolean
  max_subscribers: number | null
  allow_one_time_purchase: boolean
  minimum_commitment_cycles: number | null
  renew_commitment_on_cycle: boolean | null
  created_at: string
  updated_at: string
}

export interface ConciarPropertyValue {
  id: number
  product_property_id: number
  default_info: { value: string } | null
  property: {
    id: number
    key: string
    default_info: { label: string } | null
  }
}

// Automatic, scoped promotion configured by the merchant. The server only
// returns rules applicable to the current sales channel; filter client-side by
// schedule for live badges. The real discount is allocated server-side at order
// creation (see promotion_discount order lines) — never computed here.
export interface ConciarPriceRuleInfo {
  name: string
  description: string | null
  language_id: number
}

export interface ConciarPriceRule {
  id?: number
  type: { name: 'buy_x_get_y' | 'percentage' | 'fixed' | string }
  scope_type: 'self' | 'variants' | 'category' | 'products' | 'store' | string
  // Localized name/description: defaultInfo is pre-resolved to the storefront's
  // language by the server; infos is the full per-language array (only needed
  // for client-side language switching without a re-fetch).
  defaultInfo?: ConciarPriceRuleInfo | null
  infos?: ConciarPriceRuleInfo[]
  buy_quantity?: number | null
  get_quantity?: number | null
  get_discount_percentage?: number | null
  percentage?: number | null
  // Schedule — empty/null fields mean "always on" for that dimension.
  start_date?: string | null   // YYYY-MM-DD
  end_date?: string | null     // YYYY-MM-DD
  start_time?: string | null   // HH:MM[:SS]
  end_time?: string | null     // HH:MM[:SS]
  weekdays?: Array<string | number> | null  // day names or 0–6 indices
}

export interface ConciarProduct {
  id: number
  organization_id: number
  type_id: number
  tax_rule_id: number | null
  sku: string | null
  out_of_stock: boolean
  active: boolean
  is_physical: boolean
  is_digital: boolean
  is_one_time_purchase: boolean
  is_subscription: boolean
  created_at: string
  updated_at: string
  retail_price: ConciarRetailPrice | null
  converted_retail_price: ConciarConvertedPrice | null
  resolved_info: ConciarProductInfo | null
  default_info: ConciarProductInfo
  type: ConciarProductType
  subscription_detail: ConciarSubscriptionDetail | null
  variants: ConciarVariant[]
  property_values?: ConciarPropertyValue[]
  files?: Array<{ url: string; type: { name: string } }>
  // Merchant's reference/original price for the strike-through + "save X%" UI.
  // Optional — absent/null when there's no "was" price. Display reference only:
  // never charged, never added to any total. Variants carry their own (above).
  compare_price?: ConciarRetailPrice | null
  converted_compare_price?: ConciarConvertedPrice | null
  tax?: ConciarTax | null
  price_rules?: ConciarPriceRule[]
}

export interface ConciarPaginated<T> {
  current_page: number
  data: T[]
  total: number
  per_page: number
  last_page: number
  next_page_url: string | null
  prev_page_url: string | null
}

export type ConciarResponse<T> = { data: T }

export interface ConciarCountry {
  id: number
  name: string                   // snake_case, e.g. "netherlands"
  iso_code_2: string             // e.g. "NL" (may be mixed-case from API)
  iso_code_3: string             // e.g. "NLD"
  call_prefix: number            // e.g. 31
  zipcode_format: string | null
  address_format: string         // template with {street}, {city}, {zipcode}, {state}, etc.
  has_state: boolean
  has_zipcode: boolean
  phone_format: string | null    // example placeholder, e.g. "06 12345678"
  phone_digits: number | null
  date_format: string
  icon: string                   // e.g. "netherlands.svg"
  active: boolean
}

export type OtpIdentifierType = 'email' | 'phone'

export interface OtpCustomerAddress {
  id: number
  street: string | null
  house_number: string | null
  apartment: string | null
  city: string
  zipcode: string | null
  country: { id: number; name: string; iso2: string }
}

export interface OtpCustomerPhone {
  number: string
  country: { id: number; call_prefix: number; iso2: string }
}

export interface OtpCustomer {
  id: number
  first_name: string
  last_name: string
  email: string
  organization_customer_id: number
  shipping_addresses?: OtpCustomerAddress[]
  phones?: OtpCustomerPhone[]
}

export interface OtpVerifySuccess {
  status: true
  data: {
    customer: OtpCustomer
    access_token: string
    token_type: string
  }
}

export interface OtpVerifyFailed {
  status: false
  message: string
  attempts_remaining: number
}

export type OtpVerifyResponse = OtpVerifySuccess | OtpVerifyFailed

export interface ConciarPaymentMethod {
  id: string
  name: string
  image: string | null
  active: boolean
}

export interface ConciarShippingMethod {
  id: string
  name: string
  description: string | null
  price: number
  active: boolean
}

export interface ConciarCartPaymentMethod {
  id: number
  key: string
  name: string
  logo: string | null
  status: string
  fixed_fee: { amount: number; currency: { symbol_icon: string } } | null
  fixed_percentage: number
  payment_service_provider_id: number | null
  payment_service_provider_key: string | null
}

export interface ConciarCheckoutIssue {
  sku: string
  name: string
  type: 'out_of_stock' | 'unavailable' | 'variant_unavailable' | 'not_in_channel' | string
}

// A coupon that's no longer redeemable — NON-blocking (can_proceed stays true);
// the storefront drops the code and tells the shopper why.
export interface ConciarCouponWarning {
  code: string
  reason: string  // human-readable, safe to show directly
}

export interface ConciarCheckoutCheckResponse {
  can_proceed: boolean
  issues: ConciarCheckoutIssue[]
  has_changes: boolean
  warnings: ConciarPriceWarning[]
  coupon_warnings?: ConciarCouponWarning[]
}

export interface ConciarCartShippingMethod {
  id: number
  type: string
  sort_order: number
  is_free: boolean
  // Carrier key (e.g. "postnl") or null for a manual method. delivery_type
  // drives which picker (if any) to show after the method is selected.
  carrier: string | null
  delivery_type: 'pickup' | 'home' | null
  resolved_info: { name: string; description: string | null }
  rate: { amount: number; display_price: string; currency: { symbol: string; symbol_icon: string } } | null
}

// PostNL pickup / drop-off point — GET store/shipping/locations
export interface ConciarPickupLocation {
  code: string            // submit this as pickup_location_code on the order
  name: string
  distance: number        // metres
  latitude: number
  longitude: number
  address: {
    Street: string
    HouseNr: number | string
    Zipcode: string
    City: string
    Countrycode: string
    Remark?: string
    [key: string]: unknown
  }
  delivery_options: string[]              // flat, already normalized
  opening_hours: Record<string, string[]> // { Monday: ["07:00-22:00"], … }
}

// PostNL home-delivery timeframes — GET store/shipping/delivery-options
export interface ConciarDeliveryTimeframe {
  from: string            // "10:45:00"
  to: string              // "13:15:00"
  options: string[]       // flat, e.g. ["Daytime"]
}
export interface ConciarDeliveryOption {
  date: string            // dd-mm-yyyy
  timeframes: ConciarDeliveryTimeframe[]
}

export interface ConciarDiscount {
  code: string
  type: 'percentage' | 'fixed'
  value: number
  description: string | null
}

export interface ConciarCartSyncItem {
  product_id: number
  product_variant_id: number | null
  quantity: number
  purchase_type: 'subscription' | 'one_time'
  metadata?: null
}

export interface ConciarCartSyncRequest {
  cart_token: string
  organization_customer_id?: number | null
  // Single-coupon field — still accepted, but prefer the declarative list below.
  coupon_code?: string | null
  // Declarative set of coupon codes — replaces ALL coupons with exactly this
  // list (like items sync). Pass [] to clear; omit entirely to leave unchanged.
  coupon_codes?: string[]
  items?: ConciarCartSyncItem[]
}

export interface ConciarCartInitData {
  cart_token: string
  cart: ConciarCartData
}

// GET /cart/{token} uses { cart: ... } not { data: ... }
export interface ConciarCartGetResponse {
  cart: ConciarCartData
}

export interface ConciarCartApiItem {
  id: number
  product_id: number
  product_variant_id: number
  quantity: number
  product: { default_info: { name: string } | null } | null
  variant: { default_info: { name: string } | null } | null
  price_at_added: {
    amount: string
    converted_price?: { amount: number; display_price: string } | null
    currency: {
      symbol: string
      symbol_icon: string
      decimal_places?: number
      decimal_separator?: string
      thousand_separator?: string
    }
  } | null
}

export interface ConciarCartCoupon {
  id?: number
  code: string
  type?: 'percentage' | 'fixed_amount' | string
  // Only a percentage is exposed as a number; fixed-amount coupons carry no
  // amount here. The authoritative monetary discount is computed at checkout.
  discount_percentage?: number | null
  default_info?: { name: string } | null
}

// Money summary returned with init/sync/show cart responses. PREVIEW ONLY —
// excludes shipping and payment fees (so total = subtotal − discount). The
// authoritative figures come from the order response at checkout.
// Free-shipping progress, recomputed on every cart change. null = no offer for
// the store/country → hide the bar. Based on the pre-discount subtotal, so it
// agrees with how free shipping is granted at checkout. Amounts are already in
// the customer's active currency.
export interface ConciarFreeShipping {
  threshold: number    // order amount that unlocks free shipping
  remaining: number    // how much more to add (drives the bar)
  qualified: boolean   // true once the cart reaches the threshold
  currency_id: number
}

export interface ConciarCartTotals {
  subtotal: number
  discount: number
  total: number
  currency_id: number
  coupons: Array<{ id: number; code: string; discount: number }>
  free_shipping?: ConciarFreeShipping | null
}

export interface ConciarCartData {
  id: number
  session_id: string
  status: { name: string }
  coupons: ConciarCartCoupon[]
  totals?: ConciarCartTotals
  items: ConciarCartApiItem[]
}

export interface ConciarStoreConfig {
  general: {
    store_name: string
    store_type: string
    store_size: number
    online_store: boolean
    extended_holiday_hours: boolean
  }
  checkout: {
    guestCheckout: boolean
    requirePhone: boolean
    requireShipping: boolean
    termsUrl: string | null
    privacyUrl: string | null
    confirmationEmailEnabled: boolean
    orderPrefix: string
  }
  seo: {
    metaTitle: string | null
    metaDescription: string | null
    ogImage: string | null
    googleAnalyticsId: string | null
    facebookPixelId: string | null
  }
  operating_hours: {
    weekdays: { enabled: boolean; open: string; close: string }
    saturday: { enabled: boolean; open: string; close: string }
    sunday:   { enabled: boolean; open: string; close: string }
  }
  supported_countries: string[] // ISO 3166-1 alpha-2 codes; empty = all countries
  allowSubscriptionProductSwap?: boolean
  subscriptionSwapVariantsOnly?: boolean
  // Whether more than one coupon may be stacked on a cart (per sales channel).
  couponsStackable?: boolean
}

// ─── Connect v1 Order Creation ───────────────────────────────────────────────

export interface ConciarOrderAddress {
  street?: string
  house_number?: string
  apartment?: string | null
  city: string
  zipcode?: string
  district?: string | null
  state?: string
  country_id: number
}

export interface ConciarOrderLine {
  // 'promotion_discount' lines carry a negative amount and the promotion's name.
  type: { name: 'product' | 'shipping' | 'payment_fee' | 'promotion_discount' | string }
  name: string
  qty: number
  prices: Array<{ amount: string; currency: { symbol: string; symbol_icon?: string } }>
}

export interface ConciarOrderPrice {
  // 'total_ex_tax' (net) and 'total_tax' rows accompany 'total_price' (gross).
  // One 'coupon_discount' row per applied coupon (negative, named after its code).
  type: { name: 'subtotal' | 'total_ex_tax' | 'total_tax' | 'total_price' | 'coupon_discount' | string }
  name?: string
  amount: string
  display_price?: string
}

export interface ConciarCreatedOrder {
  id: number
  reference: string
  status: { name: string }
  currency: { symbol: string; symbol_icon: string }
  customer_notes: string | null
  lines: ConciarOrderLine[]
  prices: ConciarOrderPrice[]
}

export interface ConciarPriceWarning {
  sku: string
  name: string
  original_price: number
  new_price: number
  currency: string
}

export interface ConciarOrderCreateResponse {
  order: ConciarCreatedOrder
  payment_url: string | null
  transaction_key: string | null
}

export interface ConciarCustomerOrderPrice {
  id: number
  type_id: number
  amount: string
  display_price: string
  currency: { symbol_icon: string; symbol: string }
}

export interface ConciarCustomerOrderLine {
  id: number
  name: string
  qty: number
  type: { id: number; name: string }
  prices: ConciarCustomerOrderPrice[]
}

export interface ConciarCustomerOrder {
  id: number
  reference: string
  status: { name: string; color?: string }
  currency: { symbol: string; symbol_icon: string }
  customer_notes: string | null
  lines: ConciarCustomerOrderLine[]
  prices: ConciarCustomerOrderPrice[]
  created_at: string
}

export interface ConciarCustomerOrdersData {
  data: ConciarCustomerOrder[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface ConciarSubscriptionCycle {
  id: number
  status: { name: string; color?: string }
  period_start: string
  period_end: string
  attempted_at: string | null
  order_id?: number | null
  invoice_id?: number | null
  order?: {
    id: number
    reference: string
    status: { name: string; color?: string }
  } | null
}

export interface ConciarMandatePaymentMethod {
  id: number
  key: string
  name: string
  logo: string | null
  payment_service_provider_id: number
  payment_service_provider: {
    id: number
    key: string
    name: string
  } | null
}

export interface ConciarCustomerPaymentMethod {
  id: number
  last_four: string | null
  expiry_month: number | null
  expiry_year: number | null
  iban_last_four: string | null
  is_default: boolean
  active: boolean
  payment_service_provider: {
    key: string
    name: string
    logo: string | null
  } | null
  payment_method: {
    key: string
    name: string
    logo: string | null
  } | null
}

export interface ConciarCustomerSubscription {
  id: number
  product_id: number
  status: { name: string; color?: string }
  quantity: number
  skip_count: number
  next_billing_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  minimum_commitment_cycles: number | null
  renew_commitment_on_cycle: boolean | null
  cycles_count: number
  commitment_cycles_remaining: number | null
  customer_payment_method?: ConciarCustomerPaymentMethod | null
  // Delivery used for future renewals (editable from the account area).
  shipping_method?: { id: number; name: string } | null
  shipping_address?: ConciarCustomerOrderAddress | null
  billing_address?: ConciarCustomerOrderAddress | null
  product: {
    id: number
    defaultInfo?: { name: string; description: string | null }
    default_info?: { name: string; description: string | null }
    retail_price: {
      amount: string
      display_price?: string
      currency: { symbol_icon: string }
    } | null
    subscription_detail: {
      billing_cycle_unit: string
      billing_cycle_interval: number
      minimum_commitment_cycles: number | null
      renew_commitment_on_cycle: boolean | null
    } | null
  }
  cycles?: ConciarSubscriptionCycle[]
}

export interface ConciarCustomerOrderAddress {
  street: string | null
  house_number: string | null
  apartment: string | null
  city: string
  zipcode: string | null
  state: string | null
  country: { name: string; iso_code_2: string } | null
}

export interface ConciarCustomerOrderTransaction {
  transaction_key: string
  amount: string
  status: { name: string; color?: string }
  payment_method: { key: string; name: string; logo: string | null } | null
  paid_at: string | null
}

// A credit note is an invoice raised by a refund. Its line prices carry a `type` (loaded
// server-side) so the line total ('total_price') can be told apart from the unit price.
export interface ConciarCustomerCreditNotePrice {
  id: number
  amount: string
  display_price: string
  type: { name: string } | null
  currency: { symbol_icon: string; symbol: string }
}

export interface ConciarCustomerCreditNoteLine {
  id: number
  name: string
  description: string | null
  quantity: number
  prices: ConciarCustomerCreditNotePrice[]
}

export interface ConciarCustomerCreditNote {
  id: number
  reference: string
  created_at: string
  lines: ConciarCustomerCreditNoteLine[]
}

export interface ConciarCustomerOrderDetail extends ConciarCustomerOrder {
  address: ConciarCustomerOrderAddress | null
  billing_address: ConciarCustomerOrderAddress | null
  invoice: {
    reference: string
    transactions: ConciarCustomerOrderTransaction[]
  } | null
  // Credit notes raised against this order by refunds (one per refund). Empty if none.
  credit_notes: ConciarCustomerCreditNote[]
}

export interface ConciarOrderStatus {
  reference: string
  status: { name: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | string }
  payment_status: { name: 'paid' | 'failed' | 'cancelled' | 'pending' | 'refunded' | string } | null
  total: string | null
  currency: { symbol_icon: string } | null
}

export interface ConciarPaymentStatus {
  transaction_key: string
  status: string
  is_paid: boolean
  is_pending: boolean
  is_failed: boolean
  amount: string | number
  order_reference: string
}

export interface ConciarOrderCustomer {
  email?: string
  first_name?: string
  last_name?: string
  phone?: { number: string; country_id: number }
}

export interface ConciarOrderCreateParams {
  cartToken: string
  accessToken?: string        // customer OTP Bearer token — included when logged in
  shippingMethodId: number
  paymentMethodKey: string
  paymentServiceProviderKey: string
  returnUrl: string
  shippingAddress: ConciarOrderAddress
  billingAddress?: ConciarOrderAddress
  customer?: ConciarOrderCustomer   // guest only — omit when cart is linked to a logged-in customer
  customerNotes?: string
  pickupLocationCode?: string       // pickup methods only — the chosen location's code
  // Method-specific fields
  cardToken?: string       // visa / mastercard / amex
  paymentData?: string     // google_pay
  applePayToken?: string   // applepay
  applePayPaymentData?: string
}

// ─── Connect v1 Product Listing ──────────────────────────────────────────────

export interface ConciarConnectProduct {
  id: number
  sku: string | null
  ean_13: string | null
  active: boolean
  out_of_stock: boolean
  is_subscription: boolean
  is_one_time_purchase?: boolean
  resolved_info: { name: string; description: string | null } | null
  converted_retail_price: {
    amount: number
    display_price: string
    currency: { symbol: string; symbol_icon: string }
  } | null
  // Reference/original price for the strike-through + "save X%" UI (already in
  // the customer's currency, mirroring converted_retail_price). Optional —
  // absent/null when there's no "was" price. Display reference only.
  converted_compare_price?: {
    amount: number
    display_price: string
    currency: { symbol: string; symbol_icon: string }
  } | null
  type: { name: string }
  files: Array<{ url: string; type: { name: string } }>
  subscription_detail: {
    billing_cycle_unit: string
    billing_cycle_interval: number
    minimum_commitment_cycles: number | null
    renew_commitment_on_cycle: boolean | null
  } | null
  // Populated in mock mode only — used for client-side property filtering
  properties?: Record<string, string>
  // Returned by the live list endpoint; absent in mock mode
  property_values?: ConciarPropertyValue[]
  tax?: ConciarTax | null
  price_rules?: ConciarPriceRule[]
}

export interface ConciarSwapVariant {
  id: number
  product_id: number
  active: boolean
  out_of_stock: boolean
  default_info: { name: string } | null
  retail_price: {
    amount: string
    currency: { symbol: string; symbol_icon: string; decimal_places?: number }
  } | null
  options?: Array<{ default_info: { value: string } | null }>
}

export interface ConciarSwapProduct {
  id: number
  active: boolean
  default_info: { name: string; description: string | null } | null
  retail_price: {
    amount: string
    currency: { symbol: string; symbol_icon: string; decimal_places?: number }
  } | null
  subscription_detail: {
    billing_cycle_interval: number
    billing_cycle_unit: string
    minimum_commitment_cycles: number | null
    renew_commitment_on_cycle: boolean | null
  } | null
  variants: ConciarSwapVariant[]
}

export type ConciarSwapOptions =
  | { variants: ConciarSwapVariant[]; products?: never }
  | { products: ConciarSwapProduct[]; variants?: never }

export interface ConciarConnectProductsData {
  data: ConciarConnectProduct[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface ConciarFilterOption {
  value: string
  count: number
}

export interface ConciarFilter {
  key: string
  label: string
  options: ConciarFilterOption[]
}

export interface ConciarProductListParams {
  q?: string
  type?: string
  category?: number
  price_min?: number
  price_max?: number
  properties?: Record<string, string | string[]>
  per_page?: number
  page?: number
  subscription?: boolean
}
