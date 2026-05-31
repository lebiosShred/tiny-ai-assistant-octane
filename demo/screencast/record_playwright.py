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
    print(f"  [WARN] Failed to load pacing data: {e}")

SCENE_DURATIONS = {}
try:
    if METADATA_FILE.exists():
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

BASE_URL = "http://localhost:8080"
BOOK_URL = f"{BASE_URL}/demo/book.html"
DASH_URL = f"{BASE_URL}/demo/index.html"
ADMIN_URL = f"{BASE_URL}/demo/admin_setup.html"

DISCUSS_TEXT = (
    "We need help consolidating 35 Excel-based planning models "
    "into a single TM1 instance. Our monthly close takes 3 weeks "
    "and we need to bring it down to 5 business days."
)

INTAKE_TEXT = (
    "BOOKING INTAKE SUMMARY\n"
    "========================\n"
    "Meeting Type: Pre-Screen Discovery Call | 30 mins\n"
    "Date: Monday, May 26, 2025 at 10:00 AM AEST\n\n"
    "Contact Details:\n"
    "Name: Kevin Smith\n"
    "Email: kevin.s@meridianlogistics.com.au\n"
    "Company: Meridian Logistics\n"
    "Position: Supply Chain Manager\n"
    "Service Track: Planning & Analytics (TM1)\n"
    "Website: https://meridianlogistics.com.au\n\n"
    "Discussion Topics:\n"
    + DISCUSS_TEXT
)

LINKEDIN_TEXT = (
    "Kevin Smith -- Supply Chain Manager at Meridian Logistics\n\n"
    "Experience:\n"
    "- Supply Chain Manager, Meridian Logistics (2021-Present)\n"
    "  Managing planning models across 12 divisions.\n\n"
    "- Operations Analyst, Linfox Logistics (2017-2021)\n"
)

TRANSCRIPT_TEXT = (
    "Albert: Hi Kevin, thanks for booking a pre-screen call with Octane.\n\n"
    "Kevin: We have 35 Excel planning models across 12 divisions. "
    "Our monthly close takes three weeks and we need to get it down to one week.\n\n"
    "Albert: That's a common challenge. Are you currently using any planning tool?\n\n"
    "Kevin: It's 100% Excel.\n\n"
    "Albert: What about your ERP? I see you're on NetSuite.\n\n"
    "Kevin: Yes, NetSuite for GL and AP. We export to Excel for planning.\n\n"
    "Albert: And what's your timeline for making a decision?\n\n"
    "Kevin: We need to present a recommendation to the CFO by end of Q3.\n\n"
    "Albert: Perfect. I'll book a positional meeting with Amendra to walk you through TM1."
)

MOCK_PREP_HTML = """
<div class="output-document">
<h3>Pre-Screen Prep Dossier <span class="badge-score hot">HOT</span></h3>
<h4>1. Company Snapshot</h4>
<p><strong>Meridian Logistics</strong> -- Australia's third-largest logistics provider. Annual revenue ~A$480M. 12 operating divisions across AU/NZ. Headquarters in Sydney.</p>
<h4>2. Decision Maker Profile</h4>
<p><strong>Kevin Smith</strong>, Supply Chain Manager. 4+ years at Meridian. Previously Operations Analyst at Linfox Logistics. Reports to CFO. Key mandate: operational efficiency and cost reduction.</p>
<h4>3. Technical Landscape</h4>
<p>ERP: NetSuite (GL, AP). Planning: 100% Excel (35 models across 12 divisions). No dedicated planning tool deployed. Monthly close cycle: 3 weeks.</p>
<h4>4. Pain Point Hypothesis</h4>
<ul><li>Excel sprawl across 12 divisions creating version control nightmares</li><li>3-week close cycle is 3x industry benchmark for this revenue band</li><li>No single source of truth for consolidated financial reporting</li></ul>
<h4>5. Competitor Mapping</h4>
<p>Likely evaluating: <strong>Anaplan</strong> (cloud-native), <strong>Vena Solutions</strong> (Excel-friendly), <strong>Jedox</strong> (mid-market). TM1/Planning Analytics is the strongest fit given their Excel dependency.</p>
<h4>6. Service Track Alignment</h4>
<p>Primary: <strong>Planning &amp; Analytics (TM1)</strong>. Secondary: NetSuite integration consulting for GL feed automation.</p>
<h4>7. Budget Signals</h4>
<p>Recent job postings for "Financial Systems Analyst" indicate active investment in finance transformation. No public funding rounds (private company).</p>
<h4>8. Conversation Starters</h4>
<ul><li>"I noticed you managed 35 planning models -- what's the biggest bottleneck during month-end?"</li><li>"Your Linfox background in fleet optimization -- are you applying similar rigor to financial planning here?"</li><li>"A 3-week close for a company your size is unusual -- is the CFO actively sponsoring the fix?"</li></ul>
<h4>9. Risk Flags</h4>
<ul><li>Decision timeline is Q3 -- could slip if CFO priorities shift</li><li>No existing planning tool means change management overhead is higher</li></ul>
<h4>10. Recommended Playbook</h4>
<p><strong>Variant A</strong> -- First-time buyer. Focus on ROI quantification and proof-of-concept demonstration. Lead with the 5-day close benchmark.</p>
</div>
"""

