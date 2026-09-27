# Redesign /domains as a colorful, modern surface

Written against: no git commit available (repository has no commits; `frontend/` is untracked). Source state as of 2026-09-01, after the completed `/api` and `/help` redesigns.

Status: EXECUTED and verified 2026-09-01. During execution the user added scope: a domain search input in the inventory header (recorded in change 4).

## Evidence chain

- Surface: `/domains` — Vite + React 19 + TanStack Router SPA. Route `frontend/src/routes/domains.tsx` renders `DomainsHero`, `DomainStats`, `ByodCard` (shared from `home/`), `DomainInventory` inside `max-w-[1320px] px-4 py-12`, under a fixed 72px header.
- Problem (verified by rendering + DOM inspection, light mode, 1400x900):
  1. The BYOD card renders a link-styled button labeled "Domains" pointing to `/domains` — the page the user is already on. Proven: `frontend/src/components/home/ByodCard.tsx:32-38` renders `Button variant="link" render={<Link to="/domains" />}`; `frontend/src/routes/domains.tsx:35` renders `<ByodCard />`; DOM shows `a[href="/domains"]` with text "Domains" on `location.pathname === "/domains"`. Self-referential navigation with no destination value.
  2. All four stat cards use the identical `IconTile variant="soft" ... text-primary` (`frontend/src/components/domains/DomainStats.tsx:19,35`). Rendered: four identical blue tiles for Total / Active / Valid MX / MX target. The user direction for this surface is "colorful modern style"; the token system provides success/info/warning hues and the home page establishes multi-hue tile tints (`frontend/src/components/home/WhyChoose.tsx`, `ArticleSection.tsx`).
  3. `ByodCard` and `DomainInventory` still render as flat `ui/card` shells with no entrance motion, while the app's redesigned documentation surfaces (`/api` — `frontend/src/components/api/ApiContent.tsx`, `/help` — `frontend/src/components/help/HelpContent.tsx`) establish ReUI `Frame`/`FramePanel` + Magic UI `BlurFade` as the section-shell language.
- Design evidence: no `DESIGN.md`. Live system: `frontend/src/index.css` tokens (`--primary #228be6` light / `#74c0fc` dark; semantics `--success #12b886`, `--info #228be6`, `--warning #fd7e14`; dark `#63e6be`/`#74c0fc`/`#ffa94d`; all exposed as `--color-*` so `text-success`, `text-info`, `text-warning`, `text-destructive` utilities exist), free-tier ReUI in `frontend/src/components/reui/*`, Magic UI `blur-fade` + `shine-border` in `frontend/src/components/ui/`.
- Owner: `frontend/src/components/domains/{DomainsHero,DomainStats,DomainInventory}.tsx` + `frontend/src/routes/domains.tsx`; shared `frontend/src/components/home/ByodCard.tsx` (also rendered on `/`).
- Scope and affected surfaces: `/domains` primarily; `ByodCard` gains a prop consumed by two routes (`/` keeps the link, `/domains` hides it).
- Uncertainty: none blocking. ReUI `Badge` variants verified by computed styles: Active/Valid = success-light teal (fg `rgb(6,95,70)`), Unknown/Invalid = warning-light orange, Inactive = secondary gray — all correct, do not change.

## Design decision

Bring `/domains` up to the same colorful-modern language already shipped on `/api` and `/help`, without touching data behavior:

- Remove the self-referential "Domains" link when `ByodCard` renders on `/domains`.
- Give the four stat cards distinct semantic tones from existing tokens: Total = `text-info`, Active = `text-success`, Valid MX = `text-primary`, MX target = `text-warning`. Match each stat value's number color to its tile tone for the colorful read; the MX-target cell keeps its mono `code` chip neutral (it is a value to copy, not a metric).
- Swap `ui/card` shells for ReUI `Frame`/`FramePanel` (+ `FrameHeader`/`FrameTitle`) on `ByodCard` and `DomainInventory`, and wrap hero, stats grid, BYOD, and inventory in `BlurFade` entrances — the exact `ApiContent.tsx` pattern.
- Keep every badge, column, pagination, refresh jitter, and copy string identical.

## Reuse

- `@/components/reui/frame` — `Frame`, `FramePanel`, `FrameHeader`, `FrameTitle`. Frame root spreads `...props`. Exemplar: `Section` helper, `frontend/src/components/api/ApiContent.tsx:266-278`.
- `@/components/ui/blur-fade` — `BlurFade` with `inView offset={8} duration={0.45}`; hero `offset={10} duration={0.5}`. Exemplar: `ApiContent.tsx`, `HelpContent.tsx`.
- `@/components/reui/icon-tile` — `IconTile variant="soft" size="sm"`; tone via `currentColor`, so `className="text-success"` retints the whole tile (verified in source, lines 23-25 of `icon-tile.tsx`).
- `@/components/reui/badge`, `@/components/reui/alert` — already used on this surface; unchanged.
- lucide-react icons — `Database`, `Check`, `ShieldCheck`, `Globe` already imported; unchanged.
- No new dependencies, no new tokens, no new colors. `ui/card` import leaves `DomainStats.tsx`, `DomainInventory.tsx`, and `ByodCard.tsx` (BYOD moves to Frame).

