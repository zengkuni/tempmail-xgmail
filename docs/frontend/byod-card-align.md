# Align ByodCard with InboxPanel shell and fill its empty space

Written against: no commits in repo (untracked frontend); sources current as of 2026-09-01.

Status: EXECUTED and verified 2026-09-01 (build clean; `/` + `/domains` light/dark/mobile verified; zero console errors). Amendments during execution: explanatory paragraph removed (redundant with steps, kept row-2 balance: ByodCard 436px vs Inbox 476px); step 3 "Get your API key" removed per user (no public API keys are issued); steps are now 2 (blue, teal), STEP_TINTS trimmed to 2.

## Evidence chain

- Surface: `/` home — workspace grid row 2: `ByodCard` (left, 505px) and `InboxPanel` (right, 727px) are grid siblings, so both cells stretch to the same row height.
- Problem 1 (shell drift): `ByodCard.tsx:26-50` FramePanel has no `p-5`, header uses `border-b` without `pb-4`, and title is `text-lg` — while `InboxPanel.tsx:92-103` uses `p-5`, `border-b pb-4`, `text-xl`. The two cards render with visibly different inner padding and divider spacing.
- Problem 2 (empty space): ByodCard body = Alert + paragraph + input + one button (~250px of content) while the InboxPanel beside it holds 4 email rows; the ByodCard panel stretches and leaves dead space at the bottom.
- Design evidence: InboxPanel is the in-surface Frame exemplar for padding/header (`InboxPanel.tsx:92-103`); step/feature rows with tinted soft IconTiles exist in `ArticleSection.tsx:9-34` (`TINTS` blue/teal/orange literals reused across the page).
- Owner: `frontend/src/components/home/ByodCard.tsx`.
- Scope and affected surfaces: `/` home and `/domains` (both render ByodCard; `/domains` passes `showDomainsLink={false}`). Content addition must work in both contexts.
- Uncertainty: none structural; step copy is derived from the card's existing paragraph (lines 62-66), no new product claims.

## Design decision

1. Align the shell with InboxPanel: `FramePanel p-5`, header `border-b border-border pb-4`, title `text-xl font-bold`.
2. Fill the vertical gap with a "How it works" 3-step mini-list that restates the existing paragraph as scannable steps, each row = soft IconTile with a number, tinted blue/teal/orange (ArticleSection TINTS literals), bold step title + one-line muted description. This is relevant content (the card's own instructions), not filler.

## Reuse

- `IconTile` soft sm (steps numbered, tint per step)
- TINTS literals: `text-blue-600 dark:text-blue-400`, `text-teal-600 dark:text-teal-400`, `text-orange-600 dark:text-orange-400` (`ArticleSection.tsx:9-13`)
- Header/padding pattern: `InboxPanel.tsx:92-103`
- Exemplar: `frontend/src/components/home/InboxPanel.tsx`, `frontend/src/components/home/ArticleSection.tsx`

## Changes

1. `frontend/src/components/home/ByodCard.tsx` — shell
   - Change: `FramePanel` gains `p-5`; `FrameHeader` className to `mb-4 flex-row items-center justify-between gap-3 border-b border-border pb-4`; `FrameTitle` to `text-xl font-bold`.
   - Preserve: teal IconTile, "Domains" link button (only when `showDomainsLink`), all form behavior.
   - Verify: header divider spacing and inner padding visually match InboxPanel; title size matches.
2. `frontend/src/components/home/ByodCard.tsx` — "How it works" steps
   - Change: after the paragraph (line 66), add a `STEPS` const (module scope) and render: `<div className="flex flex-col gap-3">` with a `text-sm font-extrabold text-muted-foreground` label `HOW IT WORKS` (matching the RECENT ADDRESSES label style) and 3 rows. Each row: `<div className="flex items-start gap-3">` + `IconTile variant="soft" size="sm"` with tint (blue/teal/orange) containing a bold step number `<span className="text-xs font-extrabold">1</span>` + `<div>` with `text-sm font-semibold` title and `text-xs text-muted-foreground` description:
     1. blue — "Point your MX record" / "Set your root domain's MX to the public target above."
     2. teal — "Submit your domain" / "Add the root domain below; we verify the MX record."
     3. orange — "Get your API key" / "Domain goes public and a free API key is issued."
     No em-dashes in copy.
   - Preserve: paragraph stays above the steps; input + Add Domain button stay below.
   - Verify: steps render in three distinct tints; card bottom whitespace is gone at 1400x900; dark mode readable.
3. No other files change. `/domains` automatically inherits both fixes.

## Scope

- Inherit: `/domains` (renders ByodCard with `showDomainsLink={false}`).
- Verify: `/` and `/domains` light + dark at 1400x900; 390x844 mobile; steps do not wrap awkwardly in the 505px column.
- Exclude: InboxPanel, AddressCard changes; no new tokens/components; no real form submission logic.

## Validation

- Product: ByodCard shell matches InboxPanel; empty space filled with relevant instructions.
- Interface: 1400x900 light/dark (row 2 cards visually balanced); 390x844 (steps stack fine, overflow 0); `/domains` page same checks.
- System: only existing primitives/tokens; TINTS literals identical to ArticleSection.
- Repository: `npm run build` in `frontend/` → tsc + vite build clean.

## Stop conditions

- Stop if `p-5` on FramePanel conflicts with a Frame spacing variant that double-pads (then use the Frame spacing API instead).
- Stop if steps push the card taller than InboxPanel and unbalance row 2 the other way (then drop the label row or shorten descriptions).

## Design documentation

- After acceptance and validation: append outcome to this file's Status line; no other documentation exists to update.
