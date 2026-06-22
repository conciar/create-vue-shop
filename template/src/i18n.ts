import { createI18n } from 'vue-i18n'
import en from '@/locales/en'
import nl from '@/locales/nl'
import fr from '@/locales/fr'
import de from '@/locales/de'

const saved = localStorage.getItem('locale') ?? 'nl'

export const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
]

export const i18n = createI18n({
  legacy: false,
  locale: saved,
  fallbackLocale: 'en',
  messages: { en, nl, fr, de },
})
