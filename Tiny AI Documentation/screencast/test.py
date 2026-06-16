import asyncio
import edge_tts

async def main():
    communicate = edge_tts.Communicate("Hello world, this is a test.", "en-US-AndrewNeural")
    submaker = edge_tts.SubMaker()
    
    async for chunk in communicate.stream():
        print(chunk["type"])
        if chunk["type"] == "WordBoundary":
            submaker.feed(chunk)
            
    print("SRT:", repr(submaker.get_srt()))
    print("Cues:", len(submaker.cues))

asyncio.run(main())
