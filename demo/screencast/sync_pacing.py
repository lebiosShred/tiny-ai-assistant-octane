import json
import os
import re
import shutil
import tempfile
import subprocess
from pathlib import Path
import imageio_ffmpeg

def normalize_text(text):
    """Normalize text by converting to lowercase and stripping non-alphanumeric characters."""
    text = text.lower().replace("-", " ")
    return re.sub(r'[^a-z0-9\s]', '', text).strip()

def find_phrase_start(words_data, target_phrase):
    """
    Search for a target phrase in the word-level timestamp data.
    Returns the start time of the first word in the matched sequence.
    """
    target_words = normalize_text(target_phrase).split()
    if not target_words:
        return None

    for i in range(len(words_data) - len(target_words) + 1):
        match = True
        for j, t_word in enumerate(target_words):
            transcribed_word = normalize_text(words_data[i + j]["word"])
            if t_word != transcribed_word:
                match = False
                break
        
        if match:
            return words_data[i]["start"]
            
    return None

def main():
    print("=" * 60)
    print("  Tiny AI Assistant -- Semantic Pacing Sync Engine")
    print("=" * 60)

    script_dir = Path(__file__).parent
    audio_dir = script_dir / "audio"
    triggers_path = audio_dir / "pacing_triggers.json"
    timeline_path = script_dir / "pacing_timeline.json"

    if not triggers_path.exists():
        print(f"  [ERROR] Cannot find triggers file: {triggers_path}")
        return

    with open(triggers_path, "r", encoding="utf-8") as f:
        triggers = json.load(f)

    # Setup FFmpeg for Whisper
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    temp_dir = tempfile.mkdtemp()
    temp_ffmpeg = Path(temp_dir) / "ffmpeg.exe"
    shutil.copy2(ffmpeg_exe, temp_ffmpeg)
    
    old_path = os.environ.get("PATH", "")
    os.environ["PATH"] = temp_dir + os.pathsep + old_path

    pacing_data = []

    try:
        for scene_id, scene_triggers in triggers.items():
            audio_path = audio_dir / f"{scene_id}.mp3"
            json_output = audio_dir / f"{scene_id}.json"
            if not audio_path.exists():
                print(f"  [WARN] Missing audio for {scene_id}. Skipping...")
                continue

            print(f"\n  ▶ Analyzing timestamps for {scene_id}...")
            
            # Run Whisper via CLI
            subprocess.run([
                "whisper", str(audio_path),
                "--model", "base",
                "--output_format", "json",
                "--word_timestamps", "True",
                "--output_dir", str(audio_dir),
                "--language", "en"
            ], capture_output=True, check=True)
            
            if not json_output.exists():
                print(f"    [ERROR] Whisper failed to generate JSON for {scene_id}")
                continue
                
            with open(json_output, "r", encoding="utf-8") as f:
                result = json.load(f)
            
            words_data = []
            for segment in result.get("segments", []):
                for word_info in segment.get("words", []):
                    words_data.append(word_info)

            scene_actions = []
            for action_name, target_phrase in scene_triggers.items():
                start_time = find_phrase_start(words_data, target_phrase)
                if start_time is not None:
                    scene_actions.append({
                        "name": action_name,
                        "trigger_time_s": round(start_time, 2)
                    })
                    print(f"    [MATCH] '{action_name}' mapped to {start_time:.2f}s (Phrase: '{target_phrase}')")
                else:
                    print(f"    [ERROR] Could not find phrase '{target_phrase}' for action '{action_name}'.")
                    scene_actions.append({
                        "name": action_name,
                        "trigger_time_s": 0.0
                    })

            scene_actions.sort(key=lambda x: x["trigger_time_s"])
            
            pacing_data.append({
                "scene_id": scene_id,
                "actions": scene_actions
            })

        with open(timeline_path, "w", encoding="utf-8") as f:
            json.dump(pacing_data, f, indent=2)

        print("\n" + "=" * 60)
        print("  PACING SYNC COMPLETE -- pacing_timeline.json generated.")
        print("=" * 60)

    finally:
        os.environ["PATH"] = old_path
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    main()
