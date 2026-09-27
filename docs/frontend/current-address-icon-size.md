# Enlarge Current Address header icon tile (sm → default)

Status: EXECUTED and verified 2026-09-04 (docker stack rebuilt; Current Address header tile measures 40x40 with 18px glyph live at desktop and mobile, zero console errors).

Written against: working tree 2026-09-04 (repository has no commits yet).

## Evidence chain

- Surface: home route `/` — `AddressCard` header ("CURRENT ADDRESS"), `frontend/src/components/home/AddressCard.tsx`, mounted by `frontend/src/routes/index.tsx:47`. Rendered evidence: user-provided screenshot and user clarification naming the Current Address icon.
- Problem: the header icon (`<Mail />` inside `IconTile`, `AddressCard.tsx:134-141`) renders at `size="sm"` = 32px tile / 16px glyph; user direction: enlarge it.
- Design evidence: `frontend/src/components/reui/icon-tile.tsx:62-69` size ladder — `sm` 32/16, `default` 40/18, `lg` 48/22, `xl` 56/28. Precedent in the same session: the inbox header tile (`InboxPanel.tsx:139`) was raised to `default` for the same reason (`docs/frontend/inbox-icon-size.md`); `lg`/`xl` stay reserved for focal empty-state moments.
- Owner: `frontend/src/components/home/AddressCard.tsx` (`IconTile size="sm"` at line 136).
- Scope and affected surfaces: only the AddressCard header on `/`. The copy tooltip button beside it and all other IconTile consumers stay unchanged.
- Uncertainty: none. User direction supplies the contract; the component's own size ladder supplies the value.

## Design decision

Raise the Current Address header IconTile one ladder step, `size="sm"` → `size="default"` (tile 32→40px, glyph 16→18px), matching the inbox header treatment. The header row is `items-start`, so the 40px tile stays top-aligned against the two-line label/address block. The `text-info` tone, `variant="soft"`, and `aria-hidden` stay untouched.

## Reuse

- `IconTile` `size="default"` variant — `frontend/src/components/reui/icon-tile.tsx:65-66`. No new primitive.
- Exemplar: `frontend/src/components/home/InboxPanel.tsx:137-144` (same correction, already executed).

## Changes

1. `frontend/src/components/home/AddressCard.tsx` (line 136, header block lines 134-141)
   - Change: `size="sm"` → `size="default"` on the header `IconTile` wrapping `<Mail />`.
   - Preserve: `variant="soft"`, `text-info`, `aria-hidden`, CURRENT ADDRESS label, address heading, copy tooltip button.
   - Verify: rendered header tile measures 40x40, inner svg 18x18; no wrap or overlap at 1400x900 and 390x844.

## Scope

- Inherit: home route `/` AddressCard header, light and dark.
- Verify: header alignment with the copy button; address text still truncates/wraps (`break-all`) normally beside the larger tile.
- Exclude: all other IconTile consumers (inbox header already done; email rows, stats, help sections intentionally `sm`).

## Validation

- Product: Current Address icon reads clearly larger; card composition unchanged otherwise.
- Interface: `/` at 1400x900 and 390x844, light + dark; measure tile = 40px, svg = 18px; zero console errors.
- System: `grep -n 'size="sm"' frontend/src/components/home/AddressCard.tsx` returns no header IconTile occurrence.
- Repository: `cd frontend && npm run build` → `tsc --noEmit && vite build` passes.

## Stop conditions

- Stop if the 40px tile breaks the `items-start` header alignment or overlaps the copy button at 390px (it did not).

## Design documentation

- After acceptance and validation: this file's Status line updated to EXECUTED (done). No other documentation needs changes.
