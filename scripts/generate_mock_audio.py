import asyncio
import os
import subprocess
from pathlib import Path
import edge_tts

# ── Voice Configuration ──
# Isha (Sales)
VOICE_FEMALE = "en-US-JennyNeural"
# CJ Amiel Lebios (Prospect) 
VOICE_MALE = "en-US-GuyNeural"

OUTPUT_DIR = Path(__file__).parent.parent / "demo" / "assets"
TEMP_DIR = OUTPUT_DIR / "temp_audio"

# Dialogue Data
DIALOGUE = [
    ("Female", "Hi CJ, thank you for booking some time with us. I saw on your discovery form that you're leading the team over at Octane Software Solutions."),
    ("Male", "Yes, that's correct. We've been experiencing quite a bit of growth lately, and it's putting a lot of pressure on our sales and technical teams."),
    ("Female", "I saw you mentioned a bottleneck regarding lead qualification and technical handover. Can you elaborate on that?"),
    ("Male", "Sure. Right now, our sales reps are spending hours manually researching prospects, typing up notes, and copying CRM data. By the time they hand a lead over to the engineering team, half the context is lost, or it takes them two days just to format a proposal. It's incredibly inefficient."),
    ("Female", "That's a classic bottleneck. It sounds like you're spending 80% of your time just moving data instead of actually closing deals."),
    ("Male", "Exactly. We need a way to automate the pre-call research and post-call synthesis without losing the human touch in our sales process."),
    ("Female", "If we could implement an AI-driven pipeline that instantly analyzes a prospect's background, and then automatically synthesizes your call transcripts into ready-to-send proposals and CRM notes, what would that mean for your team?"),
    ("Male", "It would save us at least three days every week. My team could actually focus on talking to clients and driving revenue instead of doing tedious data entry."),
    ("Female", "Wonderful. Now, in terms of timeline, when are you hoping to have a solution in place?"),
    ("Male", "We want this resolved before the start of next quarter, which is about a month away."),
    ("Female", "And is there a budget allocated specifically for this AI integration project?"),
    ("Male", "We have a sign-off threshold of up to $50,000 for this financial year if we can see a clear return on investment."),
    ("Female", "Excellent. I want to book a deep dive meeting for you with Anthony, our Lead AI Architect. He can walk you through the architecture of our local AI agent deployment. How does next Tuesday at 10:00 AM AEST look for you?"),
    ("Male", "That works perfectly for me. Let's schedule it."),
    ("Female", "Fantastic, I've booked that meeting and sent the invitation. I look forward to working with you, CJ.")
]

async def generate_chunk(voice, text, filepath):
    print(f"Synthesizing: {filepath.name}")
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(filepath))

async def main():
    print("[AXIOM] Initializing Dual-Channel Neural Audio Generator...")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    
    chunk_files = []
    
    # 1. Synthesize individual chunks
    for i, (gender, text) in enumerate(DIALOGUE):
        voice = VOICE_MALE if gender == "Male" else VOICE_FEMALE
        chunk_file = TEMP_DIR / f"{i:03d}_{gender}.mp3"
        await generate_chunk(voice, text, chunk_file)
        chunk_files.append(chunk_file)

    # 2. Build FFmpeg concat list
    concat_list = TEMP_DIR / "_concat_list.txt"
    with open(concat_list, "w", encoding="utf-8") as f:
        for chunk in chunk_files:
            path_str = str(chunk.resolve()).replace("\\", "/").replace("'", "'\\''")
            f.write(f"file '{path_str}'\n")

    # 3. Concatenate all chunks into raw wav
    raw_wav = TEMP_DIR / "raw_concat.wav"
    print("\n[AXIOM] Concatenating audio channels...")
    subprocess.run([
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
        "-c:a", "pcm_s16le", 
        str(raw_wav)
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # 4. Apply 7-Stage Broadcast Mastering Chain
    final_output = OUTPUT_DIR / "mock_sales_call.wav"
    print("\n[AXIOM] Applying 7-Stage Broadcast Mastering Chain...")
    
    filter_chain = (
        "highpass=f=80,"
        "equalizer=f=200:t=q:w=1.5:g=-3,"
        "equalizer=f=3000:t=q:w=1.5:g=2,"
        "equalizer=f=8000:t=q:w=2:g=1.5,"
        "acompressor=threshold=-15dB:ratio=4:attack=5:release=50,"
        "deesser=i=0.4:m=0.5:f=0.5,"
        "loudnorm=I=-16:TP=-1.5:LRA=11"
    )
    
    subprocess.run([
        "ffmpeg", "-y",
        "-i", str(raw_wav),
        "-af", filter_chain,
        "-ar", "48000",
        "-c:a", "pcm_s16le", 
        str(final_output)
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # 5. Cleanup
    print("\n[AXIOM] Cleaning up temporary chunks...")
    for f in TEMP_DIR.iterdir():
        f.unlink()
    TEMP_DIR.rmdir()
    
    print(f"\n[AXIOM] Success! Mastered audio saved to: {final_output}")

if __name__ == "__main__":
    asyncio.run(main())
