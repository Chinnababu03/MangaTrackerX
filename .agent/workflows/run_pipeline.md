---
description: Run the full MangaTrackerX data pipeline
---

All commands must be run from the project root: `d:\Code\Antigravity\MangaTrackerX`
Activate the virtual environment before the first run of each session.

// turbo
1. Activate the virtual environment
```powershell
.venv\Scripts\Activate.ps1
```

// turbo
2. **STEP 1** — Ingest new URLs from CSV into the LINKS collection
```powershell
python -m src.pipeline.links_ingestion
```

// turbo
3. **STEP 2** — Fetch rendered HTML via Selenium and cache in PAGESOURCE
```powershell
python -m src.pipeline.fetching_pagesource
```

// turbo
4. **STEP 3** — Parse PAGESOURCE in parallel and upsert into MANGA_DATA
```powershell
python -m src.pipeline.process_manga
```

// turbo
5. **STEP 4** — Clear the PAGESOURCE cache
```powershell
python -m src.pipeline.pagesource_cleanup
```
