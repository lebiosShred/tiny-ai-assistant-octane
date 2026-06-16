"""
Tiny AI Assistant -- Enterprise Demo Recorder
===============================================
Records a product demo video by driving Chrome via CDP (element lookups,
navigation, value injection) and pyautogui (real mouse cursor movement,
clicking, typing). FFmpeg captures the Chrome viewport region.

9 scenes, each timed to align with narration audio sections.

Prerequisites:
  1. Chrome running with: chrome --remote-debugging-port=9222
  2. Product server at: http://localhost:8080
  3. pip install websockets pyautogui pyperclip imageio-ffmpeg

Usage:
  python record_demo.py
"""
import asyncio
import json
import os
import random
import subprocess
import sys
import time
from pathlib import Path

import pyautogui
import pyperclip
import websockets

# ── Safety ──
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0

# ── Paths ──
SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR / "recording"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
RAW_FILE = OUTPUT_DIR / "screen_recording.mkv"
FINAL_FILE = OUTPUT_DIR / "screen_recording.mp4"

def get_ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()

FFMPEG = get_ffmpeg()

# ── URLs ──
BASE_URL = "http://localhost:8080"
BOOK_URL = f"{BASE_URL}/book"
DASH_URL = f"{BASE_URL}/"

# ── Scene durations (from narration_metadata.json) ──
SCENE_DURATIONS = {
    "01_hook": 30.53,
    "02_context": 20.86,
    "03_chat_widget": 27.65,
    "04_lead_capture": 32.98,
    "05_smart_booking": 32.09,
    "06_smart_routing": 29.57,
    "07_dashboard": 27.55,
    "08_recap": 29.11,
    "09_cta": 23.64,
}

def load_scene_durations():
    """Load durations dynamically from narration_metadata.json if available."""
    meta_path = SCRIPT_DIR / "audio" / "narration_metadata.json"
    if meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                durations = {}
                for sec in data.get("sections", []):
                    name = sec["name"]
                    durations[name] = sec["duration_s"]
                print(f"  [TIMING] Loaded timing metadata from {meta_path.name}")
                return durations
        except Exception as e:
            print(f"  [WARN] Failed to load timing metadata: {e}")
    print("  [TIMING] Using default fallback durations.")
    return SCENE_DURATIONS

# ── Sample Data ──
DISCUSS_TEXT = (
    "We need help consolidating 35 Excel-based planning models "
    "into a single TM1 instance. Our monthly close takes 3 weeks "
    "and we need to bring it down to 5 business days."
)

INTAKE_TEXT = (
    "BOOKING INTAKE SUMMARY\n"
    "========================\n"
    "Meeting Type: Pre-Screen Discovery Call | 30 mins\n"
    "Host: Round Robin Sales Reps (Albert / Isha)\n"
    "Date: Monday, May 26, 2025 at 10:00 AM AEST\n\n"
    "Contact Details:\n"
    "Name: Sarah Chen\n"
    "Email: sarah.chen@meridianlogistics.com.au\n"
    "Company: Meridian Logistics\n"
    "Position: Head of FP&A\n"
    "Service Track: Planning & Analytics (TM1)\n"
    "Website: https://meridianlogistics.com.au\n"
    "Phone: +61 2 9876 5432\n\n"
    "Discussion Topics:\n"
    + DISCUSS_TEXT
)

LINKEDIN_TEXT = (
    "Sarah Chen -- Head of FP&A at Meridian Logistics\n\n"
    "Experience:\n"
    "- Head of FP&A, Meridian Logistics (2021-Present)\n"
    "  Leading financial planning transformation for AU's third-largest "
    "logistics provider. Managing 35 planning models across 12 divisions.\n\n"
    "- Senior Financial Analyst, Linfox Logistics (2017-2021)\n"
    "  Built rolling forecast models for fleet operations across 8 countries. "
    "Delivered $2.4M in cost savings through driver utilization optimization.\n\n"
    "Education:\n"
    "- MBA, Melbourne Business School (2016)\n"
    "- Bachelor of Commerce, Monash University (2013)"
)

TRANSCRIPT_TEXT = (
    "Albert: Hi Sarah, thanks for booking a pre-screen call with Octane. "
    "I understand you're looking at TM1 for financial consolidation?\n\n"
    "Sarah: Yes, we have 35 Excel planning models across 12 divisions. "
    "Our monthly close takes three weeks and we need to get it down to one week.\n\n"
    "Albert: That's a common challenge. Are you currently using any planning "
    "tool or is it all Excel?\n\n"
    "Sarah: It's 100% Excel. We tried to standardize templates but each "
    "division has their own version.\n\n"
    "Albert: What about your ERP? I see you're on NetSuite.\n\n"
    "Sarah: Yes, NetSuite for GL and AP. We export to Excel for planning. "
    "There's no direct feed into a planning tool.\n\n"
    "Albert: And what's your timeline for making a decision?\n\n"
    "Sarah: We need to present a recommendation to the CFO by end of Q3. "
    "So ideally we'd want a proof of concept running by August.\n\n"
    "Albert: Perfect. Based on what you've shared, I think Amendra would be "
    "the right person to walk you through our TM1 implementation approach. "
    "Let me book a positional meeting with him.\n\n"
    "Sarah: That sounds great. Thank you."
)


