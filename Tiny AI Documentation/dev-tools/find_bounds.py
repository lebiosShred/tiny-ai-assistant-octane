import re

def get_bounds(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    def find_function_bounds(func_name):
        start = -1
        end = -1
        brace_count = 0
        in_func = False
        for i, line in enumerate(lines):
            if not in_func and func_name in line and "function" in line:
                start = i
                in_func = True
            
            if in_func:
                brace_count += line.count('{')
                brace_count -= line.count('}')
                if brace_count == 0 and '{' in ''.join(lines[start:i+1]):
                    end = i
                    return start + 1, end + 1
        return -1, -1

    targets = [
        "parseHubSpotBookingForm", 
        "handleLinkedinFile",
        "initializeSDRAlerts",
        "renderDirectoryList",
        "filterDirectory",
        "toggleDemoButtons"
    ]
    
    for t in targets:
        print(f"{t}: {find_function_bounds(t)}")

get_bounds('app.js')