MOCK_SYNTH_HTML = {
    "questionnaireAnswers": (
        "<div class='output-document'>"
        "<h3>📋 Pre-Screen Questionnaire Answers</h3>"
        "<table style='width:100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 10px;'>"
        "<tr style='border-bottom: 1px solid rgba(255,255,255,0.08);'><th style='text-align:left; padding:8px; width:40%; color:var(--primary);'>Question</th><th style='text-align:left; padding:8px; color:var(--primary);'>Prospect Response</th></tr>"
        "<tr><td style='padding:8px; font-weight:600;'>1. Current monthly close cycle?</td><td style='padding:8px;'>Three weeks. Targets one week (5 business days).</td></tr>"
        "<tr><td style='padding:8px; font-weight:600;'>2. Quantity of Excel-based models?</td><td style='padding:8px;'>35 models across 12 business divisions.</td></tr>"
        "<tr><td style='padding:8px; font-weight:600;'>3. Primary general ledger system?</td><td style='padding:8px;'>NetSuite GL for all entities. Exporting is manual.</td></tr>"
        "<tr><td style='padding:8px; font-weight:600;'>4. Primary decision timeline?</td><td style='padding:8px;'>Recommendation to CFO by end of Q3.</td></tr>"
        "<tr><td style='padding:8px; font-weight:600;'>5. Budget pre-qualification status?</td><td style='padding:8px;'>Sponsor aware of indicative costs (~A$120k implementation).</td></tr>"
        "</table>"
        "</div>"
    ),
    "migrationReport": (
        "<div class='output-document'>"
        "<h3>📊 TM1 Consolidation & Migration Audit</h3>"
        "<h4>Current State Sprawl:</h4>"
        "<ul>"
        "<li>35 disconnected spreadsheets containing formula errors and broken cross-links.</li>"
        "<li>12 operational divisions reporting separately, causing massive reporting latency.</li>"
        "<li>Manual CSV exports from NetSuite creating security risks and high error rates.</li>"
        "</ul>"
        "<h4>Proposed TM1 Consolidation Architecture:</h4>"
        "<ul>"
        "<li><strong>Centralized Server:</strong> 1 cloud-hosted IBM Planning Analytics server.</li>"
        "<li><strong>Dimensions:</strong> 7 core dimensions (Entity, Division, Account, Time, Version, Currency, Measures).</li>"
        "<li><strong>Integration:</strong> Automated REST API feed directly linking NetSuite to TM1 cubes.</li>"
        "</ul>"
        "</div>"
    ),
    "recapEmail": (
        "<div class='output-document'>"
        "<h3>✉️ Follow-Up Recap Email</h3>"
        "<p><strong>Subject:</strong> Follow-up: Requirement Session & TM1 Plan -- Meridian Logistics</p>"
        "<p>Hi Kevin,</p>"
        "<p>Thank you for taking the time to discuss your planning challenges with us today. Below is a summary of the plan we discussed to consolidate your 35 Excel planning models and optimize your month-end close cycle:</p>"
        "<ul>"
        "<li><strong>Consolidation:</strong> Migrate all 12 operational divisions into a centralized IBM Planning Analytics (TM1) instance.</li>"
        "<li><strong>Automation:</strong> Replace manual CSV exports with a direct REST API feed from NetSuite.</li>"
        "<li><strong>Acceleration:</strong> Target reduction of your monthly close cycle from 3 weeks to 5 business days.</li>"
        "</ul>"
        "<p>As discussed, we've scheduled your technical Positional Meeting with Amendra Pratap for next week to finalize implementation scope. Let me know if you have any questions.</p>"
        "<p>Best regards,<br>Albert | Sales Team, Octane Solutions</p>"
        "</div>"
    ),
    "summarySheet": (
        "<div class='output-document'>"
        "<h3>📄 Executive Summary Sheet</h3>"
        "<table style='width:100%; border-collapse: collapse; font-size: 0.85rem;'>"
        "<tr><td style='padding:6px; font-weight:700; width:150px; color:var(--primary);'>Company:</td><td style='padding:6px;'>Meridian Logistics</td></tr>"
        "<tr><td style='padding:6px; font-weight:700; color:var(--primary);'>Prospect:</td><td style='padding:6px;'>Kevin Smith (Supply Chain Manager)</td></tr>"
        "<tr><td style='padding:6px; font-weight:700; color:var(--primary);'>Lead Rating:</td><td style='padding:6px;'><span style='background:#ef4444; color:white; padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.75rem;'>HOT</span></td></tr>"
        "<tr><td style='padding:6px; font-weight:700; color:var(--primary);'>Core Pain Point:</td><td style='padding:6px;'>3-week close cycle due to 35 manual Excel models across 12 divisions.</td></tr>"
        "<tr><td style='padding:6px; font-weight:700; color:var(--primary);'>Next Milestone:</td><td style='padding:6px;'>Positional Meeting with Amendra (Technical Lead) scheduled.</td></tr>"
        "</table>"
        "</div>"
    ),
    "notes": (
        "<div class='output-document'>"
        "<h3>📝 Timestamped Discovery Call Notes</h3>"
        "<ul style='list-style-type: none; padding-left: 0;'>"
        "<li style='margin-bottom:8px;'><strong>[00:00 - 05:00] Rapport & Expectations:</strong> Albert aligned call scope with Kevin. Established thirty-minute Discovery format.</li>"
        "<li style='margin-bottom:8px;'><strong>[05:00 - 15:00] Problem Definition:</strong> Kevin confirmed NetSuite is the ERP. Detailed pain of manual data pulls for 35 spreadsheets.</li>"
        "<li style='margin-bottom:8px;'><strong>[15:00 - 25:00] Solution Mapping:</strong> Aligned service track interest with Planning & Analytics (TM1).</li>"
        "<li style='margin-bottom:8px;'><strong>[25:00 - 30:00] Handover:</strong> Booked Positional Meeting. Confirmed Q3 budget and decision committee.</li>"
        "</ul>"
        "</div>"
    ),
    "proposal": (
        "<div class='output-document'>"
        "<h3>📋 Consultative Proposal Roadmap</h3>"
        "<h4>1. Implementation Phases & Timeline</h4>"
        "<ul>"
        "<li><strong>Phase 1: Design & Dimension Mapping (Weeks 1-3)</strong><br>Establish dimensions for 12 divisions. Total: A$45,000</li>"
        "<li><strong>Phase 2: Core Cube & Integration (Weeks 4-9)</strong><br>Deploy cloud instance and link NetSuite feed. Total: A$120,000</li>"
        "<li><strong>Phase 3: Rollout & User Acceptance (Weeks 10-21)</strong><br>Full training and month-end go-live. Total: A$280,000</li>"
        "</ul>"
        "<h4>2. Professional Services Cost Breakdown</h4>"
        "<table style='width:100%; border-collapse: collapse; font-size: 0.85rem; margin-top:10px;'>"
        "<tr style='background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.08);'><th style='text-align:left; padding:8px; color:var(--primary);'>Service Component</th><th style='text-align:right; padding:8px; color:var(--primary);'>Rate Class</th><th style='text-align:right; padding:8px; color:var(--primary);'>Investment</th></tr>"
        "<tr><td style='padding:8px;'>Architect & Dimension Design</td><td style='padding:8px; text-align:right;'>Level 5</td><td style='padding:8px; text-align:right; font-weight:600;'>A$45,000</td></tr>"
        "<tr><td style='padding:8px;'>Integration & TurboIntegrator Rules</td><td style='padding:8px; text-align:right;'>Level 4</td><td style='padding:8px; text-align:right; font-weight:600;'>A$120,000</td></tr>"
        "<tr><td style='padding:8px;'>Global Deployment & Division Training</td><td style='padding:8px; text-align:right;'>Level 3</td><td style='padding:8px; text-align:right; font-weight:600;'>A$280,000</td></tr>"
        "<tr style='border-top:2px solid rgba(255,255,255,0.15); font-weight:bold;'><td style='padding:8px;' colspan='2'>Total Professional Services</td><td style='padding:8px; text-align:right; color:var(--primary);'>A$445,000</td></tr>"
        "</table>"
        "<p style='font-size:0.75rem; color:var(--text-muted); margin-top:8px;'>* Pricing subject to Octane Standard Services Catalog v4.2 list rates.</p>"
        "</div>"
    ),
    "actionItems": (
        "<div class='output-document'>"
        "<h3>✅ Strategic Action Items</h3>"
        "<table style='width:100%; border-collapse: collapse; font-size: 0.85rem;'>"
        "<tr style='background:rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.08);'><th style='text-align:left; padding:8px; color:var(--primary);'>Action Required</th><th style='text-align:left; padding:8px; width:120px; color:var(--primary);'>Owner</th><th style='text-align:left; padding:8px; width:100px; color:var(--primary);'>Deadline</th></tr>"
        "<tr><td style='padding:8px;'>Send pre-screen Discovery Call recap email</td><td style='padding:8px; font-weight:600;'>Albert (Sales Team)</td><td style='padding:8px; color:#ef4444; font-weight:600;'>TODAY</td></tr>"
        "<tr><td style='padding:8px;'>Prepare TM1 presentation deck for Meridian</td><td style='padding:8px; font-weight:600;'>Amendra (Lead)</td><td style='padding:8px;'>May 29, 2026</td></tr>"
        "<tr><td style='padding:8px;'>Gather 3 priority spreadsheets for audit</td><td style='padding:8px; font-weight:600;'>Kevin (Meridian)</td><td style='padding:8px;'>June 02, 2026</td></tr>"
        "</table>"
        "</div>"
    ),
}

