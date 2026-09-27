# Redesign /statistics as a colorful, modern surface

Status: EXECUTED and verified 2026-09-01 (build clean; light/dark/mobile verified in browser; zero console errors).

## Evidence chain

- Surface: `/statistics` — Vite + React 19 + TanStack Router SPA. Route `frontend/src/routes/statistics.tsx` renders `StatsHero`, `StatCards`, a 2-col grid of `HourlyChart` + `StatsSummary`, and `TopLists` inside `max-w-[1320px] px-4 py-12`, under a fixed 72px header.
- Problems (verified by rendering at 1400x900, light mode, plus source):
  1. All four stat cards use the identical `IconTile variant="soft" ... text-primary` (`frontend/src/components/statistics/StatCards.tsx:34`). Rendered: four identical medium-blue tiles (Inbox / ChartColumn / BookOpen / Globe) with black numbers. The sibling stat grid on `/domains` now ships four distinct tones (`frontend/src/components/domains/DomainStats.tsx`: info / success / violet / warning), and the user direction for this surface is "colorful modern style".
  2. The hero is boxed in a `Card` (`frontend/src/components/statistics/StatsHero.tsx:15-45`) while every sibling hero — `/domains` (`frontend/src/components/domains/DomainsHero.tsx:7` plain section), `/api`, `/help` — renders unboxed: badge + h1 + lede directly on the page background.
  3. The three top-list cards are monotone blue: every rank badge is primary-hued (`TopLists.tsx:33` — `default` for ranks 1-3, `primary-light` for 4-10) and every progress bar renders `bg-primary` (`frontend/src/components/ui/progress.tsx:48`). Rendered: three visually identical blue lists. No entrance motion anywhere on the page, while `/api`, `/help`, and `/domains` all ship `BlurFade` entrances.
- Design evidence: no `DESIGN.md`. Live system: `frontend/src/index.css` tokens (`--primary #228be6` light / `#74c0fc` dark; `--success #12b886` / `#63e6be`; `--info #228be6` / `#74c0fc`; `--warning #fd7e14` / `#ffa94d`; exposed as `text-primary/info/success/warning` utilities), free-tier ReUI in `frontend/src/components/reui/*` (Badge, Frame, IconTile), Magic UI `BlurFade` at `frontend/src/components/ui/blur-fade.tsx`.
- Owner: `frontend/src/components/statistics/{StatsHero,StatCards,HourlyChart,StatsSummary,TopLists}.tsx` + `frontend/src/routes/statistics.tsx`.
- Scope and affected surfaces: `/statistics` only. `ui/progress` and other shared primitives are NOT modified — per-list bar colors are applied at the consumer via className override.
- Uncertainty: none blocking. The chart's blue-green-orange gradient line (`HourlyChart.tsx:112-135`) is already colorful and stays untouched. An empty right column region below the summary card at mid-scroll (summary 470px vs taller chart card) was evaluated and rejected: corrections are ambiguous (stretch vs rebalance), no contract.

## Design decision

Bring `/statistics` to the colorful-modern language already shipped on `/domains`, `/api`, `/help`, without touching data behavior:

- Unbox the hero to a plain section matching `DomainsHero`; keep the "Window: 24h" success badge and the Refresh button right-aligned in the same row.
- Four distinct stat tones mirroring `/domains`: All-time Emails = `text-info`, 24h Emails = `text-success`, Unique Subjects = `text-violet-600 dark:text-violet-400`, Site Domains = `text-warning`; numbers carry the same tone as their tile.
- Per-list accent hues in TopLists: Subjects = primary, Domains = success, Senders = warning — applied to rank badges (top-3 solid variant, 4-10 `-light` variant) and progress bars.
- HourlyChart, StatsSummary, and each TopLists card move from `ui/card` to ReUI `Frame`/`FramePanel` + `FrameHeader`; all sections get `BlurFade` entrances per the `/domains` exemplar.
- Keep every value, label, badge variant elsewhere, chart geometry, and refresh jitter identical.

## Reuse

- `@/components/reui/frame` — `Frame`, `FramePanel`, `FrameHeader`, `FrameTitle`. `FrameHeader` is `flex flex-col` by default; override with `flex-row items-center justify-between gap-3 border-b border-border` for title-plus-actions rows (verified pattern in `frontend/src/components/domains/DomainInventory.tsx`).
- `@/components/reui/icon-tile` — `IconTile variant="soft" size="sm"`, tone via `currentColor` class (`text-info` etc.).
- `@/components/reui/badge` — variants used here: `primary-light`, `success-light`, `warning-light`, `default`, `success`, `warning`, `invert`; `radius="full"`.
- `@/components/ui/progress` — root `className` accepts arbitrary variant selectors; recolor the indicator per list with `[&_[data-slot=progress-indicator]]:bg-success` (and `bg-warning`), leaving the primitive untouched.
- `@/components/ui/blur-fade` — hero `offset={10} duration={0.5}`; sections `inView offset={8} duration={0.45}` (exemplar: `frontend/src/routes/domains.tsx`).
- lucide-react icons already imported; unchanged.
- No new dependencies, tokens, or colors.

## Changes

