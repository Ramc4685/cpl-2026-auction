# CPL 2026 — Auction Site

Static site hosted on GitHub Pages, with optional Google Sheets live sync through a tiny Google Apps Script web app.

## Files

- `owner.html` — Owner Dashboard (read-only).
- `index.html` — Redirects old/default links to `owner.html`.
- `public.html` — Public spectator dashboard (read-only, mobile-first).
- `admin.html` — Live Auction Console (you drive this).
- `rules.html` — Auction Rules one-pager (printable).
- `data.js` — Embedded data (teams, retained, pool). Auto-loaded.
- `data.json` — Same data, JSON form (for reference).
- `config.js` — Optional Apps Script URL for live public sync.
- `apps-script/Code.gs` — Paste this into a Google Sheet-bound Apps Script project.

## How auction state flows

The console (`admin.html`) always writes to `localStorage` in your browser first.

If `config.js` has a Google Apps Script Web App URL and the admin enters the write key, the console also publishes the same state online. The owner dashboard (`owner.html`) and public spectator page (`public.html`) poll the Apps Script URL every few seconds, so owners and spectators can watch live from GitHub Pages. Bid-pad clicks publish the current high bid before the final sale is committed.

If online sync is not configured or fails, export JSON from the console and use "Load auction state JSON" on the dashboard as a backup.

## Google Sheets live sync setup

1. Create a Google Sheet named something like `CPL 2026 Live Auction State`.
2. Open `Extensions -> Apps Script`.
3. Replace the starter script with `apps-script/Code.gs`.
4. In Apps Script, open `Project Settings -> Script properties` and add `ADMIN_KEY` with a short private phrase only the auction conductor knows.
5. Deploy with `Deploy -> New deployment -> Web app`.
6. Use:
   - Execute as: `Me`
   - Who has access: `Anyone`
7. Copy the Web App URL ending in `/exec`.
8. Paste that URL into `config.js` as `APPS_SCRIPT_URL`.
9. Open `admin.html`, unlock the console, enter the same admin key, and click `Save sync settings`.
10. After that, every admin action auto-pushes online. Use `Force push now` only if you want to resend the current state manually.

The Google Sheet will keep:
- `State` tab with the full JSON state used by the public website.
- `Auction Log` tab with readable lot history.
- `League Summary` tab with purse, roster, category counts, slots left, and required reserve by team.
- `Player Pool` tab with every auction player and live status.
- One tab per team with retained players, auction buys, spend, purse, and category totals.

When `apps-script/Code.gs` changes in this repo, paste the updated file into Apps Script and deploy a new Web App version. GitHub Pages updates the website, but it does not automatically update the Google Apps Script project.

## Deploy to GitHub Pages

```bash
# in this folder
git init
git add -A
git commit -m "CPL 2026 auction site"
git branch -M main
# create a repo on github.com first, then:
git remote add origin https://github.com/<you>/cpl-2026-auction.git
git push -u origin main

# In GitHub: Settings → Pages → Build from branch → main / root
```

URL becomes `https://<you>.github.io/cpl-2026-auction/`.

## Pre-auction checklist

1. Confirm latest player/category sheet has 44 players and no Unknown category players.
2. Confirm bid floors and increments in `rules.html`.
3. Confirm roster/category targets: 15 players per team, exactly 3 Gold, 5 Silver, and 7 Bronze.
4. Test on mobile + desktop.
5. Print `rules.html` as PDF and share with owners.

## Refresh data from a new workbook

Re-run the Python conversion script (see `AUDIT.md` for the source workbook fields). Or edit `data.js` directly if changes are small.

## Auction-day workflow

1. Open `admin.html` on your laptop. Keep it open.
2. Share `owner.html` GitHub Pages URL with owners/spectators.
3. For each lot: pick player → enter winning team + price → SOLD / UNSOLD.
4. Console enforces: exact category targets, 15-player roster, purse, floor, required-slot reserve, increment format.
5. If a mistake happens, use Undo Last for the most recent lot, or Correction Desk for older lots.
6. Watch the sync pill in the header. It should show `Online saved` after each admin action.
7. Export JSON at breaks and after the auction as a backup archive.

## Known limitations

- Single-admin. Only one conductor should use `admin.html` during the auction.
- Apps Script POST is queued and confirmed by revision: the admin page writes automatically after every action, then checks the published revision.
- `admin.html` has a front-door password screen to stop casual URL guessing. Because this is GitHub Pages, it is still a static-page deterrent, not server authentication.
- The Apps Script admin key is the real write protection for online data. Keep it private.
