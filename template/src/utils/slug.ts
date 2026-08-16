/**
 * URL slug for a product.
 *
 * The obvious implementation — lowercase the name and strip anything that
 * isn't `[a-z0-9]` — produces an **empty string** for any shop whose products
 * are not named in Latin script. That yields links like `/product/631/`, which
 * the `/product/:id/:slug` route doesn't match, so the detail page renders
 * nothing at all.
 *
 * So: use the Latin slug when the name has Latin in it, and otherwise fall back
 * to the SKU (ASCII by construction) and then the id, which always produce
 * something the route can match.
 */
export function productSlug(name: string | null | undefined, fallback?: string | number | null): string {
  const latin = toSlug(name)
  if (latin) return latin

  return toSlug(fallback) || 'product'
}

function toSlug(value: string | number | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
