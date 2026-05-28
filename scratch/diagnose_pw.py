import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        
        # Listen to page errors
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
        # Listen to console logs/errors
        page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))
        
        print("Navigating to page...")
        await page.goto('http://localhost:8080/demo/book.html')
        await page.wait_for_timeout(1000)
        
        print("Selecting meeting reason...")
        await page.select_option("#meeting-reason", value="Pre-Screen Discovery Call | 30 mins")
        await page.wait_for_timeout(1000)
        
        # Check if button is disabled
        is_disabled = await page.evaluate("document.getElementById('btn-next-step').disabled")
        print(f"Is Next Button Disabled after selection? {is_disabled}")
        
        await browser.close()

asyncio.run(main())
