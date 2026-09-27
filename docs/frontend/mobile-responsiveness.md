# Mobile Responsiveness

Audit-driven fixes so all routes work at 320px and 390px with no horizontal document
overflow, no clipped/unreachable text, and no overlapping chart labels.

## Verification method

Real-runtime DOM audit against the dev server (Vite) at 320x800 and 390x844:
full-page scroll pass (BlurFade sections mount on scroll), then
`documentElement.scrollWidth > clientWidth + 1` for doc overflow, and
`scrollWidth > clientWidth + 2` with visible `overflow-x` for clipped elements,
excluding intentional scroll containers (`.overflow-x-auto`,
`[data-slot=scroll-area-viewport]`) and full-bleed `-mx-*` nav ancestors.
Chart axis overlap checked via `getBoundingClientRect()` adjacency.

Result: zero doc overflow on `/`, `/domains`, `/statistics`, `/help`, `/api`
at both widths; zero clipped elements aside from the intentional chart
sparse-label cells (labels extend over empty neighbor tracks, rect-verified
non-overlapping) and the intentional full-bleed scrollspy nav.

## Fixes

| File | Fix |
| --- | --- |
| `frontend/vite.config.ts` | Proxy key `"/api"` -> `"/api/"` so the SPA docs route `/api` stops matching the catch-all API proxy and 500ing. Backend endpoints are all `/api/...` sub-paths, so zero backend impact. |
| `frontend/src/components/home/AddressCard.tsx` | Button grid `grid-cols-4` -> `grid-cols-2 min-[576px]:grid-cols-4` (labels overflowed at 320px). |
| `frontend/src/components/statistics/TopLists.tsx` | Label `p` gains `min-w-0 truncate` AND the row becomes `grid grid-cols-[minmax(0,1fr)]`. Root cause: the grid `auto` track sized to max-content; capping the track (`minmax(0,1fr)`) is what confines the truncation. |
| `frontend/src/components/home/ByodCard.tsx` | `FrameTitle` gains `min-w-0 truncate`. |
| `frontend/src/components/help/HelpContent.tsx` | `break-words` on step bodies, section lists and paragraphs so the long example URL (`https://<domain>/user@domain.com`) wraps. |
| `frontend/src/routes/statistics.tsx` | `hourLabel` is hour-only 12h (`10 PM`) instead of `HH:MM AM`. |
| `frontend/src/components/statistics/HourlyChart.tsx` | Dual-density axis: every 6th label inline below 1100px, every 3rd above; both `whitespace-nowrap` inside `minmax(0,1fr)` cells. |
| `frontend/src/components/domains/DomainInventory.tsx` | `DataGridContainer` -> `DataGridScrollArea` (ReUI-prescribed wrapper; the 750px table scrolls inside `scroll-area-viewport` instead of clipping). Header controls: control row `w-full sm:w-auto`, search `min-w-0 flex-1 sm:w-48 sm:flex-none`, Input `w-full pl-8 sm:w-56` (was `w-48` fixed, overflowing the panel at 320px). |
| `frontend/src/components/api/ApiContent.tsx` | Removed the composed `<CodeBlockContent />` from all five code blocks. Per ReUI code-block docs, composing `CodeBlockContent` transfers scrolling ownership to the consumer's own scroll container; ApiContent never supplied one, so long curl/JSON lines pushed the block to 367px+ inside a 203px container (doc-visible overflow on /api). Without it the root renders its built-in `overflow: auto` surface. Also `break-words` on the Timeline step note paragraph (long `{"prefix":"demo","domain":"yopmail.com"}` token). |

## Explicitly not done

- No global `overflow-x: hidden` on `index.css` — it masks layout bugs instead of fixing them.
- No edits under `frontend/src/components/reui/` — all changes are composition-level per ReUI docs.
