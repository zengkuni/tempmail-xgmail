# Redesign /help as a colorful, modern documentation surface

Written against: no git commit available (repository has no commits; `frontend/` is untracked). Source state as of 2026-09-01.

## Evidence chain

- Surface: `/help` — Vite + React 19 + TanStack Router SPA. Route wrapper `frontend/src/routes/help.tsx` renders `frontend/src/components/help/HelpContent.tsx` inside `max-w-[1140px] px-4 py-12`, under a fixed 72px header (`frontend/src/components/shared/Header.tsx`, root adds `main pt-[72px]`).
- Problem (verified by rendering, light + dark + 390px mobile):
  1. The left rail nav (`hidden lg:flex`, `data-scrollspy-anchor` links) never shows its authored `data-[active=true]` state while scrolling, because `HelpContent.tsx` renders `<Scrollspy offset={90} history={false}>` without `targetRef`; `frontend/src/components/reui/scrollspy.tsx` returns early from both `onScroll` and `handleScroll` when `targetRef.current` is undefined. Rendered mid-page screenshot shows zero active items.
  2. Below `lg` there is no section navigation at all (11 sections, no wayfinding).
  3. Presentation is monochrome: 10 flat white `Card` blocks of prose, one blue accent, no icons, no semantic color coding. The user direction for this surface is "colorful modern style".
- Design evidence: no `DESIGN.md` or design docs exist. The live design system is `frontend/src/index.css` brand tokens (light `--primary: #228be6`, dark `#74c0fc`; light semantics `--success: #12b886`, `--info: #228be6`, `--warning: #fd7e14`; dark `#63e6be` / `#74c0fc` / `#ffa94d`), shadcn `base-nova` primitives in `frontend/src/components/ui/*`, free-tier ReUI components in `frontend/src/components/reui/*` (badge, scrollspy, stepper, alert, frame, timeline, code-block, icon-tile, and others), and Magic UI components `frontend/src/components/ui/blur-fade.tsx` + `frontend/src/components/ui/shine-border.tsx` (installed from `https://magicui.design/r/*.json`, depend on the `motion` package, already in `package.json`).
- Owner: `frontend/src/components/help/HelpContent.tsx` (single-file surface; only consumer is `frontend/src/routes/help.tsx`).
- Scope and affected surfaces: `HelpContent.tsx` only. Header, footer, other routes unchanged.
- Uncertainty: `frontend/src/components/reui/icon-tile.tsx` props must be read before use (it is installed; used elsewhere in the app). Everything else below is verified API.

## Design decision

Rebuild `HelpContent.tsx` presentation on the colorful semantic palette the token system already provides, reusing the proven `/api` page patterns (`frontend/src/components/api/ApiContent.tsx` is the exemplar, just delivered and browser-verified in both modes and at 390px):

- Each of the 10 content sections becomes a ReUI `Frame` + `FramePanel` card headed by an `IconTile` (lucide icon) + title, with a per-section semantic accent color drawn only from existing Badge variants: `primary-light`, `info-light`, `success-light`, `warning-light`, `destructive-light`. No new colors, no new tokens.
- Safety/privacy sentences become ReUI `Alert` callouts (`variant="warning"` / `variant="destructive"` as content dictates) instead of inline prose.
- The 4-step `Stepper` keeps its behavior and moves into a `Frame` panel; the hero keeps its badge/title/sub copy.
- Nav rail: fix scrollspy by passing `targetRef`; add the mobile sticky pill bar; both copy the `/api` implementation.
- Motion via Magic UI `BlurFade` (`inView`) on sections, matching `/api`. Motion intensity stays restrained (entrances only, no loops except nothing).

All copy, section ids, slugs, and information architecture stay identical. This is a preserve-mode redesign: same content, colorful modern presentation.

## Reuse

- `@/components/reui/frame` — `Frame`, `FramePanel`, `FrameHeader`, `FrameTitle`. Frame root spreads `...props` (accepts `id`, `className`); `FramePanel` is the white card surface. Exemplar: `Section` helper in `frontend/src/components/api/ApiContent.tsx`.
- `@/components/reui/badge` — variants `primary-light`, `info-light`, `success-light`, `warning-light`, `destructive-light`; prop `radius="full"`.
- `@/components/reui/alert` — `Alert`, `AlertTitle`, `AlertDescription`; variants `default/destructive/info/success/warning`.
- `@/components/reui/icon-tile` — read `frontend/src/components/reui/icon-tile.tsx` for its exact props before writing code; it is the colored icon container used on the home page (see `frontend/src/components/home/*` for a usage exemplar).
- `@/components/reui/scrollspy` — `Scrollspy` with `targetRef`, `offset`, `history`; anchors via `data-scrollspy-anchor="<section id>"`, per-anchor override `data-scrollspy-offset={140}` for mobile pills.
- `@/components/reui/stepper` — already used; keep. WARNING: `StepperTitle`/`StepperDescription` call `useStepItem` and crash inside `StepperPanel`; the current code already avoids this — preserve that workaround (plain `<p>` for panel titles on mobile).
- `@/components/ui/blur-fade` — `BlurFade` with `inView offset={8} duration={0.45}`; stagger grids with `delay={index * 0.06}`.
- `@/components/ui/accordion` — available if long sections need collapsing; optional.
- lucide-react icons — already a dependency; one icon per section.
- Exemplar for everything above: `frontend/src/components/api/ApiContent.tsx`.