def inject_mock_output(page, html_content, is_collection=False):
    """Inject deterministic mock content into the output console, bypassing the LLM API."""
    import json
    if is_collection:
        # Store reports for tab switching
        page.evaluate(f"""() => {{
            window._mockReports = {json.dumps(html_content)};
            const outputConsole = document.querySelector('#output-console');
            const outputResults = document.querySelector('#output-results');
            const outputLoading = document.querySelector('#output-loading');
            const outputEmpty = document.querySelector('#output-empty-state');
            const outputDocNav = document.querySelector('#output-doc-nav');
            const outputDocContent = document.querySelector('#output-doc-content');
            if (outputLoading) {{
                outputLoading.style.display = 'none';
                outputLoading.classList.add('hidden');
            }}
            if (outputEmpty) {{
                outputEmpty.style.display = 'none';
                outputEmpty.classList.add('hidden');
            }}
            outputConsole.classList.add('has-content');
            outputResults.classList.remove('hidden');
            outputResults.style.display = 'flex';
            outputDocNav.classList.remove('hidden');
            outputDocNav.style.display = 'flex';
            // Show first report
            const firstKey = Object.keys(window._mockReports)[0];
            outputDocContent.innerHTML = window._mockReports[firstKey];
            // Wire up tab switching
            window.setDocTab = function(key) {{
                outputDocContent.innerHTML = window._mockReports[key] || '<p>No content</p>';
                document.querySelectorAll('#output-doc-nav .doc-tab-btn').forEach(b => b.classList.remove('active'));
                const activeBtn = document.querySelector('#output-doc-nav .doc-tab-btn[data-doc="' + key + '"]');
                if (activeBtn) activeBtn.classList.add('active');
            }};
        }}""")
    else:
        escaped = json.dumps(html_content)
        page.evaluate(f"""() => {{
            const outputConsole = document.querySelector('#output-console');
            const outputResults = document.querySelector('#output-results');
            const outputLoading = document.querySelector('#output-loading');
            const outputEmpty = document.querySelector('#output-empty-state');
            const outputDocNav = document.querySelector('#output-doc-nav');
            const outputDocContent = document.querySelector('#output-doc-content');
            if (outputLoading) {{
                outputLoading.style.display = 'none';
                outputLoading.classList.add('hidden');
            }}
            if (outputEmpty) {{
                outputEmpty.style.display = 'none';
                outputEmpty.classList.add('hidden');
            }}
            outputConsole.classList.add('has-content');
            outputResults.classList.remove('hidden');
            outputResults.style.display = 'flex';
            outputDocNav.classList.add('hidden');
            outputDocNav.style.display = 'none';
            outputDocContent.innerHTML = {escaped};
        }}""")

def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

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

def scene_module_2_booking(page, scene_id):
    page.goto(BOOK_URL)
    
    # [ENTERPRISE] Mock out HubSpot CRM Embed to avoid spamming production calendar
    page.route("**/MeetingsEmbedCode.js*", lambda route: route.fulfill(
        status=200,
        content_type="application/javascript",
        body="""
            setTimeout(() => {
                const container = document.querySelector('.meetings-iframe-container');
                if (container) {
                    container.innerHTML = `
                        <div class="calendar-mock-grid" id="calendar-days-grid" style="display:flex;gap:10px;">
                            <button type="button" class="calendar-day" data-day="27">27</button>
                        </div>
                        <button type="button" class="time-slot-btn" style="margin-top:10px;">10:30 AM</button>
                        <button type="button" id="btn-confirm-booking" class="booking-btn booking-btn--primary" style="margin-top:10px;">Confirm</button>
                    `;
                    // Re-bind the mock confirm button to trigger step 3
                    document.getElementById('btn-confirm-booking').addEventListener('click', () => {
                        document.getElementById('booking-step-calendar').style.display = 'none';
                        document.getElementById('booking-step-details').style.display = 'block';
                    });
                }
            }, 500);
        """
    ))

    page.evaluate("localStorage.setItem('tiny_demo_mode', 'true')")
    page.reload()
    page.wait_for_selector("#custom-reason-trigger")
    page.wait_for_timeout(1000)
    
    print("    Selecting meeting reason...")
    sync_action(page, scene_id, "select_reason")
    click_smoothly(page, "#custom-reason-trigger")
    page.wait_for_timeout(500)
    click_smoothly(page, ".custom-option[data-value='Pre-Screen Discovery Call | 30 mins']")
    
    sync_action(page, scene_id, "click_calendar")
    click_smoothly(page, "#btn-next-step")
    page.wait_for_selector(".calendar-day")
    # Fix: scroll back to the top seamlessly so the calendar isn't pushed down
    scroll_smoothly(page, "window", -600, steps=10)
    page.wait_for_timeout(500)
    
    print("    Selecting calendar date...")
    click_smoothly(page, ".calendar-day[data-day='27']")
    page.wait_for_timeout(500)
    click_smoothly(page, ".time-slot-btn")
    click_smoothly(page, "#btn-confirm-booking")
    
    page.wait_for_selector("#booking-name")
    print("    Filling details form...")
    sync_action(page, scene_id, "fill_form")
    type_smoothly(page, "#booking-name", "Kevin Smith")
    type_smoothly(page, "#booking-email", "kevin.s@meridianlogistics.com.au", paste=True)
    type_smoothly(page, "#booking-company", "Meridian Logistics")
    type_smoothly(page, "#booking-position", "Supply Chain Manager", paste=True)
    click_smoothly(page, "#booking-track")
    page.wait_for_timeout(300)
    page.select_option("#booking-track", label="Planning & Analytics (TM1)")
    page.wait_for_timeout(300)
    type_smoothly(page, "#booking-url", "https://meridianlogistics.com.au", paste=True)
    type_smoothly(page, "#booking-phone", "+61 2 9876 5432", paste=True)
    type_smoothly(page, "#booking-discuss", DISCUSS_TEXT, paste=True)
    
    print("    Submitting booking...")
    sync_action(page, scene_id, "submit_booking")
    click_smoothly(page, "#btn-submit-booking")
    page.wait_for_selector("#success-time-display")
    end_scene_sync(page, scene_id)

