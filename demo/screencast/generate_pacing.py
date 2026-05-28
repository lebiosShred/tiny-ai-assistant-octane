import json
import os
import re
import sys
import time
from pathlib import Path
from dotenv import load_dotenv

# Load API keys from the root .env file
load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".env")

def get_api_keys():
    keys = [k.strip() for k in os.environ.get("GOOGLE_API_KEYS", "").split(",") if k.strip()]
    if not keys:
        single = os.environ.get("GOOGLE_API_KEY", "").strip()
        keys = [single] if single else []
    return keys

def _gemini_call_with_retry(api_keys, model_id, contents, tag="PACING", temperature=0.1, max_loops=4):
    from google import genai
    from google.genai import types
    
    for loop in range(max_loops):
        for idx, key in enumerate(api_keys):
            try:
                client = genai.Client(api_key=key, http_options={'timeout': 600000})
                response = client.models.generate_content(
                    model=model_id,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        temperature=temperature,
                        response_mime_type="application/json",
                    ),
                )
                return response.text.strip(), idx
            except Exception as e:
                err_str = str(e)
                if any(x in err_str for x in ["429", "RESOURCE_EXHAUSTED", "503", "UNAVAILABLE", "500", "timeout"]):
                    print(f"  [{tag}] Key {idx+1} hit limits (loop {loop+1}/{max_loops}), trying next key... ERROR: {err_str}")
                    time.sleep(2)
                else:
                    print(f"  [{tag}] Gemini call failed: {err_str}")
                    raise RuntimeError(f"[{tag}] Gemini call failed: {err_str}")
        
        if loop < max_loops - 1:
            print(f"  [{tag}] All keys hit limits. Waiting 60s for RPM reset...")
            time.sleep(60)

    raise RuntimeError(f"[{tag}] All Gemini API keys exhausted.")

