# Compact navbar height (72px → 56px)

Status: EXECUTED and verified 2026-09-04 (docker stack rebuilt; header 56px live at desktop + mobile, `/api` rail sticks at 80px, `/help` mobile pill bar sticks flush at 56px, scrollspy active tracking works, anchor jumps land clear of the header, zero console errors).

Written against: working tree 2026-09-04 (repository has no commits yet).

## Evidence chain

- Surface: global fixed header on all routes — `frontend/src/components/shared/Header.tsx`, mounted by `frontend/src/routes/__root.tsx:12`; rendered at 1400x900 light on the live stack (`http://localhost:8080`).
- Problem: the header renders at a fixed `h-[72px]` (`Header.tsx:57`) while its tallest content is the 38px logo link (`Header.tsx:59`; img itself `h-9` = 36px, nav buttons `h-9` = 36px, theme button `size="icon"`). Measured at runtime: `header.offsetHeight = 72`, max content height 38 → 34px of dead vertical slack (17px above + 17px below the content). At a 900px viewport the bar consumes 8% of the screen for 38px of content.
- Design evidence: no `DESIGN.md`; no header-height token exists in `frontend/src/index.css` (grepped: no `header`/`navbar` variables). The bar's own content (38px logo, 36px controls) is the sizing contract. Tailwind v4 spacing scale provides the target step: `h-14` = 56px, which leaves 9px of padding above and below the 38px logo — compact but not cramped, and the standard compact app-bar height.
- Owner: `frontend/src/components/shared/Header.tsx` (`h-[72px]`).
- Scope and affected surfaces: every route inherits the header via `__root.tsx`. Five code sites carry values derived from 72px and must move in lockstep (listed under Changes). Verified complete by repo-wide grep for `72px|96px|scroll-mt` — no other dependents exist.
- Uncertainty: none structural. The exact replacement values below preserve each existing derived gap; all are arithmetic from 72→56 (−16px).

## Design decision

Shrink the fixed header from 72px to 56px (`h-14`) and shift every layout value derived from 72px down by 16px, preserving the gaps those values encode:

- `main` compensation padding 72 → 56 (`pt-14`)
- Mobile sticky pill bars (Api/Help "On this page") stick at 72 → 56 (`top-14`)
- Desktop sticky rails sit at header + 24px gap: 96 → 80 (`lg:top-20`)
- `scroll-mt` mobile 140 → 124 (`scroll-mt-[124px]`), desktop 96 → 80 (`lg:scroll-mt-20`)
- Scrollspy offsets: desktop 90 → 74, mobile pill 140 → 124

The header's internals (38px logo, 36px controls, border, blur, layout) stay unchanged — 56px still clears them with 9px to spare on each side.

## Reuse

- Tailwind v4 spacing scale utilities (`h-14`, `pt-14`, `top-14`, `lg:top-20`, `lg:scroll-mt-20`) — no new tokens, no new primitives.
- Exemplar: the header's own content sizing (`Header.tsx:59-60`) proves 56px fits.

## Changes

1. `frontend/src/components/shared/Header.tsx` (line 57)
   - Change: `h-[72px]` → `h-14`. Nothing else in the header changes (logo, nav, buttons, `border-b`, `bg-background/80 backdrop-blur`, `z-50`).
   - Preserve: all content, links, dropdown, theme toggle, responsive `lg:` nav switch.
   - Verify: rendered `header.offsetHeight === 56`; logo and controls vertically centered, unclipped.
2. `frontend/src/routes/__root.tsx` (line 13)
   - Change: `main` `pt-[72px]` → `pt-14`.
   - Verify: no route's content slides under the fixed header; first painted block starts exactly at 56px.
3. `frontend/src/components/api/ApiContent.tsx` (lines 254, 272, 278, 297, 307, 320)
   - Change: `scroll-mt-[140px]` → `scroll-mt-[124px]` (both occurrences: section Frame L254, overview L320); `lg:scroll-mt-24` → `lg:scroll-mt-20` (both); Scrollspy `offset={90}` → `offset={74}`; rail `lg:top-[96px]` → `lg:top-20`; pill bar `top-[72px]` → `top-14`; pill `data-scrollspy-offset={140}` → `{124}`.
   - Preserve: all sticky behavior, scrollspy wiring, copy, components.
   - Verify: `/api` mobile pill bar sticks flush under the header; rail active state still tracks sections while scrolling; anchor jumps land sections clear of header + pill bar.
4. `frontend/src/components/help/HelpContent.tsx` (lines 326, 367, 373, 392, 402)
   - Change: identical substitutions — `scroll-mt-[140px]` → `scroll-mt-[124px]`, `lg:scroll-mt-24` → `lg:scroll-mt-20` (L326); Scrollspy `offset={90}` → `offset={74}` (L367); rail `lg:top-[96px]` → `lg:top-20` (L373); pill bar `top-[72px]` → `top-14` (L392); pill `data-scrollspy-offset={140}` → `{124}` (L402).
   - Preserve: all sticky behavior, scrollspy wiring, copy, components.
   - Verify: same checks as `/api` on `/help`.
5. No other files change. `frontend/src/routes/index.tsx:45` keeps its grid `pt-[72px]` — that is extra hero breathing room stacked on top of `main`'s compensation, not header compensation; changing it would alter the hero's vertical rhythm, which is out of scope.

## Scope

- Inherit: all five routes (`/`, `/domains`, `/statistics`, `/api`, `/help`) receive the 16px-taller content area automatically via `__root.tsx`.
- Verify: `/api` and `/help` sticky rails/pill bars and scrollspy offsets (the only surfaces with header-derived positioning).
- Exclude: header content/structure, logo sizing, footer, `index.tsx` hero padding, backend, tokens, dark-mode variants (no height coupling exists), accessibility changes.

## Validation

- Product: navbar reads as a compact bar; page content gains 16px of viewport on every route; nothing visually collides or overlaps.
- Interface: all 5 routes at 1400x900 and 390x844, light and dark; assert `document.querySelector('header').offsetHeight === 56`; on `/api` and `/help` at mobile width, scroll and confirm the pill bar sticks directly under the header with no gap or overlap; click rail/pill anchors and confirm target sections land unobscured; zero console errors.
- System: `grep` for `72px|top-\[96px\]|scroll-mt-\[140px\]|offset={90}` in `frontend/src` returns only the intentional `index.tsx:45` hero padding.
- Repository: `cd frontend && npm run build` → `tsc --noEmit && vite build` passes.

## Stop conditions

- Stop if any rendered header content exceeds 56px (then the logo/controls would need resizing — a new decision, not part of this plan).
- Stop if a scrollspy offset change breaks active-state tracking at render (revert that offset only, keep the height change, record the deviation).

## Design documentation

- After acceptance and validation: update this file's Status line to EXECUTED with the verification date. No other documentation needs changes — the executed route plans (`domains-colorful-modern.md`, `help-colorful-modern.md`, `statistics-colorful-modern.md`) mention "fixed 72px header" as historical context only.
