# Enlarge inbox header icon tile (sm → default)

Status: EXECUTED and verified 2026-09-04 (docker stack rebuilt; inbox header tile measures 40x40 with 18px glyph live at desktop and mobile, no layout shift in panel header, zero console errors).

Written against: working tree 2026-09-04 (repository has no commits yet).

## Evidence chain

- Surface: home route `/` — `InboxPanel` header, `frontend/src/components/home/InboxPanel.tsx`, mounted by `frontend/src/routes/index.tsx:49`. Rendered evidence: user-provided screenshot of the inbox ("current messages") panel.
- Problem: the inbox header icon (`<Inbox />` inside `IconTile`, `InboxPanel.tsx:137-144`) renders at `size="sm"` = 32px tile / 16px glyph; user direction: enlarge it.
- Design evidence: `frontend/src/components/reui/icon-tile.tsx:62-69` defines the size ladder — `sm` 32/16, `default` 40/18, `lg` 48/22, `xl` 56/28. Systematic sibling convention (grep across `frontend/src`): every header/list IconTile uses `sm` (AddressCard, ByodCard, HelpContent section headers, DomainStats, StatCards, InboxPanel email rows); `lg` is reserved for focal standalone moments — including this same panel's empty state (`InboxPanel.tsx:178`, `MailOpen` at `lg`) and `NotFound.tsx:43`.
- Owner: `frontend/src/components/home/InboxPanel.tsx` (`IconTile size="sm"` at line 139).
- Scope and affected surfaces: only the inbox panel header on `/`. The email-row tiles (line 214), the empty-state tile (line 178), and the `size="sm"` Buttons (lines 151, 160) are separate elements and stay unchanged.
- Uncertainty: none. User direction supplies the contract; the component's own size ladder supplies the value.

## Design decision

Raise the inbox header IconTile one ladder step, `size="sm"` → `size="default"` (tile 32→40px, glyph 16→18px). `lg` was rejected: it would equal the panel's own empty-state tile (48px) and collapse the internal hierarchy (header must stay subordinate to the focal empty state). The violet tone class, `variant="soft"`, and `aria-hidden` stay untouched.

## Reuse

- `IconTile` `size="default"` variant — `frontend/src/components/reui/icon-tile.tsx:65-66`. No new primitive, no new token.
- Exemplar: `WhyChoose.tsx:66` already renders `IconTile` at the default size.

## Changes

1. `frontend/src/components/home/InboxPanel.tsx` (line 139, header block lines 137-144)
   - Change: `size="sm"` → `size="default"` on the header `IconTile` wrapping `<Inbox />`.
   - Preserve: `variant="soft"`, `text-violet-600 dark:text-violet-400`, `aria-hidden`, title, badge, action buttons.
   - Verify: rendered header tile measures 40x40, inner svg 18x18; header row height grows ≤ 12px with no wrap or overlap at 1400x900 and 390x844.

## Scope

- Inherit: home route `/` inbox panel header, light and dark.
- Verify: header row alignment (title `text-xl` + count `Badge` still centered against the 40px tile); empty state unchanged at `lg` and still visually dominant.
- Exclude: email-row tiles, empty-state tile, Buttons, all other routes and IconTile consumers.

## Validation

- Product: inbox header icon reads clearly larger; panel header composition unchanged otherwise.
- Interface: `/` at 1400x900 and 390x844, light + dark; measure tile = 40px, svg = 18px; confirm empty-state tile still 48px; zero console errors.
- System: `grep 'size="sm"' frontend/src/components/home/InboxPanel.tsx` returns only the two Buttons and the email-row tile.
- Repository: `cd frontend && npm run build` → `tsc --noEmit && vite build` passes.

## Stop conditions

- Stop if the 40px tile forces the header row to wrap at 390px (then fall back and record the deviation — it did not).

## Design documentation

- After acceptance and validation: this file's Status line updated to EXECUTED (done). No other documentation needs changes.