def scene_module_3a_routing(page, scene_id):
    page.goto(BOOK_URL)
    page.wait_for_selector("#booking-step-success", state="attached")
    # Show the success confirmation first (as if Kevin just submitted)
    page.evaluate("""() => {
        document.getElementById('booking-step-reason').style.display = 'none';
        document.getElementById('booking-step-success').style.display = 'block';
        document.getElementById('success-name-display').textContent = 'Kevin';
        document.getElementById('success-time-display').textContent = 'Your meeting with Albert is scheduled for May 26 at 10:30 AM.';
    }""")
    page.wait_for_timeout(3000)

    # -- PHASE 1: Show Email Notification --
    print("    Injecting email notification overlay...")
    sync_action(page, scene_id, "view_email")
    page.evaluate("""() => {
        const overlay = document.createElement('div');
        overlay.id = 'email-notification-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.5s ease-out;';
        
        const card = document.createElement('div');
        card.style.cssText = 'width:580px;max-height:80vh;background:#fff;border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,0.3);overflow:hidden;font-family:Roboto,Arial,sans-serif;';
        
        card.innerHTML = `
            <div style="background:#000000;padding:16px 24px;display:flex;align-items:center;gap:12px;">
                <div style="width:36px;height:36px;border-radius:50%;background:#4daeeb;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:0.85rem;">O</div>
                <div>
                    <div style="color:#fff;font-weight:600;font-size:0.9rem;">Octane Booking System</div>
                    <div style="color:rgba(255,255,255,0.5);font-size:0.75rem;">noreply@octanesolutions.com.au</div>
                </div>
                <div style="margin-left:auto;background:rgba(77,174,235,0.15);color:#4daeeb;font-size:0.7rem;font-weight:600;padding:3px 10px;border-radius:12px;text-transform:uppercase;letter-spacing:0.5px;">New Booking</div>
            </div>
            <div style="padding:24px;">
                <div style="font-size:0.75rem;color:#888;margin-bottom:4px;">To: albert@octanesolutions.com.au, isha@octanesolutions.com.au</div>
                <h2 style="margin:0 0 16px;font-size:1.1rem;color:#1a1a2e;font-weight:700;">🎯 New Pre-Screen Booking: Kevin Smith — Meridian Logistics</h2>
                <div style="background:#f8f9ff;border:1px solid rgba(26,115,232,0.12);border-radius:8px;padding:16px;margin-bottom:16px;">
                    <table style="width:100%;font-size:0.85rem;color:#333;border-collapse:collapse;">
                        <tr><td style="padding:6px 0;font-weight:600;color:#555;width:140px;">Prospect</td><td style="padding:6px 0;">Kevin Smith</td></tr>
                        <tr><td style="padding:6px 0;font-weight:600;color:#555;">Company</td><td style="padding:6px 0;">Meridian Logistics</td></tr>
                        <tr><td style="padding:6px 0;font-weight:600;color:#555;">Position</td><td style="padding:6px 0;">Supply Chain Manager</td></tr>
                        <tr><td style="padding:6px 0;font-weight:600;color:#555;">Service Interest</td><td style="padding:6px 0;"><span style="background:rgba(26,115,232,0.1);color:#1a73e8;padding:2px 8px;border-radius:4px;font-weight:500;">Planning & Analytics (TM1)</span></td></tr>
                        <tr><td style="padding:6px 0;font-weight:600;color:#555;">Email</td><td style="padding:6px 0;">kevin.s@meridianlogistics.com.au</td></tr>
                        <tr><td style="padding:6px 0;font-weight:600;color:#555;">Phone</td><td style="padding:6px 0;">+61 2 9876 5432</td></tr>
                    </table>
                </div>
                <div style="background:rgba(0,200,83,0.06);border:1px solid rgba(0,200,83,0.2);border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:10px;margin-bottom:16px;">
                    <span style="font-size:1.2rem;">📅</span>
                    <div>
                        <div style="font-weight:600;color:#1a1a2e;font-size:0.9rem;">Monday, May 26, 2026 at 10:30 AM AEST</div>
                        <div style="font-size:0.8rem;color:#666;">Pre-Screen Discovery Call · 30 minutes · Assigned to <strong>Albert</strong></div>
                    </div>
                </div>
                <div style="border-top:1px solid #eee;padding-top:12px;">
                    <div style="font-weight:600;color:#555;font-size:0.8rem;margin-bottom:6px;">Discussion Topics:</div>
                    <p style="font-size:0.85rem;color:#333;line-height:1.5;margin:0;background:#fafafa;padding:10px;border-radius:6px;border-left:3px solid #4daeeb;">We need help consolidating 35 Excel-based planning models into a single TM1 instance. Our monthly close takes 3 weeks and we need to bring it down to 5 business days.</p>
                </div>
            </div>
        `;
        
        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }""")
    page.wait_for_timeout(2000)

    print("    Scrolling email details...")
    sync_action(page, scene_id, "scroll_email")
    page.mouse.move(600, 400, steps=10)
    page.wait_for_timeout(3000)

    # Dismiss email overlay
    print("    Dismissing email notification...")
    page.evaluate("""() => {
        const overlay = document.getElementById('email-notification-overlay');
        if (overlay) {
            overlay.style.transition = 'opacity 0.4s ease-out';
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 400);
        }
    }""")
    page.wait_for_timeout(800)

    # -- PHASE 2: Navigate to Dashboard and show GDrive --
    print("    Navigating to SDR Dashboard...")
    page.goto(DASH_URL)
    page.reload()
    page.wait_for_selector("#prep-name")
    page.wait_for_timeout(1000)

    # Auto-populate prospect fields as if system pre-filled them
    page.evaluate("""() => {
        document.getElementById('prep-name').value = 'Kevin Smith';
        document.getElementById('prep-title').value = 'Supply Chain Manager';
        document.getElementById('prep-company').value = 'Meridian Logistics';
        document.getElementById('prep-email').value = 'kevin.s@meridianlogistics.com.au';
        document.getElementById('prep-phone').value = '+61 2 9876 5432';
        // Trigger input events for visual reactivity
        ['prep-name','prep-title','prep-company','prep-email','prep-phone'].forEach(id => {
            document.getElementById(id).dispatchEvent(new Event('input', {bubbles:true}));
        });
    }""")
    page.wait_for_timeout(1000)

    print("    Scrolling to Google Drive section...")
    scroll_smoothly(page, "window", 300, steps=8)
    sync_action(page, scene_id, "view_gdrive_folder")
    page.wait_for_timeout(500)

    # Open GDrive browser and inject realistic client folder contents
    print("    Injecting GDrive client folder structure...")
    page.evaluate("""() => {
        const browser = document.getElementById('gdrive-browser');
        const itemsList = document.getElementById('gdrive-items-list');
        const folderLabel = document.getElementById('gdrive-current-folder');
        
        if (browser) browser.style.display = 'block';
        if (folderLabel) folderLabel.textContent = 'Kevin Smith - Meridian Logistics';
        
        if (itemsList) {
            itemsList.innerHTML = '';
            
            const files = [
                { icon: '📄', name: 'Intake_Form_Kevin_Smith.pdf', size: '48 KB', date: 'May 26, 2026' },
                { icon: '📄', name: 'Meridian_Logistics_SOW_2025.pdf', size: '1.2 MB', date: 'May 26, 2026' },
                { icon: '📅', name: 'Booking_Confirmation_May26.ics', size: '4 KB', date: 'May 26, 2026' },
                { icon: '📋', name: 'Discussion_Topics.txt', size: '1 KB', date: 'May 26, 2026' }
            ];
            
            files.forEach((file, i) => {
                const item = document.createElement('div');
                item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;font-size:0.8rem;cursor:pointer;transition:background 0.2s;border:1px solid rgba(0,0,0,0.04);background:rgba(26,115,232,0.02);';
                item.innerHTML = `
                    <span style="font-size:1rem;">${file.icon}</span>
                    <span style="flex:1;font-weight:500;color:#1a73e8;">${file.name}</span>
                    <span style="font-size:0.7rem;color:#888;min-width:50px;text-align:right;">${file.size}</span>
                    <span style="font-size:0.7rem;color:#aaa;">${file.date}</span>
                `;
                item.onmouseover = () => item.style.background = 'rgba(26,115,232,0.08)';
                item.onmouseout = () => item.style.background = 'rgba(26,115,232,0.02)';
                itemsList.appendChild(item);
            });
        }
    }""")
    page.wait_for_timeout(1000)

    print("    Highlighting individual files...")
    sync_action(page, scene_id, "view_gdrive_files")
    
    # Cinematic zoom on the Google Drive browser
    page.evaluate("""() => {
        const browser = document.getElementById('gdrive-browser');
        if (browser) {
            browser.style.transformOrigin = 'top left';
            browser.style.transition = 'transform 3.5s ease-in-out';
            browser.style.transform = 'scale(1.05)';
        }
    }""")
    page.wait_for_timeout(500)
    
    # Hover over each file for visual emphasis
    page.mouse.move(500, 450, steps=10)
    page.wait_for_timeout(1500)
    page.mouse.move(500, 475, steps=8)
    page.wait_for_timeout(1500)
    page.mouse.move(500, 500, steps=8)
    page.wait_for_timeout(1500)

    end_scene_sync(page, scene_id)

