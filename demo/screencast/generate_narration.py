"""
Tiny AI Assistant -- Screencast Narration Generator
====================================================
Generates professional TTS narration using edge-tts (en-US-AndrewNeural).
Applies pronunciation dictionary, generates per-section audio, and builds
a concatenated full narration file.

Requirements (all pre-installed):
  - edge-tts
  - imageio-ffmpeg (for FFmpeg binary)

Usage:
  python generate_narration.py
"""
import asyncio
import json
import re
import os
import subprocess
from pathlib import Path

# ── Configuration ──
VOICE = "en-US-AndrewNeural"
RATE = "-15%"
OUTPUT_DIR = Path(__file__).parent / "audio"
DICT_PATH = Path(__file__).parent / "pronunciation_dict.json"

# ── Narration Script ──
SCRIPT_SECTIONS = [
    {
        "name": "module_1_settings",
        "text": (
            "Welcome to the Early Game Pipeline operational training. In Module 1, we cover the administrator setup of the Tiny AI Assistant itself. "
            "Tiny is powered by a dedicated Claude Project workspace. To build this capability, an administrator first creates a new project and uploads the static Octane knowledge base. This includes our proprietary Service Catalog, key Competitor Profiles, Case Studies, and Pricing Frameworks. "
            "Once the context files are uploaded, the administrator configures the custom instructions, embedding the 'Mega-Prompt' logic. This forces the AI to output the strict ten-point prep dossier and the six standardized sales reports, ensuring consistent, enterprise-grade output from the sales team on every single deal."
        ),
        "triggers": {
            "create_project": "creates a new project",
            "upload_files": "uploads the static",
            "paste_prompt": "configures the custom instructions",
            "save_project": "ensuring consistent"
        }
    },
    {
        "name": "module_2_booking",
        "text": (
            "In Module 2, we cover the prospect experience. "
            "When a prospect like Kevin Smith visits the Octane booking page, he sees a professional calendar with clear expectations of the thirty-minute pre-screen format. "
            "Kevin selects a reason to meet from the dropdown... then selects a date from the calendar. Meetings are automatically assigned to an available representative -- the prospect never has to choose a host. "
            "Kevin picks an available time slot... and completes the intake form, providing his role at Meridian Logistics, his service track interest, and contact details. "
            "The system confirms the booking and assigns the representative automatically."
        ),
        "triggers": {
            "select_reason": "Kevin selects a reason",
            "click_calendar": "then selects a date",
            "select_timeslot": "Kevin picks an available time",
            "fill_form": "and completes the intake form",
            "submit_booking": "The system confirms the booking"
        }
    },
    {
        "name": "module_3a_routing",
        "text": (
            "Module 3 focuses on lead ingestion and payload routing. "
            "Once Kevin hits submit, the system triggers two automated actions simultaneously. "
            "First, both Isha and Albert receive an instant email notification containing Kevin's booking details: his name, company, service interest, and the scheduled meeting time. This ensures the assigned representative can begin preparation immediately. "
            "Second, Kevin's full intake data, including his contact details, discussion topics, and any uploaded files, is automatically organized and stored in a dedicated client folder inside our Google Drive repository. "
            "Here you can see the folder structure, containing Kevin's intake form, the historical Statement of Work, and the calendar invite. This creates a single source of truth that the representative, the technical team, and the administrator can all reference throughout the engagement."
        ),
        "triggers": {
            "view_email": "Isha and Albert receive an instant email",
            "scroll_email": "assigned representative can begin preparation",
            "view_gdrive_folder": "organized and stored in a dedicated client folder",
            "view_gdrive_files": "containing Kevin's intake form"
        }
    },
    {
        "name": "module_3b_preparation",
        "text": (
            "Continuing in Module 3, we cover Pre-Screen Preparation. Our sales team never goes into a call blind. "
            "Before the meeting, the representative opens Tiny -- our custom AI project -- and pastes the Mega Prompt template. "
            "A mega prompt is a comprehensive, structured instruction set that tells the AI exactly how to analyze the prospect. It defines the role, injects all context, specifies the twelve output sections, and sets guardrails -- like flagging insufficient data instead of hallucinating. "
            "The representative feeds in five data sources: Kevin's booking form answers, his LinkedIn profile, and the historical Statement of Work from Google Drive. "
            "Within sixty seconds, Tiny digests these inputs and generates a structured twelve-section briefing. "
            "This dossier highlights Meridian's likely technical pain points, maps the competitors they are evaluating, and provides three tailored conversation starters. "
            "But what happens when the prospect's LinkedIn is sparse or the booking form answers are vague? The AI flags gaps as 'Needs Research'. "
            "This is where the Tiny AI Chatbot Widget comes in. The representative clicks the chat bubble and asks targeted questions. "
            "For example: 'What does Meridian Logistics sell and who are their main competitors?' "
            "The representative copies the response and pastes it directly into the input form, enriching the context before re-running the dossier generation for a more complete briefing."
        ),
        "triggers": {
            "paste_linkedin": "exported LinkedIn profile",
            "attach_sow": "Statement of Work from Google Drive",
            "click_generate_briefing": "generates a structured twelve-section",
            "view_dossier": "provides three tailored conversation",
            "show_gap": "The AI flags gaps as 'Needs Research'",
            "open_chatbot": "The representative clicks the chat bubble",
            "chatbot_query": "For example: 'What does",
            "copy_paste_response": "The representative copies the response"
        }
    },
    {
        "name": "module_4_execution",
        "text": (
            "In Module 4, we execute the Discovery Call. "
            "When the Teams meeting begins, the Fathom bot automatically joins to record and transcribe the session. "
            "The sales team navigates to the Session tab to view the qualification battlecard. "
            "In cases where the recording bot fails to connect -- due to waiting room settings or IT restrictions -- the team has backups. They can use the platform's built-in recording, or tools like 3CX for phone-based calls. "
            "After the call, the representative uploads the recording directly via the Upload Recording button. The system accepts MP3, MP4, M4A, and WAV files and automatically transcribes the audio. "
            "The sales team references Playbook Variant A or B depending on the prospect's experience. They ask these questions conversationally, letting the recording tool capture the responses. "
            "Before ending the call, the sales team secures the next step by booking a Positional Meeting with the directors. "
            "The sales team documents their gut feel on the deal, capturing the unspoken signals and lead temperature. "
            "The AI validates this assessment against the transcript, classifying the lead as Hot with an eight-out-of-ten confidence score, and identifying their position in the sales funnel as a Sales Qualified Lead. "
            "Based on the classification, the system recommends the appropriate follow-up -- in this case, an immediate positional meeting with the technical director."
        ),
        "triggers": {
            "show_recording_active": "navigates to the Session",
            "show_contingency": "recording bot fails to connect",
            "show_upload": "uploads the recording directly",
            "view_battlecard": "references Playbook Variant A or B",
            "confirm_booking": "booking a Positional Meeting",
            "click_completed": "documents their gut feel on the deal",
            "show_classification": "classifying the lead as Hot",
            "show_next_action": "recommends the appropriate follow-up"
        }
    },
    {
        "name": "module_5_synthesis",
        "text": (
            "Module 5 concludes the workflow with Post-Call Synthesis. "
            "After hanging up, the sales team copies the Fathom transcript and pastes it back into the Tiny Claude Project. By running the synthesis prompt, the AI instantly generates six critical deliverables: the Recap Email, a Summary Sheet, Detailed Notes, Questionnaire Mapping, Action Items, and a preliminary Proposal. "
            "The sales team verifies the Proposal against the official Services Catalog to guarantee all pricing strictly matches our standard list rates. Once verified, the deliverables are copied out and saved to the client folder in Google Drive. "
            "The deal is marked as Prescreen Completed, and is successfully handed over to the technical team."
        ),
        "triggers": {
            "paste_transcript": "the fathom transcript",
            "click_synthesize": "instantly generates six critical",
            "click_reports_tab": "the Recap Email",
            "view_docs": "official Services Catalog",
            "view_proposal": "strictly matches our standard",
            "click_copy": "are copied out"
        }
    }
]


