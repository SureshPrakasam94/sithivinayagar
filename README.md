# 🛕 விநாயகர் சதுர்த்தி – நன்கொடை பட்டியல் (Static Web App + Local Excel)

Responsive (web + mobile) donation-list website for **ஸ்ரீ சித்தி விநாயகர் ஆலயம்**, styled like the festival poster.
**100% static — no Node.js, no Google Sheet, no server.** The donor list is stored in your **local Excel file `data/donors.xlsx`** — the website reads from it and writes every change straight into it. **No donor data is kept in localStorage / session / cookies.**

## Project structure (separate files)

```
vinayagar-donors/
├── index.html          → Home page (public donor list + grand total, read from the Excel)
├── admin.html          → Separate ADMIN context (login → add / update / delete)
├── css/style.css       → Festive poster theme
├── js/
│   ├── config.js       → admin login (only setting)
│   ├── store.js        → Excel data layer (File System Access + SheetJS)
│   ├── main.js         → home page logic
│   └── admin.js        → admin logic
├── vendor/             → bootstrap 5.3 + SheetJS (local)
├── assets/             → ganesha.jpg, gopuram.jpg
├── data/
│   └── donors.xlsx     → ★ THE STORE — all donor data lives in this file
└── README.md
```

## How the Excel storing works (use **Chrome or Edge**)

1. Open `admin.html` and log in (`admin` / `admin123`).
2. **First login only:** the site auto-connects your Excel —
   - if `data/donors.xlsx` **exists** → a one-time chooser opens on that folder so the browser
     gets your permission (browser security: a web page may not write to your disk just because
     a file exists — this single click is the only manual step, ever);
   - if the file **does not exist** → the site **creates `donors.xlsx` for you** (save dialog).
3. The connection is remembered (IndexedDB). **Every later visit — home and admin — re-attaches
   silently with zero clicks**, and every add / update / delete is written straight into the
   .xlsx on disk with a “(Excel ✅)” toast.
4. The home page reads the same file (linked handle, or `data/donors.xlsx` over http).

### Important notes (the “Enable Editing” issue)

- **Keep Excel closed while the website saves.** If Excel has `donors.xlsx` open, the file is
  locked and the site shows: “⚠️ Excel கோப்பை எழுத முடியவில்லை…” — close Excel and repeat the change.
- If Excel shows **“Enable Editing” (Protected View)**, it is displaying a read-only copy —
  you won’t see the site’s writes until you close & re-open the file (or click Enable Editing and re-open).
  This prompt usually appears for files *downloaded from the internet*; a `data/donors.xlsx`
  that the website writes on your disk does not need it.
- Browsers only allow a web page to touch your disk after **you** pick the file once —
  that one-time chooser is required by Chrome/Edge security; after that everything is automatic.
- Firefox / Safari don’t support direct file writing: use the **⬇ Excel பதிவிறக்கு**
  button and keep the downloaded file as `data/donors.xlsx`.

## Run / host

Any static hosting or just open the files. For the home page to auto-read the Excel without
linking, serve the folder (e.g. `python3 -m http.server 3000`, VS Code Live Server, GitHub Pages).
Opening by double-click also works after linking the file once in each page.

## Pages & login

| Page | URL | Purpose |
|------|-----|---------|
| Home | `index.html` | Public donor list + running total |
| Admin | `admin.html` | Login → link Excel once → add / update / delete (written into the file) |

Admin login (demo): **admin** / **admin123** — change in `js/config.js`.
