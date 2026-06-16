#!/usr/bin/env python3
import argparse
import os
import subprocess
import sys
from pathlib import Path

def get_ffmpeg_exe():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        print("  [WARN] imageio-ffmpeg package not found.")
        return "ffmpeg"

def main():
    parser = argparse.ArgumentParser(description="Assemble Tiny AI Assistant screencast (Gemini Paced)")
    parser.add_argument("video", help="Path to raw screen recording (e.g. recording/screen_recording.mp4)")
    parser.add_argument("--bgm", help="Path to background music file", default=None)
    parser.add_argument("--output", help="Output filename", default="Tiny_AI_Assistant_Guide.mp4")
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    audio_dir = script_dir / "audio"
    output_dir = script_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    video_path = Path(args.video)
    narration_path = audio_dir / "full_narration_mastered.mp3"

    if not video_path.exists():
        print(f"  [ERROR] Video file not found: {video_path}")
        sys.exit(1)
    if not narration_path.exists():
        print(f"  [ERROR] Narration audio not found: {narration_path}")
        sys.exit(1)

    print("=" * 60)
    print("  Tiny AI Assistant -- Screencast Assembly (Muxing)")
    print("=" * 60)

    # Broadcast mastering chain for the narration track
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

    ffmpeg = get_ffmpeg_exe()
    final_path = output_dir / args.output

    if args.bgm and Path(args.bgm).exists():
        print(f"  [MERGE] Adding background music with dynamic ducking...")
        filter_complex_str = (
            f"[1:a]{broadcast_filter}[voice];"
            f"[2:a]volume=0.15,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[bgm_fmt];"
            f"[voice]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,asplit[voice_out][voice_sc];"
            f"[bgm_fmt][voice_sc]sidechaincompress=threshold=0.06:ratio=6:attack=50:release=1500[ducked_bg];"
            f"[ducked_bg][voice_out]amix=inputs=2:duration=longest:normalize=0[aout]"
        )
        cmd = [
            ffmpeg, "-y",
            "-i", str(video_path),
            "-i", str(narration_path),
            "-i", str(args.bgm),
            "-filter_complex", filter_complex_str,
            "-map", "0:v", "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
            "-shortest",
            str(final_path)
        ]
    else:
        print(f"  [MERGE] Simple merge without BGM...")
        filter_complex_str = f"[1:a]{broadcast_filter}[aout]"
        cmd = [
            ffmpeg, "-y",
            "-i", str(video_path),
            "-i", str(narration_path),
            "-filter_complex", filter_complex_str,
            "-map", "0:v", "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
            "-shortest",
            str(final_path)
        ]

    print("\n  [FFMPEG] Running video processing...")
    subprocess.run(cmd, check=True)
    
    size_mb = os.path.getsize(str(final_path)) / (1024 * 1024)
    print(f"  [OK] Saved final synchronized video: {final_path} ({size_mb:.1f} MB)")

if __name__ == "__main__":
    main()
