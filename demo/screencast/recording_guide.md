# Tiny AI Assistant -- Demo Recording Guide

## Overview

This pipeline produces a polished, enterprise-quality product demo video
with humanlike interactions synchronized to professional narration audio.

**Total Duration:** ~262 seconds (4 min 22 sec)

---

## Prerequisites

Before running the recording, ensure:

1. **Chrome** is running with remote debugging enabled:
   ```
   chrome --remote-debugging-port=9222
   ```

2. **Product server** is running at `http://localhost:8080`:
   ```
   cd demo && node server.js
   ```

3. **Python dependencies** are installed:
   ```
   pip install websockets pyautogui pyperclip imageio-ffmpeg
   ```

4. **Close all other windows** -- the recording captures a specific screen
   region where Chrome will be positioned.

5. **Disable desktop notifications** to prevent pop-ups during recording.

6. **Set display scaling to 100%** for pixel-accurate coordinate mapping.

---

## 3-Step Pipeline

### Step 1: Record (Recommended)
```bash
python record_playwright.py
```
- Launches headful Chromium under Playwright at 1280x800 resolution
- Injects a virtual cursor (`mouse_helper.js`) that automatically tracks actions and animates click ripples
- Captures the viewport natively -- no physical mouse hijacking, runs in the background
- Output: `recording/screen_recording.mp4`

*(Alternative coordinate-based recording: `python record_demo.py`)*

### Step 2: Polish
```bash
# If using record_playwright.py (no toolbar captured, skip crop):
python polish_video.py --skip-crop

# If using record_demo.py (toolbar captured, crop required):
python polish_video.py recording/screen_recording.mp4
```
- Crops Chrome toolbar if needed (top 80px)
- Scales and pads viewport recording to 1920x1080 with dark background
- Adds fade-in/fade-out transitions
- Output: `output/polished.mp4`

### Step 3: Assemble
```bash
python assemble_screencast.py output/polished.mp4
```
- Merges polished video with mastered narration audio
- Applies broadcast audio mastering chain
- Generates SRT captions via Whisper (optional)
- Output: `output/Tiny_AI_Assistant_Guide.mp4`

---

## Scene Breakdown

| # | Scene | Duration | Page | Key Actions |
|---|-------|----------|------|-------------|
| 1 | Hook | 30.53s | book.html | Select meeting reason, show host dropdown |
| 2 | Context | 20.86s | book.html | Pick date/time, fill form, submit, copy intake |
| 3 | Chat Widget | 27.65s | index.html | Paste intake summary, click Parse Form |
| 4 | Lead Capture | 32.98s | index.html | Paste LinkedIn, browse GDrive, attach SOW |
| 5 | Smart Booking | 32.09s | index.html | Generate Prep Briefing, view AI dossier |
| 6 | Smart Routing | 29.57s | index.html | Session tab, question cards, book positional |
| 7 | Dashboard | 27.55s | index.html | Call Directory, browse recordings |
| 8 | Recap | 29.11s | index.html | Paste transcript, synthesize 7 reports |
| 9 | CTA | 23.64s | index.html | Review proposal, copy deliverables |

---

## Optional: Higher Quality with FocuSee

For cinematic cursor effects (auto-zoom, motion blur), run the raw
recording through [FocuSee](https://www.imobie.com/focusee/) before
the Polish step:

1. Open `recording/screen_recording.mp4` in FocuSee
2. Apply auto-zoom and cursor effects
3. Export as `recording/screen_recording_focusee.mp4`
4. Use the FocuSee export in the Polish step

---

## Narration Audio Files

Pre-generated in `audio/`:
- `01_hook.mp3` through `09_cta.mp3` (individual sections)
- `full_narration_mastered.mp3` (262s, broadcast-mastered)
- `narration_metadata.json` (timing data)

To regenerate narration: `python generate_narration.py`
