# Redesign RECENT ADDRESSES (AddressCard) as a modern, simple list

Written against: no commits in repo (untracked frontend); sources current as of 2026-09-01.

Status: EXECUTED and verified 2026-09-01, with user-directed amendment: rows replaced by horizontal badge-like chips (`RecentChip`, flex-wrap pill list, chip click = use address, inline X removes) and header trigger is an icon-only rotating chevron. Build clean; light mode verified (chips 26px, one row, zero console errors).

## Evidence chain

- Surface: `/` home — `frontend/src/components/home/AddressCard.tsx` renders the RECENT ADDRESSES section (Collapsible at lines 263-301, rows via `RecentRow` at lines 72-116) inside the same workspace grid as `InboxPanel` (`frontend/src/components/home/InboxPanel.tsx`).
- Problem: RECENT ADDRESSES rows render as boxed cards (`rounded-lg border bg-muted/50 px-3 py-2`, `AddressCard.tsx:83`) with a text "Collapse"/"Expand" trigger (lines 273-283), while the sibling list in the same workspace grid, `EmailRow` (`InboxPanel.tsx:56-81`), renders the same task family (clickable list rows) borderless with a hover wash (`rounded-md px-2 py-3 hover:bg-muted`). Rendered at 1400x900 light: boxed white rows with thin gray border + blue gradient avatar + two square icon buttons per row; header shows `RECENT ADDRESSES`, count badge, `Collapse` text button.
- Design evidence: `InboxPanel.tsx:56-81` (EmailRow exemplar — borderless row, hover bg-muted, icon-light actions via `CodeChip`); ReUI `Badge` count chip pattern shared by both headers (`AddressCard.tsx:272`, `InboxPanel.tsx:104`).
- Owner: `frontend/src/components/home/AddressCard.tsx` (`RecentRow`, recents Collapsible header).
- Scope and affected surfaces: `/` home only; AddressCard RECENT ADDRESSES section. No other consumer imports `RecentRow`.
- Uncertainty: none for styling; the chevron rotation uses the existing `recentsOpen` state rather than data attributes (deterministic, no Base UI attribute assumptions).

## Design decision

Align RECENT ADDRESSES with the workspace's own modern list language (EmailRow): drop per-row box chrome in favor of borderless rows with hover wash, and replace the wordy "Collapse"/"Expand" text trigger with an icon-only chevron that rotates on state. Keep the uppercase label + count Badge header (shared meaning with InboxPanel's count badge) and the avatar initials (existing identity element, no contradiction). This resolves the visual weight complaint ("modern simpel") using only existing primitives and tokens.

## Reuse

- `EmailRow` row styling: `rounded-md px-2 py-2 hover:bg-muted` (borderless, hover wash)
- `Badge` (ReUI) for the count chip — unchanged
- `Button` variants `ghost` / `icon-xs` — unchanged
- `cn` from `@/lib/utils` for the chevron rotation
- `ChevronDown` from `lucide-react` (icon set already in use)
- Exemplar: `frontend/src/components/home/InboxPanel.tsx`

## Changes

1. `frontend/src/components/home/AddressCard.tsx` — `RecentRow` (lines 72-116)
   - Change: container `div` className from `flex items-center gap-2.5 rounded-lg border bg-muted/50 px-3 py-2 text-sm` to `group flex items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-muted`. No other markup changes: inner select button, Avatar (h-7 w-7 initials), truncated address span, copy and remove `ghost icon-xs` buttons stay. Add `text-muted-foreground` to the copy button to match the remove button tone.
   - Preserve: click row = select address, copy/remove buttons with aria-labels, copy feedback (Check swap), avatar initials, truncation.
   - Verify: rendered rows have no visible border or background at rest; hovering a row shows the muted wash; all three actions still work.
2. `frontend/src/components/home/AddressCard.tsx` — recents header (lines 263-301)
   - Change: replace the CollapsibleTrigger text button (`Collapse`/`Expand`, `text-primary`) with an icon-only trigger: `CollapsibleTrigger render={<Button variant="ghost" size="icon-xs" className="ml-auto text-muted-foreground" aria-label="Toggle recent addresses" />}` containing `<ChevronDown className={cn("transition-transform", recentsOpen && "rotate-180")} />`. Add `ChevronDown` to the lucide import and `import { cn } from "@/lib/utils";`. Tighten the rows container from `gap-2` to `gap-1` (line 289).
   - Preserve: label `RECENT ADDRESSES` (uppercase, extrabold, muted), count `Badge radius="full"`, default-open state, Collapsible semantics.
   - Verify: header shows label + badge + chevron only; chevron points down when open, up when collapsed; clicking toggles the list.
3. No other file changes. `InboxPanel`, routes, tokens, and `PageBackdrop` untouched.

## Scope

- Inherit: none — `RecentRow` is local to AddressCard.
- Verify: `/` home light + dark, 1400x900 and 390x844; recents list with 1-3 rows; collapsed and expanded states.
- Exclude: avatar redesign, empty-state design (0 recents), InboxPanel rows, any token or dependency additions.

## Validation

- Product: open `/` home; RECENT ADDRESSES reads as a clean borderless list; rows remain fully actionable (select/copy/remove).
- Interface: 1400x900 light and dark (hover wash visible in both); 390x844 (actions not clipped, `scrollWidth === clientWidth`); collapse toggle works; badge count still accurate.
- System: row styling matches `InboxPanel.tsx` EmailRow language; no new primitives, tokens, or imports beyond `ChevronDown` + `cn`.
- Repository: `npm run build` in `frontend/` → tsc + vite build clean.

## Stop conditions

- Stop if removing the row border makes rows unreadable against `PageBackdrop` orbs in either color scheme (then use `bg-card/60` tint instead of pure borderless).
- Stop if Base UI CollapsibleTrigger rejects an icon-only Button child (then wrap chevron in the existing text-button trigger and drop the label visually).

## Design documentation

- After acceptance and validation: append the outcome to this file's Status line; no other documentation exists to update.