# ═══════════════════════════════════════════════════════════
#  CDP HELPERS
# ═══════════════════════════════════════════════════════════
_msg_counter = 0

async def get_cdp_ws_url():
    """Find Chrome DevTools WebSocket URL with retries to wait for the demo tab."""
    import urllib.request
    import time
    
    timeout = 15.0
    t_end = time.time() + timeout
    
    print("  [CDP] Searching for active demo page target...")
    while time.time() < t_end:
        for port in [9222, 9223, 9224, 9225]:
            try:
                data = urllib.request.urlopen(
                    f"http://localhost:{port}/json", timeout=2
                ).read()
                pages = json.loads(data)
                
                # Prioritize target pages matching the demo application URL
                for p in pages:
                    url = p.get("url", "")
                    if p.get("type") == "page" and ("book.html" in url or "localhost" in url or "index.html" in url or "docs.html" in url):
                        print(f"  [CDP] Found demo target: {p.get('title')} ({url})")
                        return p["webSocketDebuggerUrl"]
            except Exception:
                continue
        await asyncio.sleep(0.5)
        
    # Final fallback: return the first page type if demo page not found after timeout
    print("  [CDP] Demo target not found after timeout, using first page fallback...")
    for port in [9222, 9223, 9224, 9225]:
        try:
            data = urllib.request.urlopen(
                f"http://localhost:{port}/json", timeout=2
            ).read()
            pages = json.loads(data)
            for p in pages:
                if p.get("type") == "page":
                    print(f"  [CDP] Fallback target: {p.get('title')} ({p.get('url')})")
                    return p["webSocketDebuggerUrl"]
        except Exception:
            continue
    return None


async def cdp(ws, method, params=None):
    """Send a CDP command and return the result."""
    global _msg_counter
    _msg_counter += 1
    msg_id = _msg_counter
    await ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
    while True:
        resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        if resp.get("id") == msg_id:
            if "error" in resp:
                print(f"  [CDP-ERR] {method}: {resp['error'].get('message','')}")
            return resp.get("result", {})


async def navigate(ws, url):
    """Navigate and wait for load."""
    await cdp(ws, "Page.navigate", {"url": url})
    await asyncio.sleep(2.5)


async def js_eval(ws, expr, return_value=False):
    """Evaluate JavaScript in the page."""
    params = {"expression": expr}
    if return_value:
        params["returnByValue"] = True
    return await cdp(ws, "Runtime.evaluate", params)


async def wait_for_selector(ws, selector, timeout=10):
    """Poll the DOM until the selector exists."""
    t_end = time.time() + timeout
    while time.time() < t_end:
        r = await js_eval(ws, f"document.querySelector('{selector}') !== null", return_value=True)
        if r.get("result", {}).get("value", False):
            return True
        await asyncio.sleep(0.3)
    print(f"  [WARN] Timeout waiting for selector: {selector}")
    return False