def scene_module_3b_preparation(page, scene_id):
    page.goto(DASH_URL)
    page.reload()
    page.wait_for_selector("#prep-name")
    page.wait_for_timeout(1000)
    
    print("    Typing intake details manually...")
    type_smoothly(page, "#prep-name", "Kevin Smith")
    type_smoothly(page, "#prep-title", "Supply Chain Manager")
    type_smoothly(page, "#prep-company", "Meridian Logistics")
    type_smoothly(page, "#prep-email", "kevin.s@meridianlogistics.com.au")
    
    scroll_smoothly(page, "window", 350, steps=8)
    print("    Pasting LinkedIn profile...")
    sync_action(page, scene_id, "paste_linkedin")
    type_smoothly(page, "#prep-linkedin", LINKEDIN_TEXT, paste=True)
    
    print("    Simulating SOW file attachment...")
    sync_action(page, scene_id, "attach_sow")
    page.evaluate("""() => {
        const b = document.querySelector('#gdrive-attached-badge');
        const n = document.querySelector('#gdrive-attached-name');
        if (b && n) { b.style.display = 'flex'; n.textContent = 'Meridian_Logistics_SOW_2025.pdf'; }
        window.attachedGDriveFileContent = 'HISTORICAL SOW: Meridian Logistics TM1 Implementation 2025';
    }""")
    
    scroll_smoothly(page, "window", -400, steps=8)
    print("    Clicking Generate Prep Briefing...")
    sync_action(page, scene_id, "click_generate_briefing")
    click_smoothly(page, "#prep-submit-btn")
    
    # Inject mock dossier instead of waiting for live API
    page.wait_for_timeout(2000)
    print("    Injecting mock prep dossier...")
    inject_mock_output(page, MOCK_PREP_HTML)
    page.wait_for_timeout(1000)
    
    print("    Reviewing dossier...")
    sync_action(page, scene_id, "view_dossier")
    smooth_move(page, "#output-results")
    scroll_smoothly(page, "#output-doc-content", 600, steps=10)
    page.wait_for_timeout(1000)

    print("    Highlighting gap...")
    sync_action(page, scene_id, "show_gap")
    page.evaluate("""() => {
        const doc = document.querySelector('#output-doc-content');
        if (doc && !doc.innerHTML.includes('NEEDS RESEARCH')) {
            const h4 = Array.from(doc.querySelectorAll('h4')).find(el => el.textContent.includes('Competitor Mapping'));
            if (h4 && h4.nextElementSibling) {
                h4.nextElementSibling.innerHTML += ' <span id="needs-research-flag" style="background:#ef4444;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:0.75rem;">[NEEDS RESEARCH]</span>';
            }
        }
    }""")
    page.wait_for_timeout(500)
    smooth_move(page, "#needs-research-flag")
    page.wait_for_timeout(2000)
    
    print("    Opening chatbot...")
    sync_action(page, scene_id, "open_chatbot")
    # Make sure button exists or inject mock
    page.evaluate("""() => {
        if (!document.querySelector('.chatButton')) {
            const btn = document.createElement('button');
            btn.className = 'chatButton';
            btn.style.cssText = 'position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;background:#0f62fe;z-index:9999;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
            btn.innerHTML = '<span style="color:white;font-size:24px;">💬</span>';
            document.body.appendChild(btn);
            
            btn.addEventListener('click', () => {
                let win = document.querySelector('.mock-chat-window');
                if (!win) {
                    win = document.createElement('div');
                    win.className = 'mock-chat-window';
                    win.style.cssText = 'position:fixed;bottom:90px;right:20px;width:350px;height:500px;background:#fff;z-index:9999;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.2);display:flex;flex-direction:column;overflow:hidden;border:1px solid #e0e0e0;font-family:sans-serif;';
                    win.innerHTML = '<div style="background:#0f62fe;color:#fff;padding:16px;font-weight:600;display:flex;align-items:center;gap:8px;"><span>🤖</span> watsonx Orchestrate</div><div style="flex:1;padding:16px;background:#f4f4f4;overflow-y:auto;display:flex;flex-direction:column;gap:12px;" id="mock-chat-history"></div><div style="padding:12px;background:#fff;border-top:1px solid #e0e0e0;"><input type="text" id="mock-chat-input" placeholder="Type something..." style="width:100%;padding:10px 16px;border:1px solid #ccc;border-radius:20px;outline:none;font-size:0.9rem;"></div>';
                    document.body.appendChild(win);
                } else {
                    win.style.display = win.style.display === 'none' ? 'flex' : 'none';
                }
            });
        }
    }""")
    click_smoothly(page, ".chatButton")
    page.wait_for_timeout(1000)

    print("    Querying chatbot...")
    sync_action(page, scene_id, "chatbot_query")
    page.evaluate("""() => {
        const win = document.querySelector('.mock-chat-window');
        if (win) win.style.display = 'flex';
    }""")
    page.wait_for_timeout(500)
    
    try:
        if page.locator("#mock-chat-input").is_visible():
            type_smoothly(page, "#mock-chat-input", "What does Meridian Logistics sell and who are their main competitors?", delay=30)
            page.keyboard.press("Enter")
        else:
            page.evaluate("""() => {
                let win = document.querySelector('.mock-chat-window');
                if (!win) {
                    win = document.createElement('div');
                    win.className = 'mock-chat-window';
                    win.style.cssText = 'position:fixed;bottom:90px;right:20px;width:350px;height:500px;background:#fff;z-index:9999;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.2);display:flex;flex-direction:column;overflow:hidden;border:1px solid #e0e0e0;font-family:sans-serif;';
                    win.innerHTML = '<div style="background:#0f62fe;color:#fff;padding:16px;font-weight:600;display:flex;align-items:center;gap:8px;"><span>🤖</span> watsonx Orchestrate</div><div style="flex:1;padding:16px;background:#f4f4f4;overflow-y:auto;display:flex;flex-direction:column;gap:12px;" id="mock-chat-history"></div><div style="padding:12px;background:#fff;border-top:1px solid #e0e0e0;"><input type="text" id="mock-chat-input" placeholder="Type something..." style="width:100%;padding:10px 16px;border:1px solid #ccc;border-radius:20px;outline:none;font-size:0.9rem;"></div>';
                    document.body.appendChild(win);
                }
                win.style.display = 'flex';
            }""")
            page.wait_for_timeout(500)
            type_smoothly(page, "#mock-chat-input", "What does Meridian Logistics sell and who are their main competitors?", delay=30)
            page.keyboard.press("Enter")
    except Exception as e:
        print(f"    [WARN] Failed to type in chatbot: {e}")

    page.wait_for_timeout(1000)
    page.evaluate("""() => {
        const hist = document.querySelector('#mock-chat-history');
        if (hist) {
            hist.innerHTML += '<div style="align-self:flex-end;max-width:85%;"><span style="background:#0f62fe;color:#fff;padding:10px 14px;border-radius:16px 16px 0 16px;display:inline-block;font-size:0.85rem;line-height:1.4;">What does Meridian Logistics sell and who are their main competitors?</span></div>';
            setTimeout(() => {
                hist.innerHTML += '<div style="align-self:flex-start;max-width:85%;"><span id="chat-response-text" style="background:#fff;color:#333;padding:10px 14px;border-radius:16px 16px 16px 0;border:1px solid #e0e0e0;display:inline-block;font-size:0.85rem;line-height:1.4;box-shadow:0 2px 6px rgba(0,0,0,0.04);">Meridian Logistics provides supply chain solutions, freight forwarding, and contract logistics. Main competitors include Linfox, Toll Group, and DB Schenker.</span></div>';
                hist.scrollTop = hist.scrollHeight;
            }, 800);
        }
    }""")
    page.wait_for_timeout(2500)

    print("    Copying and pasting response...")
    sync_action(page, scene_id, "copy_paste_response")
    smooth_move(page, "#chat-response-text")
    page.wait_for_timeout(500)
    
    scroll_smoothly(page, "window", -500, steps=10)
    page.wait_for_timeout(500)
    type_smoothly(page, "#prep-linkedin", "\\n\\nChatbot Research:\\nMeridian Logistics provides supply chain solutions, freight forwarding, and contract logistics. Main competitors include Linfox, Toll Group, and DB Schenker.", paste=True)

    scroll_smoothly(page, "#output-doc-content", 400, steps=8)
    page.wait_for_timeout(500)
    end_scene_sync(page, scene_id)

