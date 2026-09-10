// Shared constants and card-code helpers for the card overlay.

export const CARD_RATIO = 0.705 // width / height (portrait)
export const OVERLAY_W = 300 // base width (portrait) or height (sideways)
export const TAROT_H = 500 // fixed tarot height
export const VIEW_W = 1000 // stable viewBox width for percent → px mapping
export const BASE_LABEL_FONT = 16 // px inside viewBox units

export const normalizedCardCode = (value: string | undefined) =>
  value?.replace(/^c/, '') ?? null
