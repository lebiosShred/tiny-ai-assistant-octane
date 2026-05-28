import subprocess
import argparse
import sys
from pathlib import Path

def run_step(name, cmd, cwd):
    print("\n" + "=" * 60)
    print(f"  STEP: {name}")
    print("=" * 60)
    
    result = subprocess.run(cmd, cwd=cwd, text=True)
    if result.returncode != 0:
        print(f"\n  [FATAL] Pipeline failed during '{name}'.")
        sys.exit(result.returncode)

def main():
    parser = argparse.ArgumentParser(description="Tiny AI Assistant -- Unified Build Pipeline")
    parser.add_argument("--module", type=str, default="all", help="Specific module to render (e.g., '1' or 'all')")
    parser.add_argument("--skip-audio", action="store_true", help="Skip TTS audio generation")
    parser.add_argument("--headless", action="store_true", help="Run Playwright browser in headless mode")
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    
    if not args.skip_audio:
        run_step("Generate Audio Narration", ["python", "generate_narration.py"], cwd=script_dir)
        run_step("Semantic Timeline Synchronization", ["python", "sync_pacing.py"], cwd=script_dir)
    else:
        print("\n  [SKIP] Skipping Audio Generation and Timeline Sync.")

    record_cmd = ["python", "record_playwright.py"]
    if args.module != "all":
        record_cmd.extend(["--module", args.module])
    if args.headless:
        record_cmd.append("--headless")
        
    run_step("Record Playwright Visuals", record_cmd, cwd=script_dir)
    run_step("Mux Audio and Finalize", ["python", "mux_module_audio.py"], cwd=script_dir)

    print("\n" + "=" * 60)
    print("  COURSE BUILD COMPLETE -- ALL PIPELINES SUCCEEDED.")
    print("=" * 60)

if __name__ == "__main__":
    main()
