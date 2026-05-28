#!/usr/bin/env python3
import argparse
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR / "recording"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TIMELINE_FILE = OUTPUT_DIR / "timeline.json"
MOUSE_HELPER_PATH = SCRIPT_DIR / "mouse_helper.js"

PACING_FILE = SCRIPT_DIR / "pacing_timeline.json"
METADATA_FILE = SCRIPT_DIR / "audio" / "narration_metadata.json"

PACING_DATA = {}
try:
    if PACING_FILE.exists():
        with open(PACING_FILE, "r") as f:
            raw = json.load(f)
            for s in raw:
                PACING_DATA[s["scene_id"]] = {a["name"]: a["trigger_time_s"] for a in s["actions"]}
except Exception as e:
    pass

SCENE_DURATIONS = {}
try:
    if METADATA_FILE.exists():
        with open(METADATA_FILE, "r") as f:
            meta = json.load(f)
            for s in meta.get("sections", []):
                SCENE_DURATIONS[s["name"]] = s["duration_s"]
except Exception as e:
    pass

SCENE_START_TIME = 0

def sync_action(page, scene_id, action_name):
    target = PACING_DATA.get(scene_id, {}).get(action_name)
    if not target:
        return
    elapsed = time.time() - SCENE_START_TIME
    if target > elapsed:
        wait_ms = (target - elapsed) * 1000
        print(f"    [SYNC] Pausing {wait_ms:.0f}ms for audio sync '{action_name}'...")
        page.wait_for_timeout(wait_ms)
        
def end_scene_sync(page, scene_id):
    target = SCENE_DURATIONS.get(scene_id)
    if not target:
        return
    elapsed = time.time() - SCENE_START_TIME
    if target > elapsed:
        wait_ms = (target - elapsed) * 1000
        print(f"    [SYNC] Padding scene end with {wait_ms:.0f}ms...")
        page.wait_for_timeout(wait_ms)

BASE_URL = "http://localhost:8080"
BOOK_URL = f"{BASE_URL}/demo/book.html"
DASH_URL = f"{BASE_URL}/demo/index.html?nocache={time.time()}"

DISCUSS_TEXT = "We need help consolidating 35 Excel-based planning models."

def smooth_move(page, selector, steps=15):
    locator = page.locator(selector).first
    locator.wait_for(state="visible", timeout=5000)
    locator.scroll_into_view_if_needed()
    box = locator.bounding_box()
    if box:
        x = box["x"] + box["width"] / 2
        y = box["y"] + box["height"] / 2
        page.mouse.move(x, y, steps=steps)
        page.wait_for_timeout(100)
        return x, y
    return None

def click_smoothly(page, selector, steps=15):
    pos = smooth_move(page, selector, steps=steps)
    if pos:
        page.mouse.down()
        page.wait_for_timeout(80)
        page.mouse.up()
        page.wait_for_timeout(150)

def type_smoothly(page, selector, text, delay=20, paste=False):
    click_smoothly(page, selector)
    if paste:
        page.locator(selector).fill(text)
        page.wait_for_timeout(200)
    else:
        page.type(selector, text, delay=delay)
        page.wait_for_timeout(150)

def scroll_smoothly(page, selector_or_window, pixels, steps=10, delay_ms=40):
    for i in range(steps):
        scroll_amt = int(pixels / steps)
        if selector_or_window == "window":
            page.evaluate(f"window.scrollBy(0, {scroll_amt})")
        else:
            page.evaluate(f"document.querySelector('{selector_or_window}').scrollBy(0, {scroll_amt})")
        page.wait_for_timeout(delay_ms)
    page.wait_for_timeout(200)

def scene_module_1_capture(page, scene_id):
    page.goto(BOOK_URL)
    page.reload()
    page.wait_for_timeout(1000)
    click_smoothly(page, "#custom-reason-trigger")
    page.wait_for_timeout(500)
    click_smoothly(page, ".custom-option[data-value='Pre-Screen Discovery Call | 30 mins']")
    page.wait_for_timeout(500)
    click_smoothly(page, "#btn-next-step")
    page.wait_for_selector(".calendar-day")
    click_smoothly(page, ".calendar-day[data-day='27']")
    page.wait_for_timeout(500)
    click_smoothly(page, ".time-slot-btn")
    click_smoothly(page, "#btn-confirm-booking")
    page.wait_for_selector("#booking-name")
    type_smoothly(page, "#booking-name", "Kevin Smith")
    type_smoothly(page, "#booking-email", "kevin.s@meridianlogistics.com.au", paste=True)
    type_smoothly(page, "#booking-company", "Meridian Logistics")
    type_smoothly(page, "#booking-position", "Supply Chain Manager", paste=True)
    click_smoothly(page, "#booking-track")
    page.select_option("#booking-track", label="Planning & Analytics (TM1)")
    type_smoothly(page, "#booking-url", "https://meridianlogistics.com.au", paste=True)
    type_smoothly(page, "#booking-phone", "+61 2 9876 5432", paste=True)
    type_smoothly(page, "#booking-discuss", DISCUSS_TEXT, paste=True)
    click_smoothly(page, "#btn-submit-booking")
    page.wait_for_selector("#success-time-display")
    end_scene_sync(page, scene_id)

