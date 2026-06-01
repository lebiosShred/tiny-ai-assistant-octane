import asyncio
import os
import subprocess
from pathlib import Path
import edge_tts

# ── Voice Configuration ──
# Albert (Sales)
VOICE_MALE = "en-US-GuyNeural"
# Sarah (Prospect) 
VOICE_FEMALE = "en-US-JennyNeural"

OUTPUT_DIR = Path(__file__).parent.parent / "demo" / "assets"
TEMP_DIR = OUTPUT_DIR / "temp_audio"

# Dialogue Data
DIALOGUE = [
    ("Male", "Hi Sarah, thank you for booking some time with us. I saw on the discovery form that you're currently leading the FP&A team at Meridian Logistics."),
    ("Female", "Yes, that's correct. We've been experiencing quite a bit of scale lately, and it's putting a lot of pressure on our finance team, especially during our monthly forecast close."),
    ("Male", "I saw you mentioned a bottleneck regarding NetSuite data consolidation in Excel. Can you elaborate on that?"),
    ("Female", "Sure. Our actuals reside in NetSuite, but all our planning models are housed in Excel. We have about 35 separate spreadsheets that get sent out to different department heads. When they come back, we have to manually extract the data and update our consolidation worksheets. It takes about 45 minutes per sheet, and with 35 sheets, it's easily several days of mind-numbing copy-pasting. It's incredibly prone to formula errors."),
    ("Male", "That's a classic bottleneck. It sounds like you're spending 80% of your time just moving data instead of analyzing it."),
    ("Female", "Exactly. We are using Power BI and PAX for some basic reporting, but they're fed from these manual Excel files."),
    ("Male", "If we could integrate your NetSuite actuals directly with a central IBM Planning Analytics database, and push that clean data straight to your Power BI reports in real time, what would that mean for your team?"),
    ("Female", "It would save us at least 3 days every month. My analysts could actually focus on tracking logistics variance instead of doing data entry."),
    ("Male", "Wonderful. Now, in terms of timeline, when are you hoping to have a solution in place?"),
    ("Female", "We want this resolved before the Q3 planning cycle, which starts in about two months."),
    ("Male", "And is there a budget allocated specifically for this integration project?"),
    ("Female", "We have a sign-off threshold of up to $40,000 for this financial year if we can show a clear return on investment."),
    ("Male", "Excellent. I want to book a deep dive meeting for you with System Administrator, our TM1 Practice Lead. He can walk you through the architecture of our DataFusion connector to NetSuite. Let me pull up his calendar. How does next Tuesday at 10:00 AM AEST look for you?"),
    ("Female", "That works perfectly for me. Let's schedule it."),
    ("Male", "Fantastic, I've booked that meeting and sent the invitation. I look forward to working with you, Sarah.")
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
