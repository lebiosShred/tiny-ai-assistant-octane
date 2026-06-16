import asyncio
import os
import subprocess
from pathlib import Path
import edge_tts

# ── Voice Configuration ──
# Isha (Sales Rep)
VOICE_FEMALE = "en-US-JennyNeural"
# Marcus (Prospect at Meridian Logistics)
VOICE_MALE = "en-US-GuyNeural"

OUTPUT_DIR = Path(__file__).parent.parent.parent / "Tiny AI Assistant" / "assets"
TEMP_DIR = OUTPUT_DIR / "temp_audio"

# Dialogue Data mapping exactly to the 12 Variant A questions
DIALOGUE = [
    ("Female", "Hi Marcus, thanks for hopping on the call today. I saw on your booking form that you're leading the FP&A team over at Meridian Logistics."),
    ("Male", "Hi Isha, good to be here. Yes, that's right. We've been scaling up fast, and honestly, the manual work is starting to break our finance processes."),
    ("Female", "I completely understand. That scale pressure is very common. To start off, what general ledger or ERP system are you currently running, and does it connect to any planning tools today?"),
    ("Male", "We run NetSuite as our core ERP. But it doesn't integrate with any planning tool at all. It's completely disconnected from our planning environment."),
    ("Female", "Ah, NetSuite. And since it's disconnected, how are you managing your budgeting and forecasting? How many separate manual spreadsheets are you consolidating?"),
    ("Male", "We do all our budgeting and forecasting in Excel. Right now, I'm manually consolidating about thirty-five separate spreadsheets from our department managers. We focus mostly on monthly OPEX forecasting and workforce payroll allocations."),
    ("Female", "Wow, thirty-five manual Excel spreadsheets. That sounds incredibly tedious. What dynamic reporting or BI tools do you use for management reporting, and do you need to drill down from high-level reports to transaction-level data?"),
    ("Male", "We do have Power BI for dashboards, and we use PAX for Excel reports, but they are all fed by manual files. And yes, absolutely, our executive team constantly asks to drill down from high-level summaries directly to NetSuite transaction-level details, which is a huge pain right now."),
    ("Female", "That makes total sense. Having to manually drill down is a massive bottleneck. Do you have any internal developers or admins to manage these planning systems, and how many planning contributors, read-only users, and admins are involved in the planning process?"),
    ("Male", "No, we don't have any dedicated internal admins or developers—our finance team has to manage it all. In terms of users, we have about thirty planning contributors submitting sheets, ten read-only executives, and just two of us trying to act as administrators."),
    ("Female", "I see. That's a lot of weight on just two people. Besides the spreadsheet consolidation, what repetitive financial tasks feel most manual to you?"),
    ("Male", "The worst part is manually extracting the NetSuite actuals every month, checking for formula errors, and copying them into our Excel templates. It takes about forty-five minutes per worksheet. It's easily several days of mind-numbing copy-pasting, and we're always worried a broken formula will slip through."),
    ("Female", "I hear you. That monthly copying of actuals is a recipe for burn-out. In terms of timing, what is your target timeline for going live, and is there an allocated budget for licensing and delivery this financial year?"),
    ("Male", "We want this live before the Q3 planning cycle, which starts in about two months. For budget, we have a sign-off threshold of up to forty-thousand dollars for this financial year, provided we see a clear return on investment."),
    ("Female", "Two months is a very achievable timeline for us. Have you evaluated other tools or platforms like Anaplan or Jedox, and what does success look like for this project? Would a sixty-day trial of our DataFusion connectors help validate the solution?"),
    ("Male", "We looked briefly at Anaplan, but the licensing costs were way out of our league, and Jedox felt too complex for our team. For us, success means automating that actuals transfer so we can close our forecast in hours instead of days. And yes, a sixty-day trial of your NetSuite connectors would be the perfect way to prove this works before we commit."),
    ("Female", "That's fantastic. I want to book a deep dive meeting for you with Amendra Pratap, our TM1 Practice Lead. He can walk you through the architecture of our DataFusion connector to NetSuite. How does next Tuesday at ten A.M. AEST look for you?"),
    ("Male", "That works perfectly for me. Let's schedule it."),
    ("Female", "Excellent, I've booked that meeting and sent the invitation. I look forward to working with you, Marcus.")
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
