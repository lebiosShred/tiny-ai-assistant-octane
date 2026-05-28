import asyncio
import json
import urllib.request
import websockets
import base64
from pathlib import Path

async def cdp(ws, method, params=None, msg_id=[0]):
    msg_id[0] += 1
    my_id = msg_id[0]
    await ws.send(json.dumps({"id": my_id, "method": method, "params": params or {}}))
    while True:
        resp = json.loads(await ws.recv())
        if resp.get("id") == my_id:
            if "error" in resp:
                print(f"Error in {method}: {resp['error']}")
            return resp.get("result", {})

async def get_cdp_ws_url():
    for port in [9222, 9223, 9224, 9225]:
        try:
            data = urllib.request.urlopen(f"http://localhost:{port}/json", timeout=2).read()
            pages = json.loads(data)
            for p in pages:
                print(f"Page found: Title: '{p.get('title')}', URL: '{p.get('url')}', Type: '{p.get('type')}', WS: {p.get('webSocketDebuggerUrl')}")
                if p.get("type") == "page":
                    return p["webSocketDebuggerUrl"]
        except Exception as e:
            print(f"Port {port} check failed: {e}")
            continue
    return None

async def main():
    ws_url = await get_cdp_ws_url()
    if not ws_url:
        print("Chrome is not running or CDP is not enabled.")
        return

    print(f"Connecting to: {ws_url}")
    async with websockets.connect(ws_url) as ws:
        # Navigate to book.html
        print("Navigating to book.html...")
        await cdp(ws, "Page.navigate", {"url": "http://localhost:8080/demo/book.html"})
        await asyncio.sleep(4)

        # Check DOM
        r_title = await cdp(ws, "Runtime.evaluate", {"expression": "document.title", "returnByValue": True})
        print("Title evaluated:", r_title.get("result", {}).get("value"))

        r_el = await cdp(ws, "Runtime.evaluate", {"expression": "document.querySelector('#meeting-reason') !== null", "returnByValue": True})
        print("Has #meeting-reason:", r_el.get("result", {}).get("value"))

        r_body = await cdp(ws, "Runtime.evaluate", {"expression": "document.body.innerHTML.substring(0, 500)", "returnByValue": True})
        print("Body preview:", r_body.get("result", {}).get("value"))

        # Take screenshot
        print("Taking screenshot...")
        r_snap = await cdp(ws, "Page.captureScreenshot", {})
        img_data = r_snap.get("data")
        if img_data:
            screenshot_path = Path(__file__).parent.parent / "diagnose_cdp_screenshot.png"
            with open(screenshot_path, "wb") as f:
                f.write(base64.b64decode(img_data))
            print(f"Screenshot saved to {screenshot_path}")
        else:
            print("Failed to capture screenshot.")

if __name__ == "__main__":
    asyncio.run(main())

if __name__ == "__main__":
    asyncio.run(main())
