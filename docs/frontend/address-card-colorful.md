# Make AddressCard colorful within the existing palette

Written against: no commits in repo (untracked frontend); sources current as of 2026-09-01.

Status: EXECUTED and verified 2026-09-01 (build clean; light/dark/mobile verified; zero console errors). User-directed change during execution: Change 1 (address gradient) reverted, address text stays plain foreground. Applied: Link = success teal soft, Identity = violet soft, chips = primary-tinted pills.

## Evidence chain

- Surface: `/` home — `frontend/src/components/home/AddressCard.tsx` (Frame/FramePanel, right column of the workspace grid). User-selected element: the AddressCard FramePanel (718x379).
- Problem: the card body is monochrome apart from the info IconTile and the primary-tinted copy button. The `h2` address value is plain foreground (`AddressCard.tsx:175`), the three action buttons render Random=primary + Link/Identity=identical gray `secondary` (lines 238-261), and the recent chips are gray (`bg-muted/40 border`). Rendered at 1400x900 light: gray Link/Identity buttons, gray chips, black address text.
- Design evidence (same page, same session decisions): `Hero.tsx:37` headline uses `text-brand-gradient` (utility defined `frontend/src/index.css:177`, works light+dark); `Hero.tsx:50-54` tints stat icon tiles AND values per item (blue/teal/orange); `InboxPanel.tsx` header tile uses `text-violet-600 dark:text-violet-400`; ByodCard tile is teal; the AddressCard copy button itself (`AddressCard.tsx:188`) sets the soft-tint formula `bg-primary/10 text-primary hover:bg-primary/20`.
- Owner: `frontend/src/components/home/AddressCard.tsx`.
- Scope and affected surfaces: `/` home AddressCard only. No other consumer.
- Uncertainty: none; every class used already exists in the codebase or Tailwind palette.

## Design decision

Give the card's three monochrome areas the hues the page already speaks, without new tokens:
- The address value (the card's hero element) takes the brand gradient text, matching the page h1 treatment.
- The three actions become three distinct soft-tint buttons using the copy button's own formula: Random stays primary solid (it is the primary action), Link = success teal, Identity = violet (matching the InboxPanel tile hue).
- Recent chips take a faint primary tint so the card reads as one blue-violet-teal composition.

## Reuse

- `.text-brand-gradient` (`frontend/src/index.css:177`) — existing utility
- Soft-tint formula from `AddressCard.tsx:188`: `bg-<tone>/10 text-<tone> hover:bg-<tone>/20`
- `--success` token (`text-success`, `bg-success/10`) and Tailwind violet literals matching `InboxPanel.tsx` (`text-violet-600 dark:text-violet-400`)
- Exemplar: `frontend/src/components/home/Hero.tsx` (per-item tints), `frontend/src/components/home/InboxPanel.tsx` (violet literal)

## Changes

1. `frontend/src/components/home/AddressCard.tsx` — address value (line 175)
   - Change: `h2` className gains `text-brand-gradient` → `max-w-full break-all text-[22px] font-bold leading-[26px] text-brand-gradient`.
   - Preserve: address text, break-all wrapping, copy button.
   - Verify: address renders in the brand gradient in light and dark; still fully readable.
2. `frontend/src/components/home/AddressCard.tsx` — action buttons (lines 238-261)
   - Change: keep `grid grid-cols-3 gap-2` and `w-full`; Link button className becomes `w-full bg-success/10 text-success hover:bg-success/20`; Identity button className becomes `w-full bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 dark:text-violet-400`. Random unchanged (primary default).
   - Preserve: equal widths, click behaviors, copy feedback icon swap.
   - Verify: three buttons render blue / teal / violet in both schemes; widths stay equal.
3. `frontend/src/components/home/AddressCard.tsx` — RecentChip pill (line 82)
   - Change: pill className from `border bg-muted/40` to `border-primary/25 bg-primary/5`; remove-button hover from `hover:bg-muted hover:text-foreground` to `hover:bg-primary/10 hover:text-primary`.
   - Preserve: chip layout, truncate, select/remove behaviors, X icon.
   - Verify: chips read as light-blue pills in light mode, subtle primary tint in dark; hover states intact.

## Scope

- Inherit: none — all changes local to AddressCard.
- Verify: `/` home light + dark at 1400x900; 390x844 mobile (button labels not clipped, overflow 0); chips row; contrast of gradient text.
- Exclude: InboxPanel, ByodCard, Hero, other routes; no new tokens; no structural changes.

## Validation

- Product: AddressCard reads colorful but consistent with the page palette.
- Interface: light/dark 1400x900; mobile 390x844; chip interactions (select, remove, collapse toggle) still work.
- System: no new utilities; violet literal identical to InboxPanel's; success token already mapped (`--color-success`).
- Repository: `npm run build` in `frontend/` → tsc + vite build clean.

## Stop conditions

- Stop if `text-brand-gradient` on the 22px address harms readability in dark mode (fallback: `text-primary`).
- Stop if soft-tinted secondary buttons lose the pressed/disabled affordance (fallback: keep secondary variant, tint only the icon).

## Design documentation

- After acceptance and validation: append outcome to this file's Status line; no other documentation exists to update.
