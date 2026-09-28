# Mobile Modern Style — Home Workspace

Date: 2026-09-29. Scope: mobile-only visual/layout modernization of the home
page workspace and its cards. Desktop (< 992px) layout and boxes are frozen
and re-measured after every change.

## Direction

The tool is the product on a phone: current address + inbox first (already
ordered in `92dc515`), marketing below. Modern mobile style here means
phone-native ergonomics, not decoration: touch-sized controls (44px primary
actions, 40px secondary), tighter vertical rhythm (24px between sections,
40px module padding), an address-first typographic hierarchy, and a
horizontal snap strip for recent addresses instead of a wrapped chip cloud.

## Decisions

- **Tap targets**: address-card action buttons `h-11` (44px), inbox
  Clear/Refresh `h-9`, row delete `h-10`, inputs/select `h-11` on mobile;
  all restore to desktop sizes via `min-[576px]:` / `min-[992px]:` classes.
- **Press feedback**: one utility class `press-scale`
  (`frontend/src/index.css`) — `scale(0.97)` on `:active` under
  `@media (hover: none)` only; desktop pointer devices unaffected.
- **Rhythm**: workspace `gap-6` mobile (24px) vs `gap-8` desktop (32px);
  marketing sections `py-10` mobile vs `py-16` desktop.
- **Hierarchy**: `CURRENT ADDRESS` / `RECENT ADDRESSES` labels at 11px with
  `0.08em` tracking (data labels, not decorative kickers); address headline
  19px mobile / 22px desktop.
- **Recent addresses**: mobile = horizontal `snap-x` strip, chips
  `snap-start shrink-0`, `pb-0.5` for shadow room; desktop = original wrap.
- **Browser surfaces** (craft floor): `::selection` tinted from
  `--primary`; `-webkit-tap-highlight-color: transparent` and
  `overscroll-behavior-y: contain` on body under 991px.
- **Declined**: sticky address bar, bottom sheets, gradient/glass
  decoration, new fonts — no identity need, all would add structure the
  surface does not ask for.

## Evidence (measured via CDP, headless profile)

Mobile 390x844: `innerWidth=390`, `matchMedia('(min-width:992px)')=false`,
`scrollWidth=380` (no horizontal overflow), header 56px, Random button
44px, address→inbox gap 32px (stack `gap-8` unchanged), stack→hero 24px,
order: stack (y=120, h=796) → hero (y=940) → byod (y=1726).

Desktop 1280x900 (frozen): hero wrapper `x=16 y=128 w=505 h=442`, byod
`x=16 y=602 w=505 h=473`, address `x=577 y=128 w=727 h=313`, inbox
`x=577 y=473 w=727 h=602`, gap 32px, right column bottom 1075 = left
column bottom 1075 (flex-1 slack absorption working).
