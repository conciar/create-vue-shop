/** The little a product needs for us to find it a picture. */
export interface ImageableProduct {
  files?: Array<{ url: string; type?: { name: string } | null }> | null
}

/**
 * The product's uploaded image, or `null` when it has none.
 *
 * `files` is the API's storage disk, and a fresh catalogue usually has nothing
 * on it — so callers must handle `null` rather than assume a URL. Every call
 * site in the storefront renders its own placeholder for that case.
 *
 * Shops that want stand-in artwork should extend this one function (return a
 * path under `public/` instead of `null`) rather than teach each component
 * about placeholders separately.
 */
export function productImage(product: ImageableProduct | null | undefined): string | null {
  return product?.files?.find(f => f.type?.name === 'image')?.url ?? null
}
