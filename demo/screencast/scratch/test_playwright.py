from playwright.sync_api import sync_playwright
import os

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    # The file is in C:\Users\SkyDr\OneDrive\Desktop\PROJECTS\Anthony\demo\index.html
    # We are in C:\Users\SkyDr\OneDrive\Desktop\PROJECTS\Anthony\demo\screencast\scratch
    path = os.path.abspath('../../index.html').replace('\\', '/')
    url = f"file:///{path}"
    print(f"Loading {url}")
    page.goto(url)
    page.wait_for_selector("#prep-name", timeout=5000)
    
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    
    page.evaluate('''() => {
        document.getElementById('prep-name').value = 'Kevin Smith';
        document.getElementById('prep-company').value = 'Meridian Logistics';
        document.getElementById('prep-title').value = 'Supply Chain Manager';
        document.getElementById('prep-email').value = 'kevin@meridian.com';
        document.getElementById('prep-phone').value = '1234567890';
        const form = document.getElementById('prep-form');
        console.log("Form checkValidity before click:", form.checkValidity());
        if (!form.checkValidity()) {
            const invalid = form.querySelectorAll(':invalid');
            invalid.forEach(el => console.log("Invalid element:", el.id, el.validationMessage));
        }
        document.getElementById('prep-submit-btn').click();
    }''')
    
    try:
        page.wait_for_selector("#step-1-next-btn", state="visible", timeout=10000)
        print("Success! step-1-next-btn is visible.")
    except Exception as e:
        print(f"Failed to find step-1-next-btn: {e}")
        print("step1NextBtn display style:", page.evaluate("document.getElementById('step-1-next-btn').style.display"))
    
    browser.close()
