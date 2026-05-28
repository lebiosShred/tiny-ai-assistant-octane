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

def _gemini_call_with_retry(api_keys, model_id, contents, tag="SYNC", temperature=0.1, max_loops=4):
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

def _gemini_upload_video(media_path, api_keys, tag="UPLOAD"):
    from google import genai
    max_loops = 4
    for loop in range(max_loops):
        for idx, key in enumerate(api_keys):
            try:
                client = genai.Client(api_key=key)
                print(f"  [{tag}] Uploading video to Gemini (Key {idx+1}/{len(api_keys)})...")
                media_file = client.files.upload(file=str(media_path))
                
                wait_time = 0
                timeout = 180
                while media_file.state.name == "PROCESSING":
                    time.sleep(5)
                    wait_time += 5
                    if wait_time > timeout:
                        print(f"  [{tag}] Gemini processing timeout ({timeout}s). Deleting stuck file and retrying...")
                        try:
                            client.files.delete(name=media_file.name)
                        except:
                            pass
                        raise TimeoutError("Gemini video processing stuck")
                    media_file = client.files.get(name=media_file.name)
                
                if media_file.state.name == "FAILED":
                    print(f"  [{tag}] Gemini media processing failed. Retrying...")
                    continue
                
                print(f"  [{tag}] Upload complete and processed.")
                return client, media_file, key
            except Exception as e:
                err_str = str(e)
                if any(x in err_str for x in ["429", "RESOURCE_EXHAUSTED", "503", "UNAVAILABLE", "500"]):
                    print(f"  [{tag}] Key {idx+1} hit limits (loop {loop+1}/{max_loops}), trying next key...")
                    time.sleep(2)
                else:
                    print(f"  [{tag}] Upload failed: {err_str}")
                    
        if loop < max_loops - 1:
            print(f"  [{tag}] All keys hit limits. Waiting 60s for RPM reset...")
            time.sleep(60)
            
    print(f"  [{tag}] All keys exhausted after {max_loops} loops.")
    return None, None, None

def _gemini_cleanup_file(client, media_file, tag="CLEANUP"):
    if not client or not media_file:
        return
    try:
        client.files.delete(name=media_file.name)
        print(f"  [{tag}] Cleaned up Gemini file: {media_file.name}")
    except Exception as e:
        print(f"  [{tag}] Cleanup failed (non-fatal): {e}")

def get_scene_timing(video_path, metadata_path, output_path):
    print("\n============================================================")
    print("  Tiny AI Assistant -- Semantic Video Synchronization")
    print("============================================================")
    
    api_keys = get_api_keys()
    if not api_keys:
        print("  [ERROR] No Gemini API keys found in .env")
        sys.exit(1)

    with open(metadata_path, 'r', encoding='utf-8') as f:
        metadata = json.load(f)

    # Import the script text directly from the generator script
    import generate_narration
    script_sections = dict(generate_narration.SCRIPT_SECTIONS)

    # Prepare scene descriptions for Gemini
    scene_descriptions = []
    for s in metadata.get("sections", []):
        scene_id = s["name"]
        scene_descriptions.append({
            "id": scene_id,
            "script": script_sections.get(scene_id, "")
        })
    
    prompt = f"""You are an elite video editor mapping a narration script to a UI screencast.
Watch the video and map EACH scene from the script to the EXACT start and end timestamp (in seconds) in the video.
The video shows someone navigating a web app. The actions exactly mirror the narrative.
If a scene describes an action, find that exact action in the video.

Script Scenes:
{json.dumps(scene_descriptions, indent=2)}

Output ONLY a JSON array mapping each scene ID to its visual start and end time.
Example:
[
  {{
    "id": "01_hook",
    "video_start_sec": 0.0,
    "video_end_sec": 4.5
  }}
]
"""

    client = None
    media_file = None
    from google import genai
    from google.genai import types

    for key_idx, key in enumerate(api_keys):
        try:
            print(f"  [SYNC] Trying API Key {key_idx+1}/{len(api_keys)}...")
            client = genai.Client(api_key=key, http_options={'timeout': 600000})
            
            # Upload
            print(f"  [SYNC] Uploading video to Gemini...")
            media_file = client.files.upload(file=str(video_path))
            
            wait_time = 0
            timeout = 180
            while media_file.state.name == "PROCESSING":
                time.sleep(5)
                wait_time += 5
                if wait_time > timeout:
                    raise TimeoutError("Gemini video processing stuck")
                media_file = client.files.get(name=media_file.name)
            
            if media_file.state.name == "FAILED":
                raise RuntimeError("Gemini media processing failed.")
            
            print(f"  [SYNC] Upload complete. Analyzing video timeline...")
            
            # Generate
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[media_file, prompt],
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    response_mime_type="application/json",
                ),
            )
            
            raw = response.text.strip()
            raw = re.sub(r'^```json', '', raw, flags=re.MULTILINE)
            raw = re.sub(r'^```', '', raw, flags=re.MULTILINE).strip()
            
            timing_data = json.loads(raw)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(timing_data, f, indent=2)
                
            print(f"  [OK] Extracted temporal map for {len(timing_data)} scenes.")
            return output_path
            
        except Exception as e:
            print(f"  [SYNC] Key {key_idx+1} failed: {e}")
        finally:
            if client and media_file:
                try:
                    client.files.delete(name=media_file.name)
                    print(f"  [SYNC] Cleaned up Gemini file.")
                except:
                    pass
            client = None
            media_file = None
            
    print("  [ERROR] All Gemini API keys exhausted.")
    sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python gemini_sync.py <video.mp4> <narration_metadata.json> <output_timing.json>")
        sys.exit(1)
    get_scene_timing(sys.argv[1], sys.argv[2], sys.argv[3])