# ═══════════════════════════════════════════════════════════
#  COORDINATE CONVERSION
# ═══════════════════════════════════════════════════════════
async def get_viewport_info(ws):
    """Get Chrome window position and toolbar dimensions."""
    r = await js_eval(ws, (
        "JSON.stringify({"
        "sx:window.screenX,sy:window.screenY,"
        "oh:window.outerHeight,ih:window.innerHeight,"
        "ow:window.outerWidth,iw:window.innerWidth})"
    ), return_value=True)
    d = json.loads(r["result"]["value"])
    return {
        "wx": d["sx"],
        "wy": d["sy"],
        "toolbar": d["oh"] - d["ih"],
        "sidebar": max(0, (d["ow"] - d["iw"]) // 2),
        "vw": d["iw"],
        "vh": d["ih"],
    }


async def elem_pos(ws, selector, vp):
    """Get screen coordinates (center) of a DOM element."""
    r = await js_eval(ws, (
        f"(()=>{{const e=document.querySelector('{selector}');"
        "if(!e)return null;const r=e.getBoundingClientRect();"
        "return{x:r.x+r.width/2,y:r.y+r.height/2}}})()"
    ), return_value=True)
    c = r.get("result", {}).get("value")
    if not c:
        print(f"  [WARN] Not found: {selector}")
        return None
    return (
        vp["wx"] + vp["sidebar"] + c["x"],
        vp["wy"] + vp["toolbar"] + c["y"],
    )


# ═══════════════════════════════════════════════════════════
#  HUMAN INTERACTION HELPERS
# ═══════════════════════════════════════════════════════════
def move_to(x, y, dur=0.4):
    """Smooth eased mouse movement."""
    pyautogui.moveTo(x, y, duration=dur, tween=pyautogui.easeInOutQuad)


def click_at(x, y, dur=0.5):
    """Move to position with easing, pause naturally, then click."""
    pyautogui.moveTo(x, y, duration=dur, tween=pyautogui.easeInOutQuad)
    time.sleep(0.08 + random.uniform(0, 0.06))
    pyautogui.click()
    time.sleep(0.12)


def human_type_text(text, interval=0.05):
    """Type text one character at a time via clipboard for full Unicode support.
    Produces visible character-by-character typing in the recording."""
    for ch in text:
        pyperclip.copy(ch)
        pyautogui.hotkey('ctrl', 'v')
        delay = interval + random.uniform(-0.015, 0.025)
        time.sleep(max(0.01, delay))


def paste_text(text):
    """Paste full text from clipboard (realistic for long content)."""
    pyperclip.copy(text)
    time.sleep(0.1)
    pyautogui.hotkey('ctrl', 'v')
    time.sleep(0.4)


def scroll_down(clicks=3, delay=0.08):
    """Smooth scroll down."""
    for _ in range(clicks):
        pyautogui.scroll(-2)
        time.sleep(delay)


def scroll_up(clicks=3, delay=0.08):
    """Smooth scroll up."""
    for _ in range(clicks):
        pyautogui.scroll(2)
        time.sleep(delay)


async def click_elem(ws, sel, vp, dur=0.5):
    """Move to element and click it."""
    pos = await elem_pos(ws, sel, vp)
    if pos:
        click_at(*pos, dur=dur)
    return pos


async def type_into(ws, sel, text, vp, use_paste=False):
    """Click into a field and type or paste text."""
    pos = await elem_pos(ws, sel, vp)
    if pos:
        click_at(*pos, dur=0.4)
        await asyncio.sleep(0.15)
        if use_paste:
            paste_text(text)
        else:
            human_type_text(text)
        await asyncio.sleep(0.2)


async def set_select(ws, sel, value):
    """Set a <select> value via CDP and dispatch change event."""
    escaped = value.replace("'", "\\'")
    await js_eval(ws, (
        f"(()=>{{const s=document.querySelector('{sel}');"
        f"s.value='{escaped}';"
        "s.dispatchEvent(new Event('change',{bubbles:true}))}})()"))
    await asyncio.sleep(0.3)


async def select_dropdown(ws, sel, value, vp, n_down=1):
    """Click dropdown, arrow-key to option, press Enter.
    Falls back to CDP value setting for reliability."""
    pos = await elem_pos(ws, sel, vp)
    if pos:
        click_at(*pos, dur=0.4)
        await asyncio.sleep(0.4)
        for _ in range(n_down):
            pyautogui.press('down')
            await asyncio.sleep(0.15)
        await asyncio.sleep(0.3)
        pyautogui.press('enter')
        await asyncio.sleep(0.3)
    # Ensure value is set via CDP (backup)
    await set_select(ws, sel, value)


async def set_input_value(ws, sel, value):
    """Set an input value via CDP (for date/time inputs)."""
    escaped = value.replace("'", "\\'")
    await js_eval(ws, (
        f"(()=>{{const e=document.querySelector('{sel}');"
        f"e.value='{escaped}';"
        "e.dispatchEvent(new Event('input',{bubbles:true}));"
        "e.dispatchEvent(new Event('change',{bubbles:true}))}})()"))


def pad_scene(start_time, target_duration, label=""):
    """Sleep for remaining scene duration."""
    elapsed = time.time() - start_time
    remaining = target_duration - elapsed
    if remaining > 0.5:
        if label:
            print(f"    [PAD] {label}: {remaining:.1f}s remaining")
        time.sleep(remaining)
    elif remaining < -1:
        print(f"    [OVER] Scene ran {abs(remaining):.1f}s over target")


# ═══════════════════════════════════════════════════════════
#  SCENE 01: HOOK (30.53s)
#  Booking page -- select meeting reason + host
# ═══════════════════════════════════════════════════════════
async def scene_01(ws, vp):
    print("\n  ▶ Scene 01: Hook -- Booking Page (30.53s)")
    t0 = time.time()

    # Navigate to booking page
    await navigate(ws, BOOK_URL)
    vp.update(await get_viewport_info(ws))
    await asyncio.sleep(1.5)

    # Click meeting reason dropdown
    print("    Selecting meeting reason...")
    await select_dropdown(
        ws, "#meeting-reason",
        "Pre-Screen Discovery Call | 30 mins", vp, n_down=1
    )
    await asyncio.sleep(1.5)  # Narration: "categorizes the deal..."

    # Hover over meeting host (Round Robin)
    print("    Showing host selection...")
    pos = await elem_pos(ws, "#meeting-host", vp)
    if pos:
        move_to(*pos, dur=0.5)
        await asyncio.sleep(1.0)

    # Click "Documentation" link in header
    print("    Navigating to Documentation...")
    await click_elem(ws, "#nav-docs-page", vp)
    await asyncio.sleep(2.0)
    vp.update(await get_viewport_info(ws))
    await wait_for_selector(ws, "#comp-01", timeout=5)

    # Scroll down to dynamic host rules table
    print("    Scrolling to Booking Page doc section...")
    await js_eval(ws, "document.querySelector('#comp-01').scrollIntoView()")
    await asyncio.sleep(1.0)
    
    # Hover over host rules table
    table_pos = await elem_pos(ws, "#comp-01 table", vp)
    if table_pos:
        move_to(*table_pos, dur=0.5)
    await asyncio.sleep(3.5) # Let the user see the table

    # Click "Booking Page" header link to go back
    print("    Returning to booking page...")
    await click_elem(ws, "header a[href='/book']", vp)
    await asyncio.sleep(2.0)
    vp.update(await get_viewport_info(ws))
    await wait_for_selector(ws, "#meeting-reason", timeout=5)

    # Re-select meeting reason since page reloaded
    print("    Re-selecting meeting reason...")
    await select_dropdown(
        ws, "#meeting-reason",
        "Pre-Screen Discovery Call | 30 mins", vp, n_down=1
    )
    await asyncio.sleep(1.0)

    # Click "Next: View Availability"
    print("    Clicking Next...")
    await click_elem(ws, "#btn-next-step", vp)
    await asyncio.sleep(1)

    pad_scene(t0, SCENE_DURATIONS["01_hook"], "Scene 01")


# ═══════════════════════════════════════════════════════════
#  SCENE 02: CONTEXT (20.86s)
#  Calendar date/time + contact form + submit + copy intake
# ═══════════════════════════════════════════════════════════
async def scene_02(ws, vp):
    print("\n  ▶ Scene 02: Context -- Calendar & Form (20.86s)")
    t0 = time.time()
    vp.update(await get_viewport_info(ws))

    # Click a calendar day (day 27 -- 2 days from now to respect buffer)
    print("    Selecting calendar date...")
    await click_elem(ws, ".calendar-day[data-day='27']", vp, dur=0.4)
    await asyncio.sleep(1.2)

    # Click a time slot (10:00 AM)
    print("    Selecting time slot...")
    time_slot = await elem_pos(ws, ".time-slot-btn", vp)
    if time_slot:
        click_at(*time_slot, dur=0.4)
    await asyncio.sleep(1.0)

    # Click "Next: Enter Your Details"
    print("    Confirming booking slot...")
    await click_elem(ws, "#btn-confirm-booking", vp)
    await asyncio.sleep(0.8)
    vp.update(await get_viewport_info(ws))

    # Fill contact form fields
    print("    Filling contact details...")
    await type_into(ws, "#booking-name", "Sarah Chen", vp)
    await type_into(ws, "#booking-email",
                    "sarah.chen@meridianlogistics.com.au", vp, use_paste=True)
    await type_into(ws, "#booking-company", "Meridian Logistics", vp)
    await type_into(ws, "#booking-position", "Head of FP&A", vp, use_paste=True)
    # Select service track
    await set_select(ws, "#booking-track", "Planning & Analytics (TM1)")
    await asyncio.sleep(0.3)
    await type_into(ws, "#booking-url",
                    "https://meridianlogistics.com.au", vp, use_paste=True)
    await type_into(ws, "#booking-phone", "+61 2 9876 5432", vp, use_paste=True)
    # Discussion topics (paste -- realistic for pre-written text)
    await type_into(ws, "#booking-discuss", DISCUSS_TEXT, vp, use_paste=True)

    # Submit the form
    print("    Submitting booking...")
    await click_elem(ws, "#btn-submit-booking", vp)
    await asyncio.sleep(1.2)

    # Copy intake summary
    print("    Copying intake summary...")
    await click_elem(ws, "#btn-copy-intake", vp)
    # Also set clipboard manually for reliability
    pyperclip.copy(INTAKE_TEXT)
    await asyncio.sleep(0.5)

    pad_scene(t0, SCENE_DURATIONS["02_context"], "Scene 02")


# ═══════════════════════════════════════════════════════════
#  SCENE 03: CHAT WIDGET (27.65s)
#  Sales dashboard -- paste intake summary, click Parse Form
# ═══════════════════════════════════════════════════════════
async def scene_03(ws, vp):
    print("\n  ▶ Scene 03: Dashboard -- Paste & Parse (27.65s)")
    t0 = time.time()

    # Navigate to dashboard
    await navigate(ws, DASH_URL)
    vp.update(await get_viewport_info(ws))
    await asyncio.sleep(1.5)

    # Enable demo mode silently (makes Load Sample visible as fallback)
    await js_eval(ws, "localStorage.setItem('tiny_demo_mode','true')")

    # Survey the dashboard
    move_to(vp["wx"] + vp["sidebar"] + vp["vw"] // 2,
            vp["wy"] + vp["toolbar"] + 200, dur=0.6)
    await asyncio.sleep(2)

    # Click into the intake textarea
    print("    Pasting intake summary...")
    await type_into(ws, "#prep-intake", INTAKE_TEXT, vp, use_paste=True)
    await asyncio.sleep(2)

    # Click "Parse Form"
    print("    Clicking Parse Form...")
    await click_elem(ws, "#prep-parse-btn", vp)
    await asyncio.sleep(2)

    # Scroll down slowly to show auto-populated fields
    print("    Showing populated fields...")
    await asyncio.sleep(1)
    scroll_down(clicks=5, delay=0.15)
    await asyncio.sleep(2)

    # Scroll back up
    scroll_up(clicks=3, delay=0.12)
    await asyncio.sleep(1)

    pad_scene(t0, SCENE_DURATIONS["03_chat_widget"], "Scene 03")


# ═══════════════════════════════════════════════════════════
#  SCENE 04: LEAD CAPTURE (32.98s)
#  LinkedIn upload + GDrive file attachment
# ═══════════════════════════════════════════════════════════
async def scene_04(ws, vp):
    print("\n  ▶ Scene 04: Lead Capture -- LinkedIn & GDrive (32.98s)")
    t0 = time.time()
    vp.update(await get_viewport_info(ws))

    # Scroll down to LinkedIn section
    scroll_down(clicks=4, delay=0.12)
    await asyncio.sleep(1)

    # Paste LinkedIn profile text
    print("    Pasting LinkedIn profile...")
    await type_into(ws, "#prep-linkedin", LINKEDIN_TEXT, vp, use_paste=True)
    await asyncio.sleep(3)

    # Scroll down to GDrive section
    scroll_down(clicks=3, delay=0.12)
    await asyncio.sleep(1.5)

    # Click "Browse Folders"
    print("    Opening GDrive browser...")
    await click_elem(ws, "#prep-gdrive-browse-btn", vp)
    await asyncio.sleep(2)

    # Type search query in GDrive search
    print("    Searching GDrive...")
    await type_into(ws, "#prep-gdrive-search", "Meridian", vp)
    await asyncio.sleep(2)

    # Inject mock GDrive file attachment via CDP (for reliable visual)
    print("    Attaching SOW file...")
    await js_eval(ws, (
        "(()=>{"
        "const b=document.querySelector('#gdrive-attached-badge');"
        "const n=document.querySelector('#gdrive-attached-name');"
        "if(b&&n){b.style.display='flex';n.textContent='Meridian_Logistics_SOW_2025.pdf'}"
        "window.attachedGDriveFileContent="
        "'HISTORICAL SOW: Meridian Logistics TM1 Implementation 2025';"
        "})()"
    ))
    await asyncio.sleep(2)

    # Scroll up to show the attached badge
    scroll_up(clicks=2, delay=0.1)
    await asyncio.sleep(1)

    # Hover over the attached file badge
    badge_pos = await elem_pos(ws, "#gdrive-attached-badge", vp)
    if badge_pos:
        move_to(*badge_pos, dur=0.5)
    await asyncio.sleep(3)

    pad_scene(t0, SCENE_DURATIONS["04_lead_capture"], "Scene 04")


# ═══════════════════════════════════════════════════════════
#  SCENE 05: SMART BOOKING (32.09s)
#  Generate Prep Briefing -- AI dossier output
# ═══════════════════════════════════════════════════════════
async def scene_05(ws, vp):
    print("\n  ▶ Scene 05: Smart Booking -- Prep Briefing (32.09s)")
    t0 = time.time()
    vp.update(await get_viewport_info(ws))

    # Scroll up to see the Generate button
    scroll_up(clicks=5, delay=0.1)
    await asyncio.sleep(1)

    # Click "Generate Prep Briefing"
    print("    Clicking Generate Prep Briefing...")
    await click_elem(ws, "#prep-submit-btn", vp)
    await asyncio.sleep(3)

    # Wait for AI output (poll for content in output panel)
    print("    Waiting for AI dossier generation...")
    for i in range(20):
        r = await js_eval(ws,
            "document.querySelector('#output-console').classList.contains('has-content')",
            return_value=True)
        has_content = r.get("result", {}).get("value", False)
        if has_content:
            print(f"    Dossier generated after ~{(i+1)*1.5:.0f}s")
            break
        await asyncio.sleep(1.5)
    else:
        print("    [WARN] Dossier generation timed out (30s). Continuing...")

    await asyncio.sleep(2)

    # Scroll through the output panel to show dossier sections
    print("    Scrolling through dossier output...")
    # Move mouse to the output panel (right side)
    output_pos = await elem_pos(ws, "#output-results", vp)
    if output_pos:
        move_to(*output_pos, dur=0.5)
        await asyncio.sleep(1)
        scroll_down(clicks=4, delay=0.2)
        await asyncio.sleep(2)
        scroll_down(clicks=3, delay=0.2)
    await asyncio.sleep(1)

    pad_scene(t0, SCENE_DURATIONS["05_smart_booking"], "Scene 05")


# ═══════════════════════════════════════════════════════════
#  SCENE 06: SMART ROUTING (29.57s)
#  Session tab -- question cards + positional meeting
# ═══════════════════════════════════════════════════════════
async def scene_06(ws, vp):
    print("\n  ▶ Scene 06: Smart Routing -- Session Tab (29.57s)")
    t0 = time.time()
    vp.update(await get_viewport_info(ws))

    # Scroll to top first
    scroll_up(clicks=10, delay=0.05)
    await asyncio.sleep(0.5)

    # Click "SESSION" step indicator (Step 2)
    print("    Switching to Session tab...")
    await click_elem(ws, "#step-2-indicator", vp)
    await asyncio.sleep(1.5)

    # Survey the teleprompter/question cards
    print("    Showing teleprompter...")
    teleprompter = await elem_pos(ws, "#battlecard-body", vp)
    if teleprompter:
        move_to(*teleprompter, dur=0.5)
        await asyncio.sleep(1.0)

    # Click "Documentation" header link
    print("    Navigating to Documentation for Question Playbook...")
    await click_elem(ws, "header a[href='/docs']", vp)
    await asyncio.sleep(2.0)
    vp.update(await get_viewport_info(ws))
    await wait_for_selector(ws, "#comp-03", timeout=5)

    # Scroll to Variant A questions
    print("    Scrolling to Playbook Variant A...")
    await js_eval(ws, "document.querySelector('#comp-03').scrollIntoView()")
    await asyncio.sleep(1.0)
    scroll_down(clicks=5, delay=0.15)
    await asyncio.sleep(2.5)

    # Click "Launch Console" to return
    print("    Returning to Console...")
    await click_elem(ws, "header a.btn-launch", vp)
    await asyncio.sleep(2.0)
    vp.update(await get_viewport_info(ws))
    await wait_for_selector(ws, "#step-2-indicator", timeout=5)

    # Switch back to Step 2 since reload reset it
    print("    Switching back to Step 2...")
    await click_elem(ws, "#step-2-indicator", vp)
    await asyncio.sleep(1.5)

    # Scroll down to Positional Meeting section
    print("    Booking positional meeting...")
    scroll_down(clicks=5, delay=0.15)
    await asyncio.sleep(1.0)

    # Click "Confirm Booking"
    print("    Confirming positional meeting...")
    await click_elem(ws, "#positional-confirm-btn", vp)
    await asyncio.sleep(1.5)

    pad_scene(t0, SCENE_DURATIONS["06_smart_routing"], "Scene 06")


# ═══════════════════════════════════════════════════════════
#  SCENE 07: DASHBOARD (27.55s)
#  Call Directory -- browse recordings
# ═══════════════════════════════════════════════════════════
async def scene_07(ws, vp):
    print("\n  ▶ Scene 07: Transition -- Step 2 to Reports (27.55s)")
    t0 = time.time()
    vp.update(await get_viewport_info(ws))

    # Scroll to top
    scroll_up(clicks=10, delay=0.05)
    await asyncio.sleep(0.5)

    # Survey the Step 2 call outcome status
    print("    Reviewing call outcome status...")
    pos = await elem_pos(ws, ".outcome-btn[data-outcome='completed']", vp)
    if pos:
        move_to(*pos, dur=0.5)
    await asyncio.sleep(2)

    # Navigate to Step 3 (Reports)
    print("    Navigating to Step 3 (Reports)...")
    await click_elem(ws, "#step-2-next-btn", vp)
    await asyncio.sleep(1.5)

    # Survey the Reports tab layout
    print("    Surveying Reports tab...")
    center_x = vp["wx"] + vp["sidebar"] + vp["vw"] // 2
    center_y = vp["wy"] + vp["toolbar"] + vp["vh"] // 2
    move_to(center_x, center_y, dur=0.6)
    await asyncio.sleep(2.5)

    # Show the transcript text area
    print("    Showing transcript input...")
    transcript_pos = await elem_pos(ws, "#synth-transcript", vp)
    if transcript_pos:
        move_to(*transcript_pos, dur=0.5)
    await asyncio.sleep(3)

    # Show the report type buttons
    scroll_down(clicks=3, delay=0.12)
    await asyncio.sleep(3)

    pad_scene(t0, SCENE_DURATIONS["07_dashboard"], "Scene 07")


# ═══════════════════════════════════════════════════════════
#  SCENE 08: RECAP (29.11s)
#  Reports tab -- paste transcript, synthesize reports
# ═══════════════════════════════════════════════════════════
async def scene_08(ws, vp):
    print("\n  ▶ Scene 08: Recap -- Synthesize Reports (29.11s)")
    t0 = time.time()
    vp.update(await get_viewport_info(ws))

    # We are already on Step 3 from scene 07
    # Scroll up to show transcript area
    scroll_up(clicks=3, delay=0.1)
    await asyncio.sleep(0.5)

    # Paste transcript
    print("    Pasting call transcript...")
    await type_into(ws, "#synth-transcript", TRANSCRIPT_TEXT, vp, use_paste=True)
    await asyncio.sleep(1.5)

    # Click "Generate All Reports"
    print("    Clicking Synthesize Call Reports...")
    scroll_down(clicks=2, delay=0.1)
    await asyncio.sleep(0.5)
    await click_elem(ws, "#synth-submit-btn", vp)
    await asyncio.sleep(2)

    # Wait for AI synthesis (poll for output)
    print("    Waiting for report generation...")
    for i in range(15):
        r = await js_eval(ws,
            "document.querySelector('#output-console').classList.contains('has-content')",
            return_value=True)
        has_content = r.get("result", {}).get("value", False)
        if has_content:
            print(f"    Reports generated after ~{(i+1)*1.5:.0f}s")
            break
        await asyncio.sleep(1.5)

    await asyncio.sleep(1)

    # Click "Documentation" header link
    print("    Navigating to Documentation for Services Catalog...")
    await click_elem(ws, "header a[href='/docs']", vp)
    await asyncio.sleep(2.0)
    vp.update(await get_viewport_info(ws))
    await wait_for_selector(ws, "#comp-05", timeout=5)

    # Scroll down to Reports & Synthesis section
    print("    Scrolling to Reports & Synthesis section...")
    await js_eval(ws, "document.querySelector('#comp-05').scrollIntoView()")
    await asyncio.sleep(1.0)
    scroll_down(clicks=4, delay=0.15)
    await asyncio.sleep(3.0)

    # Click "Launch Console" to return
    print("    Returning to Console...")
    await click_elem(ws, "header a.btn-launch", vp)
    await asyncio.sleep(2.0)
    vp.update(await get_viewport_info(ws))

    # Review generated reports directly
    print("    Reviewing synthesized reports...")
    output_pos = await elem_pos(ws, "#output-results", vp)
    if output_pos:
        move_to(*output_pos, dur=0.4)
        await asyncio.sleep(0.5)
        scroll_down(clicks=3, delay=0.2)
    await asyncio.sleep(1.5)

    pad_scene(t0, SCENE_DURATIONS["08_recap"], "Scene 08")


# ═══════════════════════════════════════════════════════════
#  SCENE 09: CTA (23.64s)
#  Review deliverables, copy proposal
# ═══════════════════════════════════════════════════════════
async def scene_09(ws, vp):
    print("\n  ▶ Scene 09: CTA -- Review & Copy (23.64s)")
    t0 = time.time()
    vp.update(await get_viewport_info(ws))

    # Click "Recap Email" doc tab
    print("    Viewing Recap Email...")
    await click_elem(ws, "#output-doc-nav button[data-doc='recapEmail']", vp)
    await asyncio.sleep(3)

    # Scroll through email content
    output_pos = await elem_pos(ws, "#output-doc-content", vp)
    if output_pos:
        move_to(*output_pos, dur=0.4)
        scroll_down(clicks=3, delay=0.2)
    await asyncio.sleep(2)

    # Click "Proposal" doc tab
    print("    Viewing Proposal...")
    await click_elem(ws, "#output-doc-nav button[data-doc='proposal']", vp)
    await asyncio.sleep(3)

    # Scroll through proposal
    if output_pos:
        scroll_up(clicks=3, delay=0.1)
        await asyncio.sleep(1)
        scroll_down(clicks=4, delay=0.2)
    await asyncio.sleep(2)

    # Click "Copy" button
    print("    Copying deliverable...")
    await click_elem(ws, "#copy-content-btn", vp)
    await asyncio.sleep(2)

    pad_scene(t0, SCENE_DURATIONS["09_cta"], "Scene 09")


# ═══════════════════════════════════════════════════════════
#  FFmpeg SCREEN CAPTURE
# ═══════════════════════════════════════════════════════════
def start_recording(vp):
    """Start FFmpeg screen capture of the Chrome viewport region."""
    # Capture region: Chrome window area (includes toolbar for now; crop later)
    capture_w = vp["vw"] + vp["sidebar"] * 2
    capture_h = vp["vh"] + vp["toolbar"]
    offset_x = vp["wx"]
    offset_y = vp["wy"]

    cmd = [
        FFMPEG, "-y",
        "-f", "gdigrab",
        "-framerate", "30",
        "-offset_x", str(offset_x),
        "-offset_y", str(offset_y),
        "-video_size", f"{capture_w}x{capture_h}",
        "-draw_mouse", "1",
        "-i", "desktop",
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        str(RAW_FILE),
    ]
    print(f"  [REC] Capture region: {capture_w}x{capture_h} at ({offset_x},{offset_y})")
    print(f"  [REC] Output: {RAW_FILE}")

    proc = subprocess.Popen(
        cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    return proc


def stop_recording(proc):
    """Stop FFmpeg and remux to MP4."""
    print(f"\n  [REC] Stopping recording...")
    try:
        proc.stdin.write(b"q")
        proc.stdin.flush()
        proc.wait(timeout=15)
    except Exception as e:
        print(f"  [WARN] FFmpeg stop: {e}")
        proc.kill()

    # Remux MKV -> MP4
    if RAW_FILE.exists():
        print(f"  [REMUX] Converting to MP4...")
        subprocess.run(
            [FFMPEG, "-y", "-i", str(RAW_FILE), "-c", "copy", str(FINAL_FILE)],
            capture_output=True, timeout=120,
        )
        size_mb = os.path.getsize(str(FINAL_FILE)) / (1024 * 1024)
        print(f"  [OK] {FINAL_FILE.name} ({size_mb:.1f} MB)")
        RAW_FILE.unlink(missing_ok=True)


# ═══════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════
async def main():
    print("=" * 60)
    print("  Tiny AI Assistant -- Enterprise Demo Recorder")
    print("=" * 60)

    # Load dynamic timing durations
    global SCENE_DURATIONS
    SCENE_DURATIONS = load_scene_durations()

    # Find Chrome CDP
    ws_url = await get_cdp_ws_url()
    if not ws_url:
        print("\n  [ERROR] Cannot find Chrome DevTools WebSocket.")
        print("  Start Chrome with: chrome --remote-debugging-port=9222")
        sys.exit(1)
    print(f"\n  Chrome CDP: {ws_url}")

    async with websockets.connect(ws_url, max_size=10 * 1024 * 1024) as ws:
        # Position Chrome window at top-left, set size
        print("  [SETUP] Positioning Chrome window...")
        try:
            target_r = await cdp(ws, "Browser.getWindowForTarget", {})
            wid = target_r.get("windowId")
            if wid:
                await cdp(ws, "Browser.setWindowBounds", {
                    "windowId": wid,
                    "bounds": {"left": 0, "top": 0, "width": 1296, "height": 900,
                               "windowState": "normal"}
                })
                await asyncio.sleep(1)
        except Exception as e:
            print(f"  [WARN] Could not position window: {e}")

        # Get viewport info
        vp = await get_viewport_info(ws)
        print(f"  [SETUP] Viewport: {vp['vw']}x{vp['vh']}, "
              f"toolbar: {vp['toolbar']}px, sidebar: {vp['sidebar']}px")
        print(f"  [SETUP] Window at: ({vp['wx']}, {vp['wy']})")

        # Start FFmpeg recording
        ffmpeg_proc = start_recording(vp)
        await asyncio.sleep(2)  # Let FFmpeg stabilize

        # Run all 9 scenes
        scene_fns = [
            scene_01, scene_02, scene_03, scene_04, scene_05,
            scene_06, scene_07, scene_08, scene_09,
        ]
        try:
            for fn in scene_fns:
                await fn(ws, vp)
        except Exception as e:
            print(f"\n  [ERROR] Scene failed: {e}")
            import traceback
            traceback.print_exc()

        # Hold final frame
        await asyncio.sleep(2)

        # Stop recording
        stop_recording(ffmpeg_proc)

    # Summary
    total_dur = sum(SCENE_DURATIONS.values())
    print("\n" + "=" * 60)
    print("  RECORDING COMPLETE")
    print("=" * 60)
    print(f"\n  Raw recording:   {FINAL_FILE}")
    print(f"  Target duration: {total_dur:.1f}s ({total_dur/60:.1f} min)")
    print(f"\n  Next steps:")
    print(f"    1. python polish_video.py {FINAL_FILE}")
    print(f"    2. python assemble_screencast.py output/polished.mp4")
    print()


if __name__ == "__main__":
    asyncio.run(main())
