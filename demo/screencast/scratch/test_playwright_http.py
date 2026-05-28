import subprocess
import time
from playwright.sync_api import sync_playwright

server_process = subprocess.Popen(["python", "server.py"])
time.sleep(2)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    
    print("Loading http://localhost:5000/")
    page.goto("http://localhost:5000/")
    page.wait_for_selector("#prep-name", timeout=5000)
    
    page.evaluate('''() => {
        document.getElementById('prep-name').value = 'Kevin Smith';
        document.getElementById('prep-company').value = 'Meridian Logistics';
        document.getElementById('prep-title').value = 'Supply Chain Manager';
        document.getElementById('prep-email').value = 'kevin@meridian.com';
        document.getElementById('prep-phone').value = '1234567890';
        const form = document.getElementById('prep-form');
        console.log("Form checkValidity before click:", form.checkValidity());
        document.getElementById('prep-submit-btn').click();
    }''')
    
    try:
        page.wait_for_selector("#step-1-next-btn", state="visible", timeout=10000)
        print("Success! step-1-next-btn is visible.")
    except Exception as e:
        print(f"Failed to find step-1-next-btn: {e}")
        print("URL after timeout:", page.url)
    
    browser.close()

server_process.terminate()