1. `frontend/src/components/statistics/StatsHero.tsx`
   - Change: remove the `Card`/`CardContent` wrapper; render a plain `<section className="flex flex-col items-stretch gap-8 min-[992px]:flex-row min-[992px]:items-start min-[992px]:justify-between">` containing the existing badge + h1 + lede block on the left and the "Window: 24h" badge + Refresh button row on the right, exactly as today. Drop the `ui/card` import.
   - Preserve: all copy, `BRAND_NAME` interpolation, refresh spin behavior, both badges.
   - Verify: hero sits directly on the page background like `/domains`; Refresh still spins ~600ms.
2. `frontend/src/components/statistics/StatCards.tsx`
   - Change: extend `CARDS` with a static `tone` string per card — allTime `text-info`, emails24h `text-success`, uniqueSubjects `text-violet-600 dark:text-violet-400`, siteDomains `text-warning` — and apply it via `cn()` to both the `IconTile` className and the value `<p>` (`cn("text-xl font-extrabold leading-[33px]", tone)`). Keep cards as `ui/card` (matches the `/domains` stat grid).
   - Preserve: grid breakpoints, `formatStat`, labels, icon set.
   - Verify: four distinct tile + number colors in light and dark.
3. `frontend/src/components/statistics/HourlyChart.tsx`
   - Change: swap `Card`/`CardContent` for `Frame`/`FramePanel`; header row becomes `FrameHeader className="mb-4 flex-row flex-wrap items-center justify-between gap-3 border-b border-border"` with the title/subtitle block left and the existing chevron buttons + badges cluster right (wrap them in a plain `div`, not FrameTitle). Chart SVG, gradients, axis labels, and the disabled chevron buttons stay byte-identical.
   - Preserve: geometry constants, gradient defs (`stats-area`, `stats-line`), point tooltips, all copy.
   - Verify: line/area render identically; badges "Last 24 hours" and the invert total pill unchanged.
4. `frontend/src/components/statistics/StatsSummary.tsx`
   - Change: swap `Card`/`CardContent` for `Frame`/`FramePanel`; keep the window-total block, conic-gradient ring (`var(--success)` / `var(--border)`), `Separator`, and the three rows exactly as-is. No header added (the block is self-explanatory and the plan does not invent copy).
   - Preserve: `pct` computation, all copy, ring sizing.
   - Verify: ring percentage and rows render identically in light and dark.
5. `frontend/src/components/statistics/TopLists.tsx`
   - Change: introduce a per-list accent derived from index — `["primary", "success", "warning"][i]` mapped to concrete classes: rank badges `i < 3` use variant `default` / `success` / `warning`; ranks 4-10 use `primary-light` / `success-light` / `warning-light`; progress root gets `["[&_[data-slot=progress-indicator]]:bg-primary", "[&_[data-slot=progress-indicator]]:bg-success", "[&_[data-slot=progress-indicator]]:bg-warning"][listIndex]` appended via `cn()`. Swap each `Card`/`CardContent` for `Frame`/`FramePanel`; the title + count badge row becomes `FrameHeader className="mb-4 flex-row items-center justify-between gap-4 border-b border-border"` with `FrameTitle className="text-lg font-bold"`. All class strings static (Tailwind literal requirement).
   - Preserve: masking/truncation of labels (`title` attr + `truncate`), `formatStat` counts, `Progress` values, count badge showing `list.rows.length`.
   - Verify: three lists render blue / teal / orange accents; 10 rows each; bars proportional.
6. `frontend/src/routes/statistics.tsx`
   - Change: wrap `StatsHero` in `<BlurFade offset={10} duration={0.5}>`; wrap `StatCards`, the chart/summary grid `div`, and `TopLists` each in `<BlurFade inView offset={8} duration={0.45}>`. Add the `BlurFade` import. No layout or state changes.
   - Preserve: `handleRefresh` guard and 600ms spinner, all prop drilling.
   - Verify: sections animate in on scroll; zero layout shift.

## Scope

- Inherit: none — no shared component signatures change (all edits are internal to statistics components plus local classNames).
- Verify: `/domains`, `/`, `/api`, `/help` untouched (no shared file is edited).
- Exclude: backend, mock data values, chart geometry, pagination/sorting (none here), ReUI Pro items, Motion Icons, new dependencies.

## Validation

- Product: hero unboxed with working Refresh; four colored stat cards; chart + summary + top lists in Frame shells; three accent hues across top lists; entrance animations play.
- Interface: route `/statistics`; viewports 1400x900 and 390x844 (grid stacks, no horizontal overflow: `document.documentElement.scrollWidth === clientWidth`); light and dark (`localStorage.setItem("color-scheme","dark")` + reload — recheck the violet tone against the dark surface); zero console errors (re-inject listeners after each `goto`); tab title `Statistics | Xgmail`; zero em-dashes in changed copy.
- System: `grep` confirms `ui/card` imports remain only in `StatCards.tsx` among statistics components; tone classes are token utilities or the `text-violet-600 dark:text-violet-400` palette tint only.
- Repository: `cd frontend && npm run build` → `tsc --noEmit && vite build` passes.

## Stop conditions

- Stop if `FrameHeader` cannot host the chart's title-plus-controls row (fall back to the existing flex row inside `FramePanel`, record the substitution).
- Stop if the violet stat tone fails dark-mode contrast at render (fall back to `text-info`, record).
- Stop if scope widens beyond `/statistics`.

## Design documentation

- After acceptance and validation: none. Per root `AGENTS.md`, this plan lives at `docs/frontend/statistics-colorful-modern.md`; no other documentation exists to update.
