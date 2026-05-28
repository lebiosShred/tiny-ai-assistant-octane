import re

def clean_app(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    def get_bounds(func_name, keyword="function"):
        start = -1
        end = -1
        brace_count = 0
        in_func = False
        for i, line in enumerate(lines):
            if not in_func and func_name in line and keyword in line:
                start = i
                in_func = True
            
            if in_func:
                brace_count += line.count('{')
                brace_count -= line.count('}')
                if brace_count == 0 and '{' in ''.join(lines[start:i+1]):
                    end = i
                    return start, end
        return -1, -1

    targets = [
        ("parseHubSpotBookingForm", "function"),
        ("handleLinkedinFile", "function"),
        ("initializeSDRAlerts", "function"),
        ("renderDirectoryList", "function"),
        ("toggleDemoButtons", "function"),
        ("prepParseBtn", "const"),
        ("generateReqEmailBtn", "const"),
        ("sendRescheduleEmailBtn", "const"),
        ("prepSampleBtn", "const"),
        ("synthSampleBtn", "const"),
        ("settingsDemoMode", "const"),
        ("directorySearch", "const"),
        ("directoryFilterRep", "const"),
        ("directoryRefreshBtn", "const"),
        ("linkedinDropZone", "const")
    ]
    
    skip_ranges = []
    
    for name, keyword in targets:
        s, e = get_bounds(name, keyword)
        if s != -1 and e != -1:
            skip_ranges.append((s, e))
            
    # Also manual removal for block around line 60-70 related to callDirectoryWorkspace
    # Let's just filter out specific lines
    
    new_lines = []
    for i, line in enumerate(lines):
        skip = False
        for s, e in skip_ranges:
            if s <= i <= e:
                skip = True
                break
        
        # Explicit line skips
        if "callDirectoryWorkspace" in line: skip = True
        if "navDirectory" in line: skip = True
        if "toggleDemoButtons" in line: skip = True
        if "parseHubSpotBookingForm" in line: skip = True
        if "handleLinkedinFile" in line: skip = True
        if "initializeSDRAlerts" in line: skip = True
        if "renderDirectoryList" in line: skip = True
        if "linkedinDropZone" in line: skip = True
        
        if not skip:
            new_lines.append(line)
            
    with open("app_clean.js", 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
        
    print(f"Skipped {len(lines) - len(new_lines)} lines.")

clean_app('app.js')
