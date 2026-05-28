import json
from pathlib import Path

def main():
    log_path = Path("C:/Users/SkyDr/.gemini/antigravity/brain/6bf59c98-d941-47c7-b351-97854a567db9/.system_generated/logs/transcript.jsonl")
    out_path = Path("C:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/scratch/subagent_message.txt")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(log_path, "r", encoding="utf-8") as f:
        for line in f:
            try:
                data = json.loads(line)
                if "tool_calls" in data and data["tool_calls"]:
                    for tc in data["tool_calls"]:
                        if tc.get("name") == "send_message":
                            msg = tc["args"].get("Message")
                            if msg:
                                with open(out_path, "w", encoding="utf-8") as out:
                                    out.write(msg)
                                print(f"Successfully wrote message to {out_path}")
                                return
            except Exception as e:
                continue

if __name__ == "__main__":
    main()