def scene_module_2_routing(page, scene_id):
    # Mock the GDrive search endpoint for Meridian Logistics
    page.route('**/api/gdrive/search*', lambda route: route.fulfill(
        status=200,
        content_type='application/json',
        json={'items': [{
            'id': 'mock-meridian-123',
            'name': 'Meridian_Logistics_Requirements.pdf',
            'mimeType': 'application/pdf',
            'size': 125000,
            'isFolder': False
        }]}
    ))

    # Mock the GDrive read endpoint
    page.route('**/api/gdrive/read*', lambda route: route.fulfill(
        status=200,
        content_type='application/json',
        json={'content': 'Mock Meridian PDF Content'}
    ))

    # Mock the list folder
    page.route('**/api/gdrive/list*', lambda route: route.fulfill(
        status=200,
        content_type='application/json',
        json={'items': []}
    ))

    page.goto(DASH_URL)
    page.reload()
    page.wait_for_timeout(1500)
    
    # 1. Inject the "Email Alert" popup and "Mount Lead" button
    page.evaluate('''() => {
        const emailModal = document.createElement('div');
        emailModal.id = 'fake-email-modal';
        emailModal.style.position = 'fixed';
        emailModal.style.bottom = '-400px';
        emailModal.style.right = '30px';
        emailModal.style.width = '350px';
        emailModal.style.background = '#fff';
        emailModal.style.border = '1px solid #e0e0e0';
        emailModal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
        emailModal.style.borderRadius = '12px';
        emailModal.style.zIndex = '9999';
        emailModal.style.transition = 'bottom 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        emailModal.style.fontFamily = 'Inter, sans-serif';
        
        emailModal.innerHTML = `
            <div style="background: #1a73e8; color: white; padding: 12px 15px; border-radius: 12px 12px 0 0; font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>📧</span> New Booking Alert
                </div>
            </div>
            <div style="padding: 15px; font-size: 13px; color: #333;">
                <div style="font-weight: 600; margin-bottom: 5px; font-size: 14px;">Discovery Call Scheduled</div>
                <div style="color: #666; margin-bottom: 12px; font-size: 12px;">From: Sales System &lt;no-reply@octanesolutions.com.au&gt;</div>
                <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #eee; margin-bottom: 15px;">
                    <div style="margin-bottom: 4px;"><strong>Prospect:</strong> Kevin Smith</div>
                    <div style="margin-bottom: 4px;"><strong>Company:</strong> Meridian Logistics</div>
                    <div style="margin-bottom: 4px;"><strong>Email:</strong> kevin@meridian.com</div>
                    <div style="margin-bottom: 4px;"><strong>Topic:</strong> Planning & Analytics (TM1)</div>
                </div>
                <button id="mount-lead-btn" style="width: 100%; background: #000; color: #fff; border: none; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span>⚡</span> Mount Lead to Dashboard
                </button>
            </div>
        `;
        document.body.appendChild(emailModal);
        
        setTimeout(() => { emailModal.style.bottom = '30px'; }, 100);
        
        document.getElementById('mount-lead-btn').addEventListener('click', () => {
            emailModal.style.bottom = '-400px';
            setTimeout(() => emailModal.remove(), 600);
            
            const nameEl = document.getElementById('prep-name');
            const compEl = document.getElementById('prep-company');
            const titleEl = document.getElementById('prep-title');
            const emailEl = document.getElementById('prep-email');
            const phoneEl = document.getElementById('prep-phone');
            const urlEl = document.getElementById('prep-url');
            
            if(nameEl) nameEl.value = 'Kevin Smith';
            if(compEl) compEl.value = 'Meridian Logistics';
            if(titleEl) titleEl.value = 'Supply Chain Manager';
            if(emailEl) emailEl.value = 'kevin@meridian.com';
            if(phoneEl) phoneEl.value = '+61 2 9876 5432';
            if(urlEl) urlEl.value = 'meridian.com';
            
            [nameEl, compEl, titleEl, emailEl, phoneEl, urlEl].forEach(el => {
                if(el) {
                    el.style.backgroundColor = 'rgba(26, 115, 232, 0.1)';
                    setTimeout(() => { el.style.backgroundColor = ''; }, 1500);
                }
            });
        });
    }''')
    
    page.wait_for_timeout(3500)
    click_smoothly(page, "#mount-lead-btn")
    page.wait_for_timeout(1500)
    
    scroll_smoothly(page, "window", 400)
    page.wait_for_timeout(1000)
    
    click_smoothly(page, "#prep-gdrive-browse-btn")
    page.wait_for_timeout(1000)
    
    type_smoothly(page, "#prep-gdrive-search", "Meridian")
    page.wait_for_timeout(1500)
    
    page.wait_for_selector(".gdrive-btn-attach", timeout=5000)
    page.wait_for_timeout(800)
    
    click_smoothly(page, ".gdrive-btn-attach")
    page.wait_for_selector("#gdrive-attached-badge", timeout=5000)
    page.wait_for_timeout(1500)
    
    end_scene_sync(page, scene_id)

