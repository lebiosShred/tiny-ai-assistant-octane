import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.goto('http://localhost:8080/demo/book.html')
        await page.wait_for_timeout(1000)
        
        # Select reason
        await page.select_option("#meeting-reason", label="Pre-Screen Discovery Call | 30 mins")
        await page.wait_for_timeout(500)
        
        # Check if button is disabled
        is_disabled = await page.evaluate("document.getElementById('btn-next-step').disabled")
        print(f"Is Next Button Disabled? {is_disabled}")
        
        # Try to click next
        btn = page.locator("#btn-next-step")
        box = await btn.bounding_box()
        print(f"Button Box: {box}")
        
        await btn.click()
        await page.wait_for_timeout(1000)
        
        # Check if calendar is visible
        calendar_display = await page.evaluate("document.getElementById('booking-step-calendar').style.display")
        print(f"Calendar display: {calendar_display}")
        
        await browser.close()

asyncio.run(main())