def load_pronunciation_dict():
    """Load the pronunciation dictionary for TTS corrections."""
    if DICT_PATH.exists():
        with open(DICT_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def apply_pronunciation(text, pron_dict):
    """Apply regex-based pronunciation substitutions."""
    for pattern, replacement in pron_dict.items():
        text = re.sub(pattern, replacement, text)
    return text


async def generate_section(name, text, pron_dict):
    """Generate a single TTS audio section with WebVTT subtitles."""
    import edge_tts

    output_path = OUTPUT_DIR / f"{name}.mp3"
    srt_path = OUTPUT_DIR / f"{name}.srt"
    # Ensure fresh generation
    if output_path.exists():
        output_path.unlink()
    if srt_path.exists():
        srt_path.unlink()

    # Apply pronunciation corrections
    tts_text = apply_pronunciation(text, pron_dict)
    print(f"  [TTS] Generating {name} with subtitles...")
    print(f"         Text: {tts_text[:80]}...")

    communicate = edge_tts.Communicate(tts_text, VOICE, rate=RATE)
    submaker = edge_tts.SubMaker()
    
    with open(str(output_path), "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                submaker.feed(chunk)

    with open(str(srt_path), "w", encoding="utf-8") as f:
        f.write(submaker.get_srt())

    # Get duration via FFmpeg
    duration = get_audio_duration(str(output_path))
    print(f"  [OK]  {name}.mp3 & .srt ({duration:.1f}s)")
    return output_path


def get_ffmpeg_exe():
    """Get the FFmpeg executable path from imageio-ffmpeg."""
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def get_audio_duration(filepath):
    """Get audio duration in seconds using FFmpeg."""
    ffmpeg = get_ffmpeg_exe()
    result = subprocess.run(
        [ffmpeg, "-i", filepath, "-f", "null", "-"],
        capture_output=True, text=True, timeout=30
    )
    # Parse duration from stderr
    for line in result.stderr.split("\n"):
        if "Duration:" in line:
            match = re.search(r"Duration:\s*(\d+):(\d+):(\d+)\.(\d+)", line)
            if match:
                h, m, s, cs = match.groups()
                return int(h) * 3600 + int(m) * 60 + int(s) + int(cs) / 100
    return 0.0


def concatenate_audio(section_files, output_path):
    """Concatenate all section MP3s into a single file with gaps between sections."""
    ffmpeg = get_ffmpeg_exe()

    # Generate 1 second of silence for gaps
    silence_path = OUTPUT_DIR / "_silence_1s.mp3"
    if not silence_path.exists():
        subprocess.run([
            ffmpeg, "-y",
            "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
            "-t", "1.0",
            "-c:a", "libmp3lame", "-b:a", "192k",
            str(silence_path)
        ], capture_output=True, check=True, timeout=30)

    # Build concat list: section -> silence -> section -> silence -> ...
    concat_list = OUTPUT_DIR / "_concat_list.txt"
    with open(concat_list, "w", encoding="utf-8") as f:
        for i, section_file in enumerate(section_files):
            path = str(section_file).replace("\\", "/").replace("'", "'\\''")
            f.write(f"file '{path}'\n")
            if i < len(section_files) - 1:
                sil_path = str(silence_path).replace("\\", "/").replace("'", "'\\''")
                f.write(f"file '{sil_path}'\n")

    # Concatenate
    print(f"\n  [CONCAT] Building full_narration.mp3...")
    subprocess.run([
        ffmpeg, "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
        "-c:a", "libmp3lame", "-b:a", "192k",
        str(output_path)
    ], capture_output=True, check=True, timeout=120)

    duration = get_audio_duration(str(output_path))
    print(f"  [OK]  full_narration.mp3 ({duration:.1f}s)")

    # Cleanup temp files
    silence_path.unlink(missing_ok=True)
    concat_list.unlink(missing_ok=True)

    return duration


def apply_broadcast_mastering(input_path, output_path):
    """Apply the TM1-proven 7-stage broadcast mastering chain."""
    ffmpeg = get_ffmpeg_exe()

    broadcast_filter = (
        "highpass=f=80,"
        "equalizer=f=200:t=q:w=1.5:g=-3,"
        "equalizer=f=3000:t=q:w=1.5:g=2,"
        "equalizer=f=8000:t=q:w=2:g=1.5,"
        "compand=attacks=0.005:decays=0.1:"
        "points=-80/-80|-45/-25|-27/-15|-15/-10|0/-6:gain=3,"
        "deesser=i=0.4:m=0.5:f=0.5,"
        "loudnorm=I=-16:TP=-1.5:LRA=11"
    )

    print(f"\n  [MASTER] Applying broadcast mastering chain...")
    subprocess.run([
        ffmpeg, "-y",
        "-i", str(input_path),
        "-af", broadcast_filter,
        "-ar", "48000",
        "-c:a", "libmp3lame", "-b:a", "256k",
        str(output_path)
    ], capture_output=True, check=True, timeout=120)

    duration = get_audio_duration(str(output_path))
    print(f"  [OK]  full_narration_mastered.mp3 ({duration:.1f}s)")
    return duration


async def main():
    """Generate all narration audio."""
    print("=" * 60)
    print("  Tiny AI Assistant -- Narration Generator")
    print(f"  Voice: {VOICE} | Rate: {RATE}")
    print("=" * 60)

    # Setup
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pron_dict = load_pronunciation_dict()
    print(f"\n  Pronunciation dictionary: {len(pron_dict)} entries loaded")

    # Generate per-section audio
    print(f"\n  Generating {len(SCRIPT_SECTIONS)} sections...\n")
    section_files = []
    section_metadata = []

    for section in SCRIPT_SECTIONS:
        name = section["name"]
        text = section["text"]
        filepath = await generate_section(name, text, pron_dict)
        section_files.append(filepath)
        duration = get_audio_duration(str(filepath))
        word_count = len(text.split())
        section_metadata.append({
            "name": name,
            "file": str(filepath),
            "duration_s": round(duration, 2),
            "word_count": word_count,
            "wpm": round(word_count / (duration / 60), 1) if duration > 0 else 0
        })

    # Concatenate all sections
    full_narration = OUTPUT_DIR / "full_narration.mp3"
    total_duration = concatenate_audio(section_files, full_narration)

    # Apply broadcast mastering
    mastered_path = OUTPUT_DIR / "full_narration_mastered.mp3"
    mastered_duration = apply_broadcast_mastering(full_narration, mastered_path)

    # Save metadata
    metadata = {
        "voice": VOICE,
        "rate": RATE,
        "total_duration_s": round(total_duration, 2),
        "mastered_duration_s": round(mastered_duration, 2),
        "total_words": sum(m["word_count"] for m in section_metadata),
        "average_wpm": round(
            sum(m["word_count"] for m in section_metadata) /
            (total_duration / 60) if total_duration > 0 else 0, 1
        ),
        "sections": section_metadata
    }
    metadata_path = OUTPUT_DIR / "narration_metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    # Save triggers
    triggers = {sec["name"]: sec["triggers"] for sec in SCRIPT_SECTIONS}
    triggers_path = OUTPUT_DIR / "pacing_triggers.json"
    with open(triggers_path, "w", encoding="utf-8") as f:
        json.dump(triggers, f, indent=2)

    # Summary
    print("\n" + "=" * 60)
    print("  GENERATION COMPLETE")
    print("=" * 60)
    print(f"\n  Total duration:    {total_duration:.1f}s ({total_duration/60:.1f} min)")
    print(f"  Mastered duration: {mastered_duration:.1f}s ({mastered_duration/60:.1f} min)")
    print(f"  Total words:       {metadata['total_words']}")
    print(f"  Average WPM:       {metadata['average_wpm']}")
    print(f"\n  Sections:")
    for m in section_metadata:
        print(f"    {m['name']:20s}  {m['duration_s']:5.1f}s  ({m['word_count']} words, {m['wpm']} wpm)")
    print(f"\n  Output directory:  {OUTPUT_DIR}")
    print(f"  Full narration:    {full_narration}")
    print(f"  Mastered version:  {mastered_path}")
    print(f"  Metadata:          {metadata_path}")
    print()


if __name__ == "__main__":
    asyncio.run(main())