def setup_state_for_step(page, step):
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
    page.goto(DASH_URL)
    page.wait_for_selector("#prep-name", timeout=10000)
    if step >= 2:
        page.evaluate('''() => {
            document.getElementById('prep-name').value = 'Kevin Smith';
            document.getElementById('prep-company').value = 'Meridian Logistics';
            document.getElementById('prep-title').value = 'Supply Chain Manager';
            document.getElementById('prep-email').value = 'kevin@meridian.com';
            document.getElementById('prep-phone').value = '1234567890';
            const form = document.getElementById('prep-form');
            console.log("Form checkValidity before click:", form.checkValidity());
            if (!form.checkValidity()) {
                const invalid = form.querySelectorAll(':invalid');
                invalid.forEach(el => console.log("Invalid element:", el.id, el.validationMessage));
            }
            document.getElementById('prep-submit-btn').click();
            console.log("Click executed");
        }''')
        page.wait_for_timeout(1000)
        # Setup for step 2 recording logic
        # app.js automatically transitions to Step 2 via goToStep(2) after dossier generation
        page.wait_for_selector("#step-2-content.active", state="visible", timeout=60000)
    if step >= 3:
        page.evaluate('''() => {
            setTimeout(() => {
                const btn = document.querySelector('.outcome-btn[data-outcome="completed"]');
                if (btn) btn.click();
            }, 500);
        }''')
        page.wait_for_selector("#step-2-next-btn", state="visible", timeout=60000)
    page.wait_for_timeout(500)

def scene_module_3_preparation(page, scene_id):
    page.goto(DASH_URL)
    page.wait_for_timeout(1000)
    type_smoothly(page, "#prep-name", "Kevin Smith")
    type_smoothly(page, "#prep-title", "Supply Chain Manager")
    scroll_smoothly(page, "window", 400)
    click_smoothly(page, "#prep-submit-btn")
    page.wait_for_timeout(2000)
    end_scene_sync(page, scene_id)

def scene_module_4_execution(page, scene_id):
    setup_state_for_step(page, 2)
    page.wait_for_timeout(1000)
    click_smoothly(page, ".outcome-btn[data-outcome='completed']")
    scroll_smoothly(page, "window", 400)
    end_scene_sync(page, scene_id)

def scene_module_5_synthesis(page, scene_id):
    setup_state_for_step(page, 3)
    click_smoothly(page, "#step-2-next-btn")
    page.wait_for_timeout(1000)
    click_smoothly(page, "#synth-submit-btn")
    page.wait_for_timeout(2000)
    end_scene_sync(page, scene_id)

def scene_module_6_admin(page, scene_id):
    setup_state_for_step(page, 3)
    page.wait_for_timeout(2000)
    scroll_smoothly(page, "window", 200)
    end_scene_sync(page, scene_id)

SCENES = {
    "1": ("module_1_capture", scene_module_1_capture),
    "2": ("module_2_routing", scene_module_2_routing),
    "3": ("module_3_preparation", scene_module_3_preparation),
    "4": ("module_4_execution", scene_module_4_execution),
    "5": ("module_5_synthesis", scene_module_5_synthesis),
    "6": ("module_6_admin", scene_module_6_admin),
}

def main():
    parser = argparse.ArgumentParser(description="Modular Playwright Recorder")
    parser.add_argument("--module", type=str, help="Module number to record (1-6) or 'all'")
    args = parser.parse_args()
    
    modules_to_run = list(SCENES.keys()) if not args.module or args.module == "all" else [args.module]
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        for mod in modules_to_run:
            if mod not in SCENES:
                continue
            scene_id, scene_fn = SCENES[mod]
            context = browser.new_context(
                record_video_dir=str(OUTPUT_DIR),
                record_video_size={"width": 1280, "height": 800}
            )
            with open(MOUSE_HELPER_PATH, "r") as f:
                context.add_init_script(f.read())
            page = context.new_page(); page.set_default_timeout(120000)
            
            global SCENE_START_TIME
            SCENE_START_TIME = time.time()
            scene_fn(page, scene_id)
            
            video_path = page.video.path() if page.video else None
            context.close()
            
            if video_path:
                final_path = OUTPUT_DIR / f"{scene_id}.mp4"
                print(f"Renaming module {scene_id}...")
                os.replace(video_path, final_path)
                print(f"[SUCCESS] Recorded: {final_path}\n")
        browser.close()

if __name__ == "__main__":
    main()