Do not introduce new dependencies, new colors, or new CSS tokens. Do not import `ui/card` (the surface migrates to ReUI `Frame`, per the user's all-ReUI directive already applied on `/api`).

## Changes

1. `frontend/src/components/help/HelpContent.tsx` — full presentation rewrite.
   - Change: add `const scrollTargetRef = useRef<Document>(document);` in `HelpContent` and pass `targetRef={scrollTargetRef}` to `Scrollspy` (verbatim exemplar in `ApiContent.tsx`). This alone fixes the dead active state.
   - Change: copy the two nav blocks from `ApiContent.tsx` and adapt labels to `NAV_ITEMS`: (a) desktop rail — `hidden lg:sticky lg:top-[96px] w-[228px] lg:flex` with "On this page" label and left-border active indicator (`data-[active=true]:border-primary data-[active=true]:font-medium data-[active=true]:text-foreground`); (b) mobile pill bar — `sticky top-[72px] z-40 -mx-4 border-b bg-background/85 px-4 py-2.5 backdrop-blur lg:hidden`, horizontally scrollable pills with `data-scrollspy-offset={140}` and `data-[active=true]:border-primary/20 data-[active=true]:bg-primary/10 data-[active=true]:text-primary`. The `-mx-4 px-4` matches the route wrapper's `px-4`.
   - Change: replace the `HelpPaper` card with a `Frame`-based section: `Frame id={id} className="scroll-mt-[140px] lg:scroll-mt-24"` → `FramePanel` → header row = `IconTile` (accent color per section) + `FrameTitle` (`text-lg font-bold`) → body. Wrap each `Frame` in `<BlurFade inView offset={8} duration={0.45}>`.
   - Change: assign each section a semantic accent + lucide icon (single source of truth = a `SECTION_META: Record<string, { icon: LucideIcon; accent: "primary-light" | "info-light" | "success-light" | "warning-light" | "destructive-light" }>` map at the top of the file):
     - `getting-started` — `Sparkles`, `primary-light`
     - `section-1` Creating an inbox — `Mail`, `info-light`
     - `section-2` Managing messages — `Inbox`, `success-light`
     - `section-3` Reading safely — `ShieldAlert`, `warning-light`
     - `section-4` Public domains — `Globe`, `primary-light`
     - `section-5` Private domains — `Lock`, `info-light`
     - `section-6` Telegram monitoring — `Send`, `success-light`
     - `section-7` Developer API — `Code2`, `primary-light`
     - `section-8` Privacy & retention — `ShieldCheck`, `destructive-light`
     - `section-9` Troubleshooting — `Wrench`, `warning-light`
     - Reorder map colors if the executor finds a section whose semantic meaning conflicts; hues must stay within the five listed variants.
   - Change: safety/privacy sentences become alerts inside their sections instead of plain paragraphs:
     - `getting-started` paragraph 2 ("Anyone who knows the full public email address…") → `Alert variant="warning"` with `AlertTitle` "Public inboxes are address-based".
     - `section-8` paragraph 2 ("Do not receive passwords, recovery links…") → `Alert variant="destructive"` with `AlertTitle` "Not for sensitive data".
     - Keep the sentences as `AlertDescription` copy verbatim.
   - Change: hero (`HelpHero`) keeps copy; wrap in `<BlurFade offset={10} duration={0.5}>`; keep the `Badge variant="primary-light" radius="full"` eyebrow (it is the single allowed eyebrow label on the page; the "On this page" rail label is a nav label, not an eyebrow).
   - Change: `HelpSteps` keeps the Stepper logic (`useState(1)`, `onValueChange`) but swaps `Card`/`CardContent` for `Frame`/`FramePanel`; add a `FrameHeader` with `FrameTitle` "How it works".
   - Preserve: all copy strings (`STEPS`, `INTRO_PARAGRAPHS`, `SECTIONS` including ids/titles/navLabels/paragraphs/lists), stepper interactivity, `BRAND_NAME`/`MAIL_DOMAIN` interpolation, scroll-mt anchor behavior, light + dark token compatibility (all accents are token-driven `-light` badge variants, which already render correctly in dark mode on `/api` and `/domains`).
   - Verify: rendered `/help` shows colored icon tiles per section, two alert callouts, working rail active state on scroll, pill bar on mobile.
2. No other files change. `frontend/src/routes/help.tsx`, header, footer, tokens stay as-is.
   - Verify: `git status`-equivalent diff touches only `HelpContent.tsx`.

## Scope

- Inherit: `/help` route only (single consumer).
- Verify: no other route imports `HelpContent` or `HelpPaper`.
- Exclude: backend, other routes, token changes, new dependencies, ReUI Pro items (card/button/select primitives are license-gated — do not attempt to install them; the `ui/*` base layer stays because ReUI's own free components import it), Motion Icons (Ultimate-gated — lucide only).

## Validation

- Product: open `/help`; every section reachable via rail and pill nav; active item tracks scroll position on desktop and mobile; stepper still switches panels; alerts render with icon + title + copy.
- Interface: route `/help`; states: top of page, mid-scroll, bottom; viewport 1400x900 and 390x844; light and dark (`localStorage.setItem("color-scheme", "dark")` + reload); zero console errors per route (re-inject error listeners after each `goto`); tab title reads `Help | Xgmail`.
- System: confirm every accent class resolves to the five listed Badge variants; confirm no `ui/card` import remains in `HelpContent.tsx`; confirm no em-dashes (`—`, `–`) in any user-visible string.
- Repository: `cd frontend && npm run build` → `tsc --noEmit && vite build` completes with no type errors.

## Stop conditions

- Stop if `icon-tile` props cannot express a colored icon container (then fall back to a plain colored Badge-wrapped lucide icon using the same variant names, and record the substitution).
- Stop if the user supplies a ReUI license key mid-task (re-plan around Pro primitives instead of working around them).
- Stop if scope widens beyond `/help` (other pages were already redesigned; do not touch them).

## Design documentation

- After acceptance and validation: none. No design documentation exists; creating `DESIGN.md` is out of scope unless the user asks.
