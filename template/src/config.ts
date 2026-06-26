// Storefront display name. Set VITE_SHOP_NAME in .env.local (the scaffolder
// writes it for you); falls back to a neutral placeholder so the template runs
// before it's configured. Used for the logo, footer, loading/maintenance
// screens, and the copyright line.
export const SHOP_NAME = (import.meta.env.VITE_SHOP_NAME as string)?.trim() || 'My Shop'