def scene_module_4_execution(page, scene_id):
    page.goto(DASH_URL)
    page.reload()
    page.wait_for_selector(".step-content")
    page.wait_for_timeout(1000)
    
    print("    Navigating to Step 2 (Session)...")
    sync_action(page, scene_id, "click_session_tab")
    page.wait_for_function("typeof window.goToStep === 'function'")
    page.evaluate("window.goToStep(2)")
    page.wait_for_timeout(1000)
    
    # Inject "Live Session Active" banner for enterprise visual
    print("    Injecting Live Session banner...")
    sync_action(page, scene_id, "show_recording_active")
    page.evaluate("""() => {
        const banner = document.createElement('div');
        banner.id = 'live-session-banner';
        banner.style.cssText = 'background: linear-gradient(90deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04)); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 0.65rem 1.25rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.75rem; animation: fadeIn 0.5s ease-out;';
        banner.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px rgba(239,68,68,0.6);animation:pulse 1.5s infinite"></span><span style="font-size:0.8rem;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:0.8px;">Live Session Active</span><span style="font-size:0.75rem;color:rgba(0,0,0,0.5);margin-left:auto;">Fathom Recording &middot; Teams Meeting</span>';
        const stepContent = document.querySelector('.step-content.active');
        if (stepContent) stepContent.prepend(banner);
    }""")
    page.wait_for_timeout(1000)

    print("    Simulating Contingency...")
    sync_action(page, scene_id, "show_contingency")
    page.evaluate("""() => {
        const banner = document.getElementById('live-session-banner');
        if (banner) {
            banner.style.background = 'linear-gradient(90deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))';
            banner.style.borderColor = 'rgba(245,158,11,0.3)';
            banner.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;box-shadow:0 0 8px rgba(245,158,11,0.6);"></span><span style="font-size:0.8rem;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:0.8px;">⚠️ Recording Bot Failed to Join</span><span style="font-size:0.75rem;color:rgba(0,0,0,0.5);margin-left:auto;">Waiting Room Blocked</span>';
        }
    }""")
    page.wait_for_timeout(3000)

    print("    Uploading Recording...")
    sync_action(page, scene_id, "show_upload")
    smooth_move(page, "#upload-recording-panel")
    scroll_smoothly(page, "window", 400, steps=8)
    click_smoothly(page, "#upload-browse-btn")
    page.evaluate("""() => {
        const prog = document.getElementById('upload-progress');
        const bar = document.getElementById('upload-progress-bar');
        const stat = document.getElementById('upload-status');
        if (prog && bar && stat) {
            prog.classList.remove('hidden');
            let w = 0;
            const int = setInterval(() => {
                w += 10;
                bar.style.width = w + '%';
                if (w >= 100) {
                    clearInterval(int);
                    stat.textContent = 'Upload Complete';
                    stat.style.color = '#10b981';
                }
            }, 150);
        }
    }""")
    page.wait_for_timeout(2000)

    # Scroll back up to the battlecard selector
    scroll_smoothly(page, "window", -500, steps=10)
    page.wait_for_timeout(500)

    print("    Selecting Variant B from battlecard selector...")
    sync_action(page, scene_id, "view_battlecard")
    page.select_option("#battlecard-selector", value="B")
    page.wait_for_timeout(1000)

    print("    Injecting realistic talking points and showing Rapport Guide...")
    page.evaluate("""() => {
        const panel = document.getElementById('rapport-guide-panel');
        const body = document.getElementById('rapport-guide-body');
        if (panel) panel.style.display = 'block';
        if (body) {
            body.innerHTML = `
                <div class="rapport-card card-openers">
                    <h4 class="rapport-card-title">💬 Conversation Openers</h4>
                    <ul style="margin: 0; padding-left: 1.2rem; line-height: 1.5; color: #333;">
                        <li style="margin-bottom: 4px;"><strong>Linfox Alignment:</strong> Acknowledge his fleet analytics background at Linfox Logistics.</li>
                        <li style="margin-bottom: 4px;"><strong>Consolidation Pain:</strong> Empathize with the manual workload of managing 35 planning spreadsheets.</li>
                    </ul>
                </div>
            `;
        }
        
        const dossierBody = document.getElementById('dossier-quick-ref-body');
        if (dossierBody) {
            dossierBody.innerHTML = `
                <div class="rapport-card card-context" style="border: none;">
                    <h4 class="rapport-card-title">📋 Key Context & Facts</h4>
                    <ul style="margin: 0; padding-left: 1.2rem; line-height: 1.5; color: #333;">
                        <li style="margin-bottom: 4px;"><strong>Target Deadline:</strong> Pre-qualify the Q3 decision deadline.</li>
                        <li style="margin-bottom: 0;"><strong>Current Stack:</strong> Oracle ERP, NetSuite, Excel 2016.</li>
                    </ul>
                </div>
            `;
        }
    }""")
    page.wait_for_timeout(500)

    print("    Expanding Rapport Guide...")
    click_smoothly(page, "#rapport-guide-header")
    page.wait_for_timeout(1000)
    
    print("    Panning to Dossier Quick Reference...")
    # Move mouse to the right column to draw attention to it
    page.mouse.move(900, 400, steps=15)
    page.wait_for_timeout(1000)
    
    print("    Navigating to Documentation for Question Playbook...")
    sync_action(page, scene_id, "view_docs")
    with page.context.expect_page() as new_page_info:
        click_smoothly(page, "header a[href*='docs']")
    doc_page = new_page_info.value
    doc_page.wait_for_selector("#comp-03")
    doc_page.locator("#comp-03").scroll_into_view_if_needed()
    scroll_smoothly(doc_page, "window", 200, steps=6)
    doc_page.wait_for_timeout(2000)
    doc_page.close()

    print("    Clicking through teleprompter cards sequentially...")
    # Click 3 cards sequentially with natural pacing pauses to simulate the live call
    click_smoothly(page, ".teleprompter-card[data-index='0']")
    page.wait_for_timeout(1500)
    click_smoothly(page, ".teleprompter-card[data-index='1']")
    page.wait_for_timeout(1500)
    click_smoothly(page, ".teleprompter-card[data-index='2']")
    page.wait_for_timeout(1500)
    
    print("    Booking positional meeting...")
    scroll_smoothly(page, "window", 400, steps=8)
    
    sync_action(page, scene_id, "confirm_booking")
    with page.context.expect_page() as new_page_info:
        click_smoothly(page, "#positional-confirm-btn")
    hubspot_page = new_page_info.value
    hubspot_page.wait_for_timeout(1500)
    hubspot_page.close()
    page.wait_for_timeout(1000)
    
    print("    Completing call...")
    sync_action(page, scene_id, "click_completed")
    scroll_smoothly(page, "window", -500, steps=8)
    click_smoothly(page, ".outcome-btn[data-outcome='completed']")

    print("    Switching to Synthesis tab for classification...")
    page.wait_for_function("typeof window.goToStep === 'function'")
    page.evaluate("window.goToStep(3)")
    page.wait_for_timeout(1000)
    
    print("    Showing Lead Classification...")
    sync_action(page, scene_id, "show_classification")
    page.evaluate("""() => {
        const emptyState = document.querySelector('#output-empty-state');
        if (emptyState) {
            emptyState.style.display = 'none';
            emptyState.classList.add('hidden');
        }
        const outputResults = document.querySelector('#output-results');
        if (outputResults) {
            outputResults.classList.remove('hidden');
            outputResults.style.display = 'flex';
        }
        const panel = document.querySelector('.lead-classification-panel');
        if (panel) panel.classList.remove('hidden');
        
        const conf = document.getElementById('lead-confidence');
        if (conf) conf.textContent = 'Confidence: 8/10';
        
        const badge = document.getElementById('temperature-badge');
        if (badge) {
            badge.className = 'temperature-badge temperature-badge--hot';
            badge.textContent = '🔥 HOT';
            badge.style.background = '#ef4444';
            badge.style.color = '#fff';
            badge.style.padding = '2px 8px';
            badge.style.borderRadius = '4px';
            badge.style.fontWeight = 'bold';
        }
        
        const stage = document.getElementById('funnel-stage');
        if (stage) stage.textContent = 'Stage: SQL';
        
        const evidence = document.getElementById('evidence-list');
        if (evidence) {
            evidence.innerHTML = '<li>Decision deadline Q3 verified</li><li>Budget acknowledged (~A$120k)</li><li>Current pain is severe (3-week close)</li>';
        }
        
        const nextAction = document.getElementById('next-action-text');
        if (nextAction) nextAction.textContent = 'Immediate Technical Deep-Dive & ROI Pitch';
    }""")
    page.wait_for_timeout(1000)
    smooth_move(page, ".lead-classification-panel")

    print("    Highlighting next action...")
    sync_action(page, scene_id, "show_next_action")
    smooth_move(page, "#lead-next-action")
    page.wait_for_timeout(1000)
    
    end_scene_sync(page, scene_id)

