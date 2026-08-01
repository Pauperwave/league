// i18n.config.ts
export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'it',
  numberFormats: {
    it: {
      currency: { style: 'currency', currency: 'EUR' },
    },
  },
}))
