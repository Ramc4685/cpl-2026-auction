# CPL 2026 — Project Context

## What this is

A static site to run the CPL 2026 cricket player auction. Runs from any browser. Deployable to GitHub Pages, with optional Google Sheets live sync through Google Apps Script.

Three pages, one data source.

## Why it exists

The original auction workbook (`CPL_2026_Admin_Owner_Auction_Workbook.xlsx`) had:
- Solid formula chain (Roster Rules → Team Summary → Category Pool → Owner Dashboard).
- Real-time cap/purse validation on Admin Auction Entry sheet.
- Dropdowns for player + team selection.

Problems for live use:
- Excel formulas break when multiple owners edit concurrently via Drive.
- No bid floors, increments, RTM, unsold, or undo rules defined anywhere.
- Slow during live verbal bidding (typing player names, tabbing 3 cells).
- No "current lot" big-display view for the room.
- Sharing the .xlsx itself locks editing or risks corruption.

This site solves all of the above.

## Architecture

```
Cricket Auction/
├── index.html      Owner Dashboard (read-only, default page)
├── admin.html      Live Auction Console (admin-only)
├── rules.html      Auction Rules one-pager (printable)
├── data.js         Embedded data: teams, retained, pool, rules
├── data.json       Same data in JSON form (for reference / export)
├── config.js       Optional Apps Script Web App URL
├── apps-script/    Google Sheet-bound Apps Script bridge
├── README.md       Deploy guide
├── AUDIT.md        Pre-auction pool/spend analysis
└── Docs/
    └── CONTEXT.md  This file
```

**Data flow.** `data.js` defines `window.CPL_DATA` containing teams, retained roster, auction pool, and rules. Both `admin.html` and `index.html` read it on load.

**State flow.** The console writes auction outcomes to `localStorage` under key `cpl2026_state_v1`. If `config.js` has an Apps Script Web App URL and the conductor enters the admin key, the console also publishes state to a Google Sheet through Apps Script. The public dashboard polls the Web App URL every few seconds.

**Backend.** Lightweight Google Sheet/App Script bridge only. Single-admin model.

## Rules in effect (v3 — current)

| Rule | Value |
|---|---|
| Total team purse | 140,000 (120k base + 20k extra) |
| Required roster | 15 |
| Required Gold per team | 3 |
| Required Silver per team | 5 |
| Required Bronze per team | 7 |
| Gold floor | 15,000 |
| Silver floor | 5,000 |
| Bronze floor | 3,000 |
| RTM | OFF |

Bid increments:
- Up to 10,000 → +500
- 10,001 – 25,000 → +1,000
- 25,001 – 50,000 → +2,500
- Above 50,000 → +5,000

## Pool snapshot (v3)

44 players: 4 Gold, 15 Silver, 25 Bronze. Pool exactly matches max demand across categories — no slack, no surplus.

## Key decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Hosting | GitHub Pages | Single public URL for owners/spectators. |
| Live sync | Google Sheets + Apps Script | Minimal one-time-event setup without Firebase/Supabase. |
| Auction mode | Hybrid (verbal on Zoom + admin enters bids) | Less complex than per-owner UI, still fast. |
| RTM | OFF | Simpler. Highest bid wins. |
| Tie-break | Admin call is final | Verbal auction can't have true ties. |
| Undo | Last lot only, both teams agree | Avoids cascading rollbacks. |
| Unsold | Round 2 at floor | Keeps the process simple while preserving available-player status. |

## Auction-day workflow

1. Open `admin.html` on laptop (you).
2. Share screen on Zoom. Owners can also open `index.html` (read-only).
3. Per lot: pick player → enter winning team + price → SOLD or UNSOLD.
4. Console enforces exact category targets, roster, floor, purse, and required-slot reserve.
5. Owners/spectators watch `index.html`, which updates live from Apps Script.
6. Export JSON every ~10 lots and post-auction as a backup archive.

## Pre-auction checklist

- [ ] Print `rules.html` as PDF, send to owners 24h before.
- [ ] Test `admin.html` with 3 mock lots end-to-end.
- [ ] Confirm roster/category targets: 15 players, exactly 3 Gold, 5 Silver, 7 Bronze.
- [ ] Verify all owner names + team mappings in `data.js`.
- [ ] Test on mobile (Zoom side-by-side with dashboard).
- [ ] Configure Apps Script Web App URL in `config.js`.
- [ ] Push to GitHub Pages, confirm public URL updates from the Sheet.

## Known limitations

- Single admin. Multi-admin is intentionally out of scope.
- Online sync is polling, not socket push; expected delay is a few seconds.
- Undo last is supported, and older lots can be corrected/voided from the Correction Desk.
- localStorage is still the admin backup. Don't switch browsers mid-auction without exporting first.

## Refresh data

To update the auction pool or retained roster:
1. Edit source `.xlsx` files.
2. Re-run the conversion script (Python, openpyxl). See `AUDIT.md` for source field mappings.
3. Replace `data.js` and `data.json`.
4. Commit + push.

Or hand-edit `data.js` for small changes — it's a single JSON object assigned to `window.CPL_DATA`.

## Source files (originals)

- Workbook: `CPL_2026_Admin_Owner_Auction_Workbook.xlsx` — teams, retained, rules
- Auction pool: `Auction_Pool_CPL_2026.xlsx` — 44-player auction list

## Version history

- **v1** (May 1, 2026) — Initial build with old caps (4/5/6) and old floors (5k/2.5k/1k).
- **v2** (May 1, 2026) — New caps (3/5/7), previous floors (20k/10k/4k), new auction pool (44 players, 4G/15S/25B).
- **v3** (May 2, 2026) — Floors updated to Gold 15k, Silver 5k, Bronze 3k so all teams can complete exact rosters and Gold bidding remains competitive.
- **v3** (May 1, 2026) — Refreshed auction pool categories from Google Sheet while preserving 44 players and 4G/15S/25B counts.
