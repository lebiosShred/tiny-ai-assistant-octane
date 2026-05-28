import os
import subprocess
from pathlib import Path
import imageio_ffmpeg

def main():
    print("=" * 60)
    # Clinical and quiet title
    print("  Tiny AI Assistant -- Modular Audio Muxing Engine")
    print("=" * 60)

    script_dir = Path(__file__).parent
    recording_dir = script_dir / "recording"
    audio_dir = script_dir / "audio"
    
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    
    modules = [
        "module_1_capture",
        "module_2_routing",
        "module_3_preparation",
        "module_4_execution",
        "module_5_synthesis",
        "module_6_admin",
        "module_7_technical",
        "module_8_audit",
        "module_9_admin",
        "module_10_analytics"
    ]
    
    for mod in modules:
        video_path = recording_dir / f"{mod}.mp4"
        audio_path = audio_dir / f"{mod}.mp3"
        temp_voiced_path = recording_dir / f"{mod}_voiced_temp.mp4"
        
        if not video_path.exists():
            print(f"  [SKIP] Video file not found: {video_path.name}")
            continue
        if not audio_path.exists():
            print(f"  [SKIP] Audio file not found: {audio_path.name}")
            continue
            
        print(f"\n  ▶ Muxing audio for {mod}...")
        print(f"    Video: {video_path.name}")
        print(f"    Audio: {audio_path.name}")
        
        # Add a check for the subtitle file
        srt_path = audio_dir / f"{mod}.srt"
        if srt_path.exists():
            # Use relative path to avoid the C: colon breaking the filter string
            srt_rel = f"audio/{mod}.srt"
            # Using simple subtitles filter
            vf_args = ["-vf", f"subtitles='{srt_rel}':force_style='FontSize=7.5,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Outline=2'"]
            cv_args = ["-c:v", "libx264", "-preset", "fast", "-crf", "23"]
        else:
            vf_args = []
            cv_args = ["-c:v", "copy"]

        # Merge video and audio tracks, burning subtitles if present
        cmd = [
            ffmpeg_exe, "-y",
            "-i", str(video_path),
            "-i", str(audio_path)
        ] + vf_args + cv_args + [
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            str(temp_voiced_path)
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            # Overwrite original silent video with the voiced version
            video_path.unlink()
            temp_voiced_path.rename(video_path)
            size_mb = os.path.getsize(str(video_path)) / (1024 * 1024)
            print(f"  [OK] Successfully saved voiced video: {video_path.name} ({size_mb:.1f} MB)")
        else:
            print(f"  [ERROR] FFmpeg failed for {mod}: {result.stderr}")
            if temp_voiced_path.exists():
                temp_voiced_path.unlink()

    print("\n" + "=" * 60)
    print("  AUDIO MUXING COMPLETE -- Clickable links will now play with audio.")
    print("=" * 60)

if __name__ == "__main__":
    main()
