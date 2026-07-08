# MangaTrackerX - Development Log
**Date:** July 5, 2026

This document summarizes the complete overhaul, bug fixes, and data migrations applied to MangaTrackerX.

## 1. Data Pipeline Enhancements (`data_extraction` branch)
* **Deprecated Broken Domains:** Both `harimanga.me` and `manhuaus.org` went permanently offline/unreachable. 
* **Fallback Mirror Logic:** Updated `src/pipeline/fetching_pagesource.py` to immediately skip attempting to fetch from those dead domains. The scraper now extracts the manga slug and automatically cycles through a priority list of active mirrors:
  1. `https://www.clanmanhwa.com/manga/{slug}`
  2. `https://coffeemanga.ink/manga/{slug}`
  3. `https://www.harimanga.co.uk/manga/{slug}`

## 2. Database Deep Migration (MongoDB)
* **Legacy Data Cleanup:** Ran several automated scripts (`migrate_manhuaus.py`, `fix_harimanga_db.py`, etc.) directly against the live MongoDB cluster (`manga_tracker` DB).
* **Deep Array Updates:** 
  * Replaced all top-level `manga_url` occurrences of the dead domains with live mirrors.
  * Deeply scanned and replaced the dead domains inside the nested `latest_chapters.chapter_url` arrays for 60+ manga.
  * *Note:* All 60+ migrated manga already had `en_manga_image` (Base64 data) safely cached, so no cover art was lost when the original image URLs broke.

## 3. Frontend UI Redesign (`frontend` branch)
* **Nova Design System:** Completely rebuilt `src/style.css` using modern CSS variables, OLED dark themes (`#08070d`), and fluid `clamp()` typography.
* **Component Upgrades:**
  * **Navbar (`main.js`):** Converted to a floating pill with glassmorphism blur and a hamburger menu for mobile.
  * **Home Page (`home.js`):** Added a "Bento-Box" style grid for library stats, featuring a pulsing "Live" indicator.
  * **Library Page (`manga-list.js`):** Added a Grid/List view toggle. Redesigned cover cards with bottom-aligned titles (fixed `min-height`), bright amber rating badges, and a hover-overlay that reveals clickable latest chapter pills.
  * **Detail Page (`manga-detail.js`):** Implemented an immersive, blurred parallax-scrolling banner using the manga's cover art.
* **Performance:** Implemented a 250ms debounce on the library search bar to prevent CPU freezing while typing, and applied `loading="lazy" decoding="async"` to all cover images.
* **UI Edge Cases:** Stripped `www.` and `.com/.uk` suffixes from the site names (e.g. `harimanga.co.uk` renders cleanly as `harimanga`).

## 4. Automation & DevOps
* **Smart Batch Script:** Rewrote the startup batch script to include a PowerShell-powered "7-day Tracker". It checks the `LastWriteTime` of `tracker.txt` and automatically skips the extraction process if it has been less than a week. It strictly forces a `git checkout data_extraction` before running to ensure `main.py` is always found.
* **Git Sync:** Pushed both the `frontend` and `data_extraction` branches to GitHub using the secondary SSH alias (`github.com-secondary`), clearing all "branch ahead" warnings.

## 5. Next Steps / Pending Action Items
* **7 Pending Scrapes:** There are 7 URLs sitting in the `manga_links` collection that haven't been successfully scraped into `manga_data` yet. The next successful run of the Python batch script will automatically pick them up and fetch their data.
* **React Fallback:** If the vanilla JS frontend ever becomes difficult to maintain, the next architectural step is porting the app to React (Vite).