def scene_module_5_synthesis(page, scene_id):
    page.goto(DASH_URL)
    page.reload()
    page.wait_for_selector(".step-content")
    page.wait_for_timeout(1000)
    
    print("    Navigating to Step 3 (Reports) instantly...")
    # Open step 3 immediately so that the SDR can paste the transcript
    page.wait_for_function("typeof window.goToStep === 'function'")
    page.evaluate("window.goToStep(3)")
    page.wait_for_timeout(1000)
    
    print("    Pasting call transcript...")
    sync_action(page, scene_id, "paste_transcript")
    type_smoothly(page, "#synth-transcript", TRANSCRIPT_TEXT, paste=True)
    scroll_smoothly(page, "window", 200, steps=6)
    
    print("    Generating reports...")
    sync_action(page, scene_id, "click_synthesize")
    click_smoothly(page, "#synth-submit-btn")
    
    # Inject mock reports collection when reports are generated in the narration
    sync_action(page, scene_id, "click_reports_tab")
    print("    Injecting mock synthesis reports...")
    inject_mock_output(page, MOCK_SYNTH_HTML, is_collection=True)
    page.wait_for_timeout(500)
    # Set to Recap Email as spoken first
    page.evaluate("window.setDocTab('recapEmail')")
    page.wait_for_timeout(1000)
    
    print("    Navigating to Documentation for Services Catalog...")
    sync_action(page, scene_id, "view_docs")
    with page.context.expect_page() as new_page_info:
        click_smoothly(page, "header a[href*='docs']")
    doc_page = new_page_info.value
    doc_page.wait_for_selector("#comp-05")
    doc_page.locator("#comp-05").scroll_into_view_if_needed()
    doc_page.wait_for_timeout(2000)
    doc_page.close()
    
    print("    Reviewing Proposal...")
    sync_action(page, scene_id, "view_proposal")
    page.evaluate("window.setDocTab('proposal')")
    page.wait_for_timeout(500)
    scroll_smoothly(page, "#output-doc-content", 400, steps=8)
    page.wait_for_timeout(1000)
    
    print("    Copying proposal to CRM...")
    sync_action(page, scene_id, "click_copy")
    scroll_smoothly(page, "window", -200, steps=6)
    click_smoothly(page, "#copy-content-btn")
    end_scene_sync(page, scene_id)