def generate_pacing_map():
    print("============================================================")
    print("  Tiny AI Assistant -- Gemini Semantic Pacing Engine")
    print("============================================================")
    
    script_dir = Path(__file__).parent
    audio_dir = script_dir / "audio"
    metadata_path = audio_dir / "narration_metadata.json"
    output_path = script_dir / "pacing_timeline.json"

    api_keys = get_api_keys()
    if not api_keys:
        print("  [ERROR] No Gemini API keys found in .env")
        sys.exit(1)

    with open(metadata_path, 'r', encoding='utf-8') as f:
        metadata = json.load(f)

    script_sections = {
        "module_1_capture": "Welcome to the Early Game Pipeline operational training. In Module 1, we cover the prospect experience. When a prospect like Kevin Smith visits the Octane booking page, he is presented with clear expectations of the thirty-minute pre-screen format before booking. Kevin selects a reason to meet us from the dropdown, then Kevin selects a time slot. Because Albert and Isha cover shift-deterministic hours, the calendar automatically routes the meeting to the active representative. Kevin completes the seven-point intake form, providing his role at Meridian Logistics, his service track interest, and his direct contact details, before submitting the request.",
        "module_2_routing": "Module 2 focuses on payload routing. Once Kevin hits submit, the system triggers two automated actions simultaneously. First, both Isha and Albert receive an instant email notification containing Kevin's booking details: his name, company, service interest, and the scheduled meeting time. This ensures the assigned representative can begin preparation immediately. Second, Kevin's full intake data, including his contact details, discussion topics, and any uploaded files, is automatically organized and stored in a dedicated client folder inside our Google Drive repository. Here you can see the folder structure, containing Kevin's intake form, the historical Statement of Work, and the calendar invite. This creates a single source of truth that the representative, the technical team, and the administrator can all reference throughout the engagement.",
        "module_3_preparation": "Module 3 covers Pre-Screen Preparation. Our sales team never goes into a call blind. Before the meeting, the representative opens 'Tiny', our custom Claude AI Project. They paste the Mega-Prompt template and provide the required inputs: Kevin's intake form, his exported LinkedIn profile PDF, and the historical Statement of Work pulled from the Google Drive repository. Within sixty seconds, Tiny digests these inputs and generates a structured ten-point briefing. This dossier highlights Meridian's likely technical pain points, maps the competitors they are evaluating, and provides three tailored conversation starters to use immediately when the call connects.",
        "module_4_execution": "In Module 4, we execute the Discovery Call. When the Teams meeting begins, the Fathom bot automatically joins to record and transcribe the session. The sales team navigates to the Session tab to view the twelve-question qualification battlecard. Depending on whether Kevin is a first-time user or an existing user, the sales team references Playbook Variant A, B, or C. The sales team asks these questions conversationally, letting Fathom capture the responses without manual typing. Before ending the call, the sales team secures the next step by booking a Positional Meeting with Steny, Kevin, or Amendra directly on the calendar. Finally, the sales team documents their gut feel on the deal, capturing the unspoken signals and lead temperature before handing the account over.",
        "module_5_synthesis": "Module 5 concludes the workflow with Post-Call Synthesis. After hanging up, the sales team copies the Fathom transcript and pastes it back into the Tiny Claude Project. By running the synthesis prompt, the AI instantly generates six critical deliverables: the Recap Email, a Summary Sheet, Detailed Notes, Questionnaire Mapping, Action Items, and a preliminary Proposal. The sales team verifies the Proposal against the official Services Catalog to guarantee all pricing strictly matches our standard list rates. Once verified, the deliverables are copied out and saved to the client folder in Google Drive. The deal is marked as Prescreen Completed, and is successfully handed over to the technical team.",
        "module_6_admin": "Finally, in Module 6, we cover the administrator setup of the Tiny AI Assistant itself. Tiny is powered by a dedicated Claude Project workspace. To build this capability, an administrator first creates a new project and uploads the static Octane knowledge base. This includes our proprietary Service Catalog, key Competitor Profiles, Case Studies, and Pricing Frameworks. Once the context files are uploaded, the administrator configures the custom instructions, embedding the 'Mega-Prompt' logic. This forces the AI to output the strict ten-point prep dossier and the six standardized sales reports, ensuring consistent, enterprise-grade output from the sales team on every single deal."
    }

    action_schema = {
        "module_1_capture": ["select_reason", "click_calendar", "fill_form", "submit_booking"],
        "module_2_routing": ["view_email", "scroll_email", "view_gdrive_folder", "view_gdrive_files"],
        "module_3_preparation": ["paste_linkedin", "attach_sow", "click_generate_briefing", "view_dossier"],
        "module_4_execution": ["click_session_tab", "view_docs", "confirm_booking", "click_completed"],
        "module_5_synthesis": ["paste_transcript", "click_synthesize", "click_reports_tab", "view_docs", "view_proposal", "click_copy"],
        "module_6_admin": ["create_project", "upload_files", "save_project"]
    }

    scene_descriptions = []
    for s in metadata.get("sections", []):
        scene_id = s["name"]
        scene_descriptions.append({
            "id": scene_id,
            "duration_s": s["duration_s"],
            "script": script_sections.get(scene_id, ""),
            "target_actions": action_schema.get(scene_id, [])
        })

    prompt = f"""You are an elite video pacing director. I have an audio script and the exact audio duration for each scene. 
I need to know exactly what time (in seconds) within each scene a visual action should occur so that an automated UI testing tool (Playwright) can trigger it perfectly in sync with the audio.

For example, if the scene duration is 12.8s and the action is "select_reason" and the audio says:
"Sarah inputs her reason for reaching out from the B2B options dropdown."
The action "select_reason" should happen precisely when the word "reason" or "dropdown" is spoken. 

Important Rules:
1. Estimate the timestamp relative to the start of the scene (0.0).
2. The timestamp must be LESS than the `duration_s` of the scene.
3. Distribute actions logically based on when they are mentioned in the text.
4. Leave a slight buffer at the end of the scene if the action finishes before the audio.

Scene Inputs:
{json.dumps(scene_descriptions, indent=2)}

Output ONLY a JSON array matching this exact format:
[
  {{
    "scene_id": "module_1_capture",
    "actions": [
      {{"name": "select_reason", "trigger_time_s": 8.5}}
    ]
  }}
]
"""

    print("  [GEMINI] Calling Gemini-2.5-Flash to generate pacing map...")
    raw, idx = _gemini_call_with_retry(api_keys, "gemini-2.5-flash", prompt, "PACING")
    
    raw = re.sub(r'^```json', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'^```', '', raw, flags=re.MULTILINE).strip()
    
    try:
        pacing_data = json.loads(raw)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(pacing_data, f, indent=2)
        print(f"  [OK] Saved semantic pacing timeline to {output_path.name}")
    except Exception as e:
        print(f"  [ERROR] Failed to parse Gemini output: {e}\nRaw output:\n{raw}")
        sys.exit(1)

if __name__ == "__main__":
    generate_pacing_map()
