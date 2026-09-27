# Redesign / (home) workspace as a colorful, modern surface

Status: EXECUTED and verified 2026-09-01 (build clean; light/dark/mobile verified; zero console errors on all 5 routes). Additional changes requested mid-verification and applied: (1) Alerts toggle + Telegram button removed from InboxPanel, address actions Random/Link/Identity equal full-width via `grid grid-cols-3`; (2) inbox header order is Clear Inbox first, then Refresh, both equal width via `grid grid-cols-2`; (3) decorative page background added to ALL routes via shared `frontend/src/components/page-backdrop.tsx` (vendored Magic UI `GridPattern` + two blurred primary/success orbs, radial-mask fade, behind content).

## Evidence chain

- Surface: `/` home — `frontend/src/routes/index.tsx` renders a 2-col workspace grid (`Hero`, `AddressCard`, `InboxPanel`, `ByodCard`) plus below-fold `ArticleSection`, `WhyChoose`, `CompareTable`, `FaqSection`.
- Problems (verified by rendering at 1400x900, light mode, plus source):
  1. The three hero stat mini-cards use identical default-soft `IconTile`s (all primary blue) (`frontend/src/components/home/Hero.tsx:38`). Rendered: three same-blue tiles. The same page's own `ArticleSection.tsx:9-13` defines `TINTS` (blue/teal/orange) and `WhyChoose.tsx:14-50` ships six distinct tints (blue/teal/orange/indigo/violet/cyan); `/domains` and `/statistics` stat grids also carry per-card tones.
  2. Shell drift inside the workspace grid: `ByodCard.tsx:25` renders a ReUI `Frame`/`FramePanel` with a `FrameHeader` containing a teal `IconTile` + `FrameTitle`, while its grid siblings `AddressCard.tsx:154` and `InboxPanel.tsx:90` still render base `ui/card` with plain headers and no icon tiles. Rendered: the two shells are near-identical visually, so the drift is structural plus a missing color accent (ByodCard's teal tile has no counterpart in AddressCard/InboxPanel headers).
  3. Zero entrance motion: `/` mounts everything statically, while every other redesigned route (`/api`, `/help`, `/domains`, `/statistics`) wraps sections in `BlurFade` (exemplar `frontend/src/routes/statistics.tsx:35-56`).
- Design evidence: no `DESIGN.md`. Live system: `frontend/src/index.css` tokens (`--primary`/`--info`/`--success`/`--warning`, mapped to `text-*` utilities), free-tier ReUI (`Badge`, `Frame`, `IconTile`), Magic UI `BlurFade` at `frontend/src/components/ui/blur-fade.tsx`.
- Owner: `frontend/src/components/home/{Hero,AddressCard,InboxPanel}.tsx` + `frontend/src/routes/index.tsx`. `ByodCard.tsx` is the in-surface exemplar and is not edited.
- Scope and affected surfaces: `/` only. No shared primitive is modified.
- Uncertainty: none blocking. The below-fold sections are already colorful (verified in source) and stay untouched.

## Design decision

Bring the home workspace to the colorful-modern language already shipped on the same page (ArticleSection/WhyChoose tints) and on sibling routes, without touching behavior:

- Hero stat tiles get the page's own `blue/teal/orange` tint trio (from `ArticleSection.TINTS`), applied to both the `IconTile` and the value text.
- `AddressCard` and `InboxPanel` move from `ui/card` to ReUI `Frame`/`FramePanel`/`FrameHeader`, matching the `ByodCard` exemplar in the same grid; each header gains a toned `IconTile` (AddressCard = `text-info`, InboxPanel = `text-violet-600 dark:text-violet-400` so the two workspace cards and ByodCard's teal form three distinct hues).
- The route wraps its sections in `BlurFade` per the sibling-route exemplar.
- Keep every control, handler, badge variant, copy string, and mock value identical.

## Reuse

- `@/components/reui/frame` — `Frame`, `FramePanel`, `FrameHeader`, `FrameTitle`. Header pattern (verified in `frontend/src/components/home/ByodCard.tsx:27`): `FrameHeader className="mb-4 flex-row items-center justify-between gap-3 border-b border-border"` with an `IconTile` + `FrameTitle` cluster left and actions right.
- `@/components/reui/icon-tile` — `IconTile variant="soft" size="sm"`, tone via `currentColor` class.
- `@/components/reui/badge` — count badges already used; unchanged variants.
- `@/components/ui/blur-fade` — hero block `offset={10} duration={0.5}`; sections `inView offset={8} duration={0.45}` (exemplar `frontend/src/routes/domains.tsx`).
- Tint strings: reuse the exact literals from `frontend/src/components/home/ArticleSection.tsx:9-13` (`text-blue-600 dark:text-blue-400`, `text-teal-600 dark:text-teal-400`, `text-orange-600 dark:text-orange-400`) plus token utilities `text-info` and the violet pair `text-violet-600 dark:text-violet-400` (precedent `WhyChoose.tsx:43`).
- No new dependencies, tokens, or colors.

## Changes

1. `frontend/src/components/home/Hero.tsx`
   - Change: add a static `tint` string per stat card — Active Domains `text-blue-600 dark:text-blue-400`, Processed `text-teal-600 dark:text-teal-400`, Email Retention Period `text-orange-600 dark:text-orange-400` — and apply it via `cn()` to the `IconTile` className and to the value `div` (`cn("text-base font-extrabold leading-[24.8px]", tint)`). Import `cn` from `@/lib/utils`. Cards stay `ui/card`.
   - Preserve: values, labels, icons, grid breakpoints, `min-h-[118px]`.
   - Verify: three distinct tile + value hues in light and dark.
2. `frontend/src/components/home/AddressCard.tsx`
   - Change: swap `Card`/`CardContent` for `Frame`/`FramePanel` (`className="flex flex-col gap-5 p-5 min-[576px]:p-8"` moves to `FramePanel`); wrap the "CURRENT ADDRESS" + address block and the copy `Tooltip` button in `FrameHeader className="flex-row items-start justify-between gap-3 border-b border-border pb-4"` — the left cluster becomes `IconTile variant="soft" size="sm"` (`text-info`, `Mail` icon from lucide-react) + the existing label/address block. Keep the Tooltip button as the header's right-side action. Remove the now-unused `ui/card` import; add `Frame`/`FramePanel`/`FrameHeader` and `Mail` imports.
   - Preserve: every input, Select, Button, Collapsible, Dialog, handler, and copy string; `state` prop contract unchanged.
   - Verify: copy tooltip still works; Random/Link/Identity behave identically; Frame shell matches ByodCard.
3. `frontend/src/components/home/InboxPanel.tsx`
   - Change: swap `Card`/`CardContent` for `Frame`/`FramePanel` (`className="p-5"`); the header row becomes `FrameHeader className="mb-4 flex-row flex-wrap items-center justify-between gap-3 border-b border-border pb-4"` with left cluster = `IconTile variant="soft" size="sm"` (`text-violet-600 dark:text-violet-400`, `Inbox` icon from lucide-react) + `FrameTitle className="text-xl font-bold"` "Inbox" + the existing count `Badge`; right side keeps Refresh / Clear Inbox / Alerts / Telegram exactly as-is. Remove the `ui/card` import; add Frame imports and `Inbox` to the lucide import.
   - Preserve: `EmailRow`, `CodeChip`, empty state (muted `MailOpen` tile), skeletons, all handlers, and all copy.
   - Verify: Refresh spin, Clear, Alerts toggle, Telegram link, and code-chip copy all still work.
4. `frontend/src/routes/index.tsx`
   - Change: wrap the workspace grid `div` in `<BlurFade offset={10} duration={0.5}>`; wrap `ArticleSection`, `WhyChoose`, `CompareTable`, and `FaqSection` containers each in `<BlurFade inView offset={8} duration={0.45}>`. Add the `BlurFade` import. No layout, grid, or state changes.
   - Preserve: grid classes, DOM order (hero → address → inbox → byod), all props.
   - Verify: sections animate in; zero layout shift; desktop 2-col placement unchanged.

## Scope

- Inherit: none — all edits are internal to home components plus the route; no shared component signatures change.
- Verify: `ByodCard`, `ArticleSection`, `WhyChoose`, `CompareTable`, `FaqSection` render unchanged; other routes untouched.
- Exclude: backend, mock data, email row content, any new colors/tokens, ReUI Pro items, new dependencies.

## Validation

- Product: hero stats show blue/teal/orange; AddressCard and InboxPanel render in Frame shells with info/violet header tiles matching the ByodCard exemplar; entrance animations play; all controls (copy, randomize, prefix edit, domain select, refresh, clear, alerts toggle, telegram link, code-chip copy) still work.
- Interface: route `/`; viewports 1400x900 and 390x844 (workspace stacks; assert `document.documentElement.scrollWidth === clientWidth`); light and dark (`localStorage.setItem("color-scheme","dark")` + reload; recheck blue/violet tones on dark surfaces); zero console errors (re-inject listeners after each `goto`); tab title unchanged; zero em-dashes in changed copy.
- System: `grep` confirms no remaining `ui/card` import in `AddressCard.tsx` / `InboxPanel.tsx`; tone classes are token utilities or the exact palette tints cited.
- Repository: `cd frontend && npm run build` → `tsc --noEmit && vite build` passes.

## Stop conditions

- Stop if the Frame shell breaks the AddressCard collapsible or dialog layout (fall back to `ui/card` for that card only, record the substitution).
- Stop if scope widens beyond `/`.

## Design documentation

- After acceptance and validation: none. Per root `AGENTS.md`, this plan lives at `docs/frontend/home-colorful-modern.md`; no other documentation exists to update.
