import os
import json
import subprocess
from pathlib import Path

def get_ffmpeg_exe():
    """Get FFmpeg path from imageio-ffmpeg."""
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"

def main():
    script_dir = Path(__file__).parent
    audio_dir = script_dir / "audio"
    images_dir = script_dir / "images"
    output_dir = script_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    metadata_path = audio_dir / "narration_metadata.json"
    mastered_audio_path = audio_dir / "full_narration_mastered.mp3"

    if not metadata_path.exists():
        print(f"[ERROR] Metadata not found at {metadata_path}")
        return

    with open(metadata_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    ffmpeg = get_ffmpeg_exe()
    print(f"Using FFmpeg: {ffmpeg}")

    # Temporary directory for scene clips
    temp_dir = output_dir / "temp_clips"
    temp_dir.mkdir(parents=True, exist_ok=True)

    clip_paths = []
    
    # 1. Compile each scene clip
    for i, section in enumerate(metadata["sections"]):
        name = section["name"]
        audio_file = audio_dir / f"{name}.mp3"
        image_file = images_dir / f"scene_{name}.png"

        # Define transitions for multi-image scenes
        transitions = []
        if name == "01_hook":
            total_dur = section["duration_s"]
            # 3.0 + 4.0 + 3.0 + 3.0 + 3.0 = 16.0s
            rem = max(0.5, total_dur - 16.0)
            transitions = [
                ("scene_01_hook_0.png", 3.0),
                ("scene_01_hook_1.png", 4.0),
                ("scene_01_hook_2.png", 3.0),
                ("scene_01_hook_3.png", 3.0),
                ("scene_01_hook_2.png", 3.0),
                ("scene_01_hook_4.png", rem),
            ]
        elif name == "02_context":
            total_dur = section["duration_s"]
            # 5.0 + 5.0 = 10.0s
            rem = max(0.5, total_dur - 10.0)
            transitions = [
                ("scene_01_hook_4.png", 5.0),
                ("scene_01_hook_5.png", 5.0),
                ("scene_01_hook_6.png", rem),
            ]

        clip_output = temp_dir / f"clip_{i+1:02d}.mp4"

        if transitions:
            print(f"Generating transition clip for {name} ({section['duration_s']}s) with {len(transitions)} slides...")
            # Write temporary concat file
            concat_img_path = temp_dir / f"concat_img_{name}.txt"
            with open(concat_img_path, "w", encoding="utf-8") as f_img:
                for img_name, dur in transitions:
                    img_p = images_dir / img_name
                    # Fallback just in case
                    if not img_p.exists():
                        img_p = images_dir / f"scene_{name}.png"
                    f_img.write(f"file '{img_p.as_posix()}'\n")
                    f_img.write(f"duration {dur}\n")
                # Duplicate the last file to handle FFmpeg concat duration drop
                last_img = images_dir / transitions[-1][0]
                if not last_img.exists():
                    last_img = images_dir / f"scene_{name}.png"
                f_img.write(f"file '{last_img.as_posix()}'\n")

            cmd = [
                ffmpeg, "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", str(concat_img_path),
                "-i", str(audio_file),
                "-r", "30",
                "-c:v", "libx264",
                "-tune", "stillimage",
                "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(1280-iw)/2:(720-ih)/2",
                "-c:a", "aac",
                "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-shortest",
                str(clip_output)
            ]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            concat_img_path.unlink(missing_ok=True)
        else:
            # Check for matching image (if name starts with digits, e.g. "01_hook" -> "scene_01_hook.png")
            if not image_file.exists():
                # Try alternate naming structure
                image_file = images_dir / f"scene_{i+1:02d}_{name.split('_', 1)[-1]}.png"
            
            if not image_file.exists():
                # Scan directory for matching index
                for img in images_dir.glob(f"scene_{i+1:02d}_*.png"):
                    image_file = img
                    break

            if not image_file.exists() or not audio_file.exists():
                print(f"[ERROR] Missing assets for section {name}. Image: {image_file.exists()}, Audio: {audio_file.exists()}")
                return

            print(f"Generating static clip for {name} ({section['duration_s']}s) from {image_file.name}...")
            cmd = [
                ffmpeg, "-y",
                "-loop", "1",
                "-framerate", "30",
                "-i", str(image_file),
                "-i", str(audio_file),
                "-c:v", "libx264",
                "-tune", "stillimage",
                "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(1280-iw)/2:(720-ih)/2",
                "-c:a", "aac",
                "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-shortest",
                str(clip_output)
            ]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        clip_paths.append(clip_output)

    # 2. Concat clips using filter_complex concat
    temp_merged_path = output_dir / "temp_merged.mp4"
    print("\nConcatenating all clips using filter_complex concat...")
    
    cmd_concat = [ffmpeg, "-y"]
    for p in clip_paths:
        cmd_concat.extend(["-i", str(p)])
        
    filter_str = "".join(f"[{k}:v][{k}:a]" for k in range(len(clip_paths)))
    filter_str += f"concat=n={len(clip_paths)}:v=1:a=1[outv][outa]"
    
    cmd_concat.extend([
        "-filter_complex", filter_str,
        "-map", "[outv]",
        "-map", "[outa]",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        str(temp_merged_path)
    ])
    subprocess.run(cmd_concat, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 3. Swap audio track with mastered audio
    final_output_path = output_dir / "Tiny_AI_Assistant_Guide.mp4"
    print(f"\nReplacing audio track with mastered audio: {mastered_audio_path.name}...")
    
    cmd_audio_swap = [
        ffmpeg, "-y",
        "-i", str(temp_merged_path),
        "-i", str(mastered_audio_path),
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "256k",
        "-map", "0:v:0",
        "-map", "1:a:0",
        str(final_output_path)
    ]
    subprocess.run(cmd_audio_swap, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 4. Clean up temp clips
    print("\nCleaning up temporary files...")
    for p in clip_paths:
        p.unlink(missing_ok=True)
    temp_merged_path.unlink(missing_ok=True)
    temp_dir.rmdir()

    print(f"\n[SUCCESS] Screencast slideshow assembled at: {final_output_path}")

if __name__ == "__main__":
    main()
