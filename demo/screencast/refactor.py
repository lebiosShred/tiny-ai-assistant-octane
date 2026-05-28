import re

with open("record_playwright.py", "r") as f:
    code = f.read()

header_inject = """
PACING_FILE = SCRIPT_DIR / "pacing_timeline.json"
METADATA_FILE = SCRIPT_DIR / "audio" / "narration_metadata.json"

PACING_DATA = {}
try:
    with open(PACING_FILE, "r") as f:
        raw = json.load(f)
        for s in raw:
            PACING_DATA[s["scene_id"]] = {a["name"]: a["trigger_time_s"] for a in s["actions"]}
except Exception as e:
    print(f"  [WARN] Failed to load pacing data: {e}")

SCENE_DURATIONS = {}
try:
    with open(METADATA_FILE, "r") as f:
        meta = json.load(f)
        for s in meta.get("sections", []):
            SCENE_DURATIONS[s["name"]] = s["duration_s"]
except Exception as e:
    print(f"  [WARN] Failed to load audio metadata: {e}")

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
"""

code = code.replace('BASE_URL = "http://localhost:8080"', header_inject + '\nBASE_URL = "http://localhost:8080"')

# Update scene signatures
for i in range(1, 10):
    code = code.replace(f"def scene_0{i}_", f"def scene_0{i}_") # find name

code = re.sub(r'def scene_(\w+)\(page\):', r'def scene_\1(page, scene_id):', code)

# Inject sync_action calls
injections = {
    "Selecting meeting reason...": 'sync_action(page, scene_id, "select_reason")',
    
    "Clicking Next...": 'sync_action(page, scene_id, "click_calendar")',
    "Filling details form...": 'sync_action(page, scene_id, "fill_form")',
    "Submitting booking...": 'sync_action(page, scene_id, "submit_booking")',
    
    "Pasting intake text...": 'sync_action(page, scene_id, "paste_intake")',
    "Clicking Parse Form...": 'sync_action(page, scene_id, "click_parse")',
    
    "Pasting LinkedIn profile...": 'sync_action(page, scene_id, "paste_linkedin")',
    "Opening GDrive browser...": 'sync_action(page, scene_id, "click_gdrive")',
    "Searching GDrive...": 'sync_action(page, scene_id, "search_gdrive")',
    "Attaching SOW file...": 'sync_action(page, scene_id, "attach_sow")',
    
    "Clicking Generate Prep Briefing...": 'sync_action(page, scene_id, "click_generate_briefing")',
    "Navigating back to Step 1 Prep view to review dossier...": 'sync_action(page, scene_id, "view_dossier")',
    
    "Navigating to Step 2 (Session)...": 'sync_action(page, scene_id, "click_session_tab")',
    "Clicking Completed call outcome...": 'sync_action(page, scene_id, "click_completed")',
    "Navigating to Documentation for Question Playbook (new tab)...": 'sync_action(page, scene_id, "view_docs")',
    "Setting date to: {}": 'sync_action(page, scene_id, "set_positional_meeting")',
    "Confirming positional meeting...": 'sync_action(page, scene_id, "confirm_booking")',
    
    "Reviewing call outcome status...": 'sync_action(page, scene_id, "review_outcome")',
    "Navigating to Step 3 (Reports)...": 'sync_action(page, scene_id, "click_reports_tab")',
    
    "Pasting call transcript...": 'sync_action(page, scene_id, "paste_transcript")',
    "Clicking Synthesize Call Reports...": 'sync_action(page, scene_id, "click_synthesize")',
    "Navigating to Documentation for Services Catalog (new tab)...": 'sync_action(page, scene_id, "view_docs")',
    "Reviewing synthesized reports...": 'sync_action(page, scene_id, "review_reports")',
    
    "Viewing Recap Email...": 'sync_action(page, scene_id, "view_recap_email")',
    "Viewing Proposal...": 'sync_action(page, scene_id, "view_proposal")',
    "Copying proposal to clipboard...": 'sync_action(page, scene_id, "click_copy")'
}

for text, inject in injections.items():
    code = code.replace(f'print("    {text}")', f'print("    {text}")\n    {inject}')
    # Also handle the formatted string one
    if "{}" in text:
        code = code.replace(f'print("    {text}".format', f'print("    {text}".format(future_date))\n    {inject}')

# Add end_scene_sync
for i in range(1, 10):
    match = re.search(rf'def scene_0{i}_.*?(?=def scene_0|\Z)', code, re.DOTALL)
    if match:
        block = match.group(0)
        # Find the last line that is indented
        lines = block.split('\n')
        # Insert end_scene_sync(page, scene_id) before the next def
        lines.insert(-2, f'    end_scene_sync(page, scene_id)')
        new_block = '\n'.join(lines)
        code = code.replace(block, new_block)

# Update the caller
code = code.replace("scene_fn(page)", "global SCENE_START_TIME\n                SCENE_START_TIME = time.time()\n                scene_fn(page, scene_id)")

# Change title
code = code.replace("Playwright Viewport Recorder (Freeze-Frame Mode)", "Playwright Viewport Recorder (Gemini Pacing Mode)")

with open("record_playwright.py", "w") as f:
    f.write(code)

print("Refactor complete.")