## Changes

1. `frontend/src/components/home/ByodCard.tsx`
   - Change: add an optional prop `showDomainsLink?: boolean` (default `true`). Render the existing `Button variant="link" ... Domains` only when `showDomainsLink` is true. Also swap the `Card`/`CardContent` shell for `Frame`/`FramePanel` + `FrameHeader` with `FrameTitle` ("Bring Your Own Domain"), keeping the IconTile (`text-teal-600 dark:text-teal-400`), the info `Alert` with the MX target `code`, the explainer paragraph, the labeled Input, and the unwired "Add Domain" button exactly as-is.
   - Preserve: `rootDomain` state, input wiring, all copy, the intentionally unwired Add Domain button.
   - Verify: on `/` the "Domains" link still renders and navigates to `/domains`; on `/domains` it is absent and the header row still aligns (title left, nothing right).
2. `frontend/src/routes/domains.tsx`
   - Change: render `<ByodCard showDomainsLink={false} />`. Wrap `<DomainsHero />` in `<BlurFade offset={10} duration={0.5}>`; wrap `<DomainStats />`, `<ByodCard />`, `<DomainInventory />` each in `<BlurFade inView offset={8} duration={0.45}>`. Add the imports.
   - Preserve: stats state, `handleRefresh` re-entry guard and 600ms spinner, prop drilling unchanged.
   - Verify: no self-link in DOM on `/domains`; sections animate in on scroll.
3. `frontend/src/components/domains/DomainStats.tsx`
   - Change: extend `CELLS` with a `tone` field — Total `text-info`, Active `text-success`, Valid MX `text-primary` — and apply it to both the `IconTile` (`className={cn("shrink-0", tone)}`) and the value span (`className={cn("text-lg font-extrabold leading-[28.8px]", tone)}`). The 4th MX-target cell: tile `text-warning`, `code` chip and label unchanged. Static tone strings only (Tailwind must see the class literals).
   - Preserve: grid breakpoints, values, labels, `TEMPMAIL_MX_TARGET` interpolation.
   - Verify: four distinct tile colors render in light and dark; numbers readable in both.
4. `frontend/src/components/domains/DomainInventory.tsx`
   - Change: swap `Card`/`CardContent` for `Frame`/`FramePanel`; header row becomes `FrameHeader className="border-b border-border"` with `FrameTitle className="text-lg font-bold"` "Domain Inventory" and the Refresh `Button` pushed right (`FrameHeader` is a flex row — match the ApiContent header layout; if FrameHeader does not support the right-aligned button, keep the existing `flex h-9 items-center justify-between` row inside FramePanel instead). DataGrid, columns, badges, pagination untouched.
   - Added during execution (user request "add search domain"): a search `Input` (`type="search"`, placeholder "Search domain", `Search` lucide icon) sits left of the Refresh button in the `FrameHeader`. It filters rows client-side (`useMemo` over `row.name`, case-insensitive substring), resets `pageIndex` to 0 on query change via `useEffect`, and drives `recordCount` so pagination shows the filtered total.
   - Preserve: table features, pageSize 10, Refresh spin behavior, badge variants exactly as verified.
   - Verify: grid renders 36 rows at 10/page, pagination and Domain-column sorting still work.
5. `frontend/src/components/domains/DomainsHero.tsx` — unchanged (badge + h1 + lede already conform).
   - Verify: hero appears inside its BlurFade wrapper from change 2.

## Scope

- Inherit: `/` (ByodCard keeps the link via default prop, gains the Frame shell — visual upgrade consistent with the system).
- Verify: `/` BYOD block still renders and its link navigates; `/domains` has no `a[href="/domains"]` outside the header nav.
- Exclude: backend, mock data, badge semantics, pagination behavior, other routes, new dependencies, ReUI Pro items, Motion Icons.

## Validation

- Product: `/domains` — no self-link; four colored stat tiles; BYOD and inventory in Frame shells; entrance animations play; refresh spins ~600ms; grid sorts and paginates.
- Interface: route `/domains`; viewports 1400x900 and 390x844; light and dark (`localStorage.setItem("color-scheme","dark")` + reload); scroll to bottom (pagination visible); zero console errors (re-inject listeners after each `goto`); tab title `Domains | Xgmail`. Also load `/` and confirm the BYOD "Domains" link still works there.
- System: `grep` confirms no `ui/card` import remains in the three changed components; no em-dashes (`—`, `–`) in changed copy; tone classes are from the five token utilities only.
- Repository: `cd frontend && npm run build` → `tsc --noEmit && vite build` passes.

## Stop conditions

- Stop if `FrameHeader` cannot host the title-plus-action row (fall back to the existing flex header inside `FramePanel`, record the substitution).
- Stop if a stat tone fails dark-mode contrast at render (fall back: keep tiles toned, numbers `text-foreground`).
- Stop if scope widens beyond `/domains` + the ByodCard prop.

## Design documentation

- After acceptance and validation: none. Per root `AGENTS.md`, this plan lives at `docs/frontend/domains-colorful-modern.md`; no other documentation exists to update.
