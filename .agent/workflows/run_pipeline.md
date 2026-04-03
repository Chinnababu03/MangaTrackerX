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
2. Run the complete pipeline sequence from start to finish
```powershell
python main.py
```

*(Optional) You can also run individual steps manually if needed:*
- **STEP 1**: `python -m src.pipeline.links_ingestion`
- **STEP 2**: `python -m src.pipeline.fetching_pagesource`
- **STEP 3**: `python -m src.pipeline.process_manga`
- **STEP 4**: `python -m src.pipeline.pagesource_cleanup`