def scene_module_1_settings(page, scene_id):
    page.goto(ADMIN_URL)
    page.wait_for_selector("#cfg-project-name")
    page.wait_for_timeout(1500)
    
    # Step 1: Name the project
    print("    Typing project name...")
    sync_action(page, scene_id, "create_project")
    type_smoothly(page, "#cfg-project-name", "Tiny -- Pre-Screen Prep Engine")
    page.wait_for_timeout(2000)
    
    # Step 2: Upload knowledge base files
    print("    Uploading knowledge base files...")
    sync_action(page, scene_id, "upload_files")
    click_smoothly(page, '.sidebar-item[data-section="knowledge-base"]')
    page.wait_for_timeout(1500)
    scroll_smoothly(page, "window", 350, steps=8)
    click_smoothly(page, "#kb-upload-zone")
    # Wait for all 5 files to upload and be indexed
    page.wait_for_timeout(5000)
    scroll_smoothly(page, "window", 300, steps=8)
    page.wait_for_timeout(2000)
    
    # Step 3: Paste the Mega-Prompt system instructions
    print("    Pasting Mega-Prompt system instructions...")
    sync_action(page, scene_id, "paste_prompt")
    click_smoothly(page, '.sidebar-item[data-section="persona-prompts"]')
    page.wait_for_timeout(1500)
    scroll_smoothly(page, "window", 400, steps=8)
    type_smoothly(page, "#cfg-prep-prompt", "You are a professional, clinical B2B sales research assistant. You write detailed, factual briefs without fluff.", paste=True)
    page.wait_for_timeout(1500)
    # Slowly scroll through the prompt to show it
    scroll_smoothly(page, "window", 300, steps=10)
    page.wait_for_timeout(2000)
    
    # Step 4: Save the project
    print("    Saving project configuration...")
    sync_action(page, scene_id, "save_project")
    scroll_smoothly(page, "window", -800, steps=12)
    page.wait_for_timeout(500)
    click_smoothly(page, "#btn-save-all")
    page.wait_for_timeout(2000)
    end_scene_sync(page, scene_id)

def scene_module_7_technical(page, scene_id):
    page.goto(f"{BASE_URL}/projects")
    page.wait_for_timeout(1000)
    
    print("    Viewing Kanban board...")
    sync_action(page, scene_id, "view_board")
    page.wait_for_timeout(2000)
    
    print("    Dragging ticket...")
    sync_action(page, scene_id, "drag_ticket")
    click_smoothly(page, "#ticket-1") 
    page.wait_for_timeout(1500)
    end_scene_sync(page, scene_id)

def scene_module_8_audit(page, scene_id):
    page.goto(f"{BASE_URL}/audit")
    page.wait_for_timeout(1000)
    
    print("    Viewing audit logs...")
    sync_action(page, scene_id, "view_logs")
    scroll_smoothly(page, "window", 300, steps=8)
    page.wait_for_timeout(2000)
    
    print("    Expanding anomaly...")
    sync_action(page, scene_id, "expand_log")
    click_smoothly(page, "table tbody tr:nth-child(2)") 
    page.wait_for_timeout(1500)
    end_scene_sync(page, scene_id)

def scene_module_9_admin(page, scene_id):
    page.goto(f"{BASE_URL}/admin")
    page.wait_for_timeout(1000)
    
    print("    Viewing advanced admin...")
    sync_action(page, scene_id, "view_admin")
    click_smoothly(page, '.sidebar-item[data-section="persona-prompts"]')
    page.wait_for_timeout(1500)
    scroll_smoothly(page, "window", 200, steps=8)
    page.wait_for_timeout(2000)
    
    print("    Editing system prompt...")
    sync_action(page, scene_id, "edit_prompt")
    type_smoothly(page, "#cfg-prep-prompt", "\\n\\n- Strictly enforce corporate guidelines.", paste=True)
    page.wait_for_timeout(1500)
    click_smoothly(page, "#btn-save-all")
    page.wait_for_timeout(2000)
    end_scene_sync(page, scene_id)

def scene_module_10_analytics(page, scene_id):
    page.goto(f"{BASE_URL}/analytics")
    page.wait_for_timeout(1000)
    
    print("    Viewing analytics dashboard...")
    sync_action(page, scene_id, "view_dashboard")
    scroll_smoothly(page, "window", 200, steps=8)
    page.wait_for_timeout(2000)
    
    print("    Hovering over chart...")
    sync_action(page, scene_id, "hover_chart")
    smooth_move(page, "body", steps=10) # generic move to show interaction
    page.wait_for_timeout(1500)
    end_scene_sync(page, scene_id)


SCENES = {
    "1": ("module_1_settings", scene_module_1_settings),
    "2": ("module_2_booking", scene_module_2_booking),
    "3a": ("module_3a_routing", scene_module_3a_routing),
    "3b": ("module_3b_preparation", scene_module_3b_preparation),
    "4": ("module_4_execution", scene_module_4_execution),
    "5": ("module_5_synthesis", scene_module_5_synthesis),
}

def convert_webm_to_mp4(webm_path, target_mp4_path):
    print("\n  [REMUX] Finalizing recording...")
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg_exe, "-y",
        "-i", str(webm_path),
        "-vsync", "cfr", "-r", "30",
        "-c:v", "libx264",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        str(target_mp4_path)
    ]
    print(f"  [REMUX] Converting {webm_path.name} -> {target_mp4_path.name}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode == 0:
        size_mb = os.path.getsize(str(target_mp4_path)) / (1024 * 1024)
        print(f"  [OK] Saved finalized video: {target_mp4_path} ({size_mb:.1f} MB)")
        try: os.unlink(webm_path)
        except: pass
        return True
    else:
        print(f"  [ERROR] FFmpeg conversion failed: {result.stderr}")
        return False

def main():
    print("=" * 60)
    print("  Tiny AI Assistant -- Modular Video Course Recorder")
    print("=" * 60)

    parser = argparse.ArgumentParser(description="Modular Playwright Recorder")
    parser.add_argument("--module", type=str, help="Module number to record (1-6) or 'all'")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode")
    args = parser.parse_args()
    
    modules_to_run = list(SCENES.keys()) if not args.module or args.module == "all" else [args.module]

    server_proc = None
    if not is_port_open(8080):
        print("\n  [SERVER] Local server on port 8080 is down. Starting server.js...")
        server_proc = subprocess.Popen(
            ["node", "server.js"],
            cwd=str(Path(SCRIPT_DIR).parent.parent),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        for _ in range(10):
            if is_port_open(8080): break
            time.sleep(0.5)
        else:
            print("  [ERROR] Failed to start server.js. Exiting.")
            sys.exit(1)
            
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=args.headless, 
            args=[] if args.headless else ["--start-maximized", "--disable-infobars"]
        )
        timeline = []
        
        for mod in modules_to_run:
            if mod not in SCENES:
                continue
            scene_id, scene_fn = SCENES[mod]
            print(f"\n  ▶ Recording Module {mod}: {scene_id}")
            
            context = browser.new_context(
                viewport={"width": 1280, "height": 800},
                record_video_dir=str(OUTPUT_DIR),
                record_video_size={"width": 1280, "height": 800}
            )
            with open(MOUSE_HELPER_PATH, "r", encoding="utf-8") as f:
                context.add_init_script(f.read())
            page = context.new_page()
            page.set_default_timeout(0)
            page.set_default_navigation_timeout(0)
            
            global SCENE_START_TIME
            SCENE_START_TIME = time.time()
            scene_fn(page, scene_id)
            
            end_ms = time.time() - SCENE_START_TIME
            timeline.append({
                "scene": scene_id,
                "duration_s": round(end_ms, 3)
            })
            
            video_path = page.video.path() if page.video else None
            context.close()
            
            if video_path and os.path.exists(video_path):
                final_path = OUTPUT_DIR / f"{scene_id}.mp4"
                convert_webm_to_mp4(Path(video_path), final_path)
            
        with open(TIMELINE_FILE, "w") as f:
            json.dump(timeline, f, indent=2)
            
        browser.close()
        if server_proc:
            server_proc.terminate()
            server_proc.wait()

if __name__ == "__main__":
    main()
