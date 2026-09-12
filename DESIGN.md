# Zennara design language (one sheet)

Source of truth for every screen in this project. `src/styles/preconsult.css` implements it as `--zp-*` tokens.

## Type
- UI: **Manrope** (variable) for everything
- Wordmark only: Cormorant Garamond 500 (we use the logo image, so no Cormorant in UI)
- Codes, labels, eyebrows: system mono, uppercase, +10% tracking (`.zp-code`, `.zp-eyebrow`)

## Scale
- Page title 22 / 800 (`.zp-h1`) · Section 18 / 700 (`.zp-h2`) · Card title 13 / 700 (`.zp-h3`)
- Body 14 / 400 · Table 12.8 · Field label 11 / 700 (`.zp-label`) · Eyebrow 10 mono
- Sentence case everywhere

## Colour
- Deep green `#032F22` primary, sidebar, buttons · hover `#02271C` · secondary `#0B4A37`
- Champagne gold `#E0C391` accents, active states · dark gold `#CFAE73`
- Background `#FDFCFA` · Surface `#FFFFFF` · Cream `#F6F0E6` · Ivory `#FAF8F4` · Sage `#EFF3EE`
- Border `#E8E3DA`
- Text: primary `#111714` · secondary `#4F5853` · muted `#7A827E`
- Sidebar text `#B7CBC0` · muted `#6F8F80`

## Status (always icon + label, never colour alone)
- Confirmed `#267A50` on `#E5F4EB` · Pending `#9A5B13` on `#FFF3DD` · Error `#B42318` on `#FDE9E7`
- Info `#27678F` on `#E8F2F8` · Disabled `#8A918D` on `#F1F1EF`
- Mapping here: submitted → Pending · doctor_signed → Confirmed · in_treatment → Info · completed → Disabled · cancelled → Error

## Charts (colour-blind validated)
`#A96A08` · `#2F9E62` · `#6E7BE0`

## Shape
- Buttons 12px · Cards 16px · Feature cards 18px · Pills full
- Card shadow `0 4px 16px rgba(3,47,34,.05)`
- 8-pt spacing · 20px page gutter · 44px minimum touch target

## Rules
- One primary action per screen
- Gold = accent (selected chips, active tab, current step), never a status
- Icons: Lucide line, 1.5px (`src/components/icons.jsx`), no emoji anywhere, including notifications

## The sheet
`PreConsultSheet` mirrors the paper PRE-CONSULT FORM row for row: label followed by tick box, underlined values,
Client Signature and Doctor lines always present. Long values wrap inside their own cell; the underline follows.
