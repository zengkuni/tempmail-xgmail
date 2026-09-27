# Modern scrollbar untuk semua komponen

- Status: EXECUTED
- Scope: global — semua scroll container di frontend (window, InboxPanel list, Select popup, DropdownMenu popup, dialog yang overflow, code-block, dan permukaan scroll lain di masa depan).

## Evidence

- Tidak ada owner scrollbar: tidak ada `scroll-area` di `src/components/ui/` maupun `src/components/reui/`; registry ReUI free tier tidak punya `scroll-area`; paket `@base-ui/react` terpasang tidak punya `ScrollArea`.
- `src/index.css` tidak punya aturan `::-webkit-scrollbar` / `scrollbar-width` / `scrollbar-color`.
- Scroll surface yang sudah terbukti native scrollbar:
  - `src/components/home/InboxPanel.tsx` — list email `max-h-[355px] overflow-y-auto`.
  - `src/components/ui/select.tsx` — popup `max-h-[330px] overflow-y-auto` (dropdown domain; 13 item → scroll aktif).
  - `src/components/ui/dropdown-menu.tsx` — popup `max-h-(--available-height) overflow-y-auto`.
  - window/body scroll semua route.
- Pengecualian tidak konsisten: `src/components/reui/code-block/code-block.tsx` baris ~1595 punya `[scrollbar-width:thin]` (Firefox-only, webkit tetap native).

## Decision

Pure CSS global di `src/index.css`, tanpa dependensi dan tanpa wrapping komponen.
Alasan: shadcn `scroll-area` berbasis Radix melanggar konvensi Base UI proyek dan harus membungkus tiap popup satu per satu; CSS global memberi look modern yang sama (thumb tipis rounded, track transparan, token-aware) untuk SEMUA komponen sekaligus, otomatis mengikuti light/dark via token.

## Change

1. `src/index.css` — tambahkan di akhir file:

```css
/* Modern thin scrollbar, token-driven (light/dark otomatis) */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
*::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
*::-webkit-scrollbar-track {
  background: transparent;
}
*::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 9999px;
}
*::-webkit-scrollbar-thumb:hover {
  background: color-mix(in oklab, var(--muted-foreground) 60%, transparent);
}
```

2. `src/components/reui/code-block/code-block.tsx` (~baris 1595) — hapus util `[scrollbar-width:thin]` dari class scroll; sisanya (`overflow-auto`, max-height) dipertahankan. Aturan global kini yang mengatur thin.

Jangan ubah file lain. Jangan tambah dependensi.

## Acceptance criteria

- Dropdown domain (13 item) menampilkan thumb tipis 8px rounded; hover thumb menggelap.
- List inbox (7 mock email, scroll aktif) idem.
- Mobile DropdownMenu (viewport kecil, list menu panjang) idem.
- `getComputedStyle` Firefox: `scrollbar-width: thin` aktif pada elemen scroll.
- Light dan dark mode keduanya memakai warna token (thumb mengikuti `--border` tema aktif).
- `npm run build` bersih; 0 console error di browser.
- code-block panjang (Api page) tetap scrollable dan tampil thin.
