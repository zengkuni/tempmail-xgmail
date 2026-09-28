# Mobile Modern Style — Home Workspace

Date: 2026-09-29. Scope: mobile-only visual/layout modernization of the home
page workspace and its cards. Desktop (>= 992px) layout and boxes are frozen
and re-measured after every change.

## Direction

The tool is the product on a phone, but the marketing hero still opens the
page (user instruction 2026-09-29: "kembalikan burner inbox ke top"): mobile
order is hero (Burner Inbox) -> address card + inbox -> byod -> marketing.
Modern mobile style here means phone-native ergonomics, not decoration:
touch-sized controls (44px primary actions, 40px secondary), tighter vertical
rhythm (24px between sections, 16px panel padding), an address-first
typographic hierarchy, and a horizontal snap strip for recent addresses
instead of a wrapped chip cloud.

## Decisions

- **Order**: mobile hero first (`order-1`), address+inbox stack second
  (`order-2`), byod third (`order-3`). Desktop placement is pinned by
  explicit `col-start`/`row-start`/`row-span-2`, so `order-*` is inert there.
- **Tap targets**: address-card action buttons `h-11` (44px), inbox
  Clear/Refresh `h-9`, row delete `h-10`, prefix input / domain select `h-11`
  on mobile; all restore to desktop sizes via `min-[576px]:` / `min-[992px]:`.
- **Press feedback**: `active:scale-[0.97]` utilities (no custom CSS class —
  an unlayered `.press-scale` rule would clobber Button's `transition-all`).
- **Rhythm**: workspace `gap-6` mobile (24px) vs `gap-y-8` desktop (32px);
  marketing sections `py-10` mobile vs `py-16` desktop; address card panel
  `p-4` mobile (16px).
- **Hierarchy**: `CURRENT ADDRESS` / `RECENT ADDRESSES` labels at 11px with
  `0.08em` tracking (data labels, not decorative kickers); address headline
  19px mobile / 22px desktop.
- **Recent addresses**: mobile = horizontal `snap-x` strip, chips
  `snap-start shrink-0`; desktop = original wrap.
- **Browser surfaces** (craft floor): `::selection` tinted from
  `--primary`; `-webkit-tap-highlight-color: transparent` and
  `overscroll-behavior-y: contain` on body under 992px.
- **ReUI**: components verified via `mcp__reui_search` — Frame usage follows
  the canonical `Frame > FramePanel` pattern (radius via `--frame-radius`).
  Targeted search for a snap-strip primitive ("horizontal scroll / carousel /
  chips / scroll area") returned only generic scroll-area examples
  (scrollbar-based); no registry item ships a chip snap strip, so the mobile
- **Hero stat cards**: mobile = one 3-column row (111px cells, value + label
  centered, icon hidden via `hidden min-[576px]:inline-flex`); >= 576px keeps
  icon tile + `min-h-[118px]` left-aligned cards.
- **Declined**: sticky address bar, bottom sheets, gradient/glass
  decoration, new fonts — no identity need, all would add structure the
  surface does not ask for.

## Evidence (measured via CDP, headless profile)

Mobile 390x844: `innerWidth=390`, `matchMedia('(min-width:992px)')=false`,
`scrollWidth=380` (no horizontal overflow), header 56px, Random button 44px
tap, hero->stack 24px, stat cards one row (h=103 vs ~354 stacked), order
verified as hero -> stack -> byod.

Desktop 1280x900 (frozen): hero wrapper `x=16 y=128 w=505 h=442`, byod
`x=16 y=602 w=505 h=473`, address `x=577 y=128 w=727 h=313`, inbox
`x=577 y=473 w=727 h=602`, gap 32px, right column bottom 1075 = left
column bottom 1075 (both columns flush).
