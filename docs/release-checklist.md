# Release Checklist

## Web/PWA

- `npm run build` succeeds.
- `npm run preview` serves `dist`.
- `manifest.webmanifest` returns `200`.
- `sw.js` returns `200`.
- Mobile layout has no horizontal overflow.
- Home screen install works on iOS Safari and Android Chrome.

## Product

- Vehicle listing creation saves draft state.
- Vehicle photos preview before publish.
- Published vehicles appear in search.
- Favorites persist after reload.
- Chat messages persist after reload.
- Deal status persists after reload.

## Integrations

- eKYC provider selected.
- Escrow/payment provider selected.
- OCR provider selected.
- Electronic vehicle inspection certificate API access reviewed.
- Image storage configured.
- Error logging configured.

## Legal/Ops

- Terms of service drafted.
- Privacy policy drafted.
- Important disclosures for as-is private sales drafted.
- Support flow for failed handover drafted.
- Title transfer partner or administrative scrivener flow drafted.
- Cancellation/refund policy drafted.
