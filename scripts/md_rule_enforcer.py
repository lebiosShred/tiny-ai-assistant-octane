import os
import re
import sys
import json
import argparse

class MarkdownRuleEnforcer:
    def __init__(self, config_path, autofix=False):
        self.autofix = autofix
        self.violations = []
        
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
        except Exception as e:
            print(f"Error loading config {config_path}: {e}", file=sys.stderr)
            sys.exit(1)
            
        patterns = self.config.get("patterns", {})
        self.dash_pattern = re.compile(patterns.get("dash_forbidden", r'[\u2013\u2014]'))
        self.backtick_link_pattern = re.compile(patterns.get("backtick_link", r'\[`([^`\]]+)`\]\((file:///[^)]+)\)'))
        self.file_link_pattern = re.compile(patterns.get("file_link", r'\[([^\]]+)\]\((file:///([^)#\n]+))(#[^)]+)?\)'))
        self.max_bullet_length = self.config.get("max_bullet_point_length", 120)
        self.messages = self.config.get("messages", {})

    def audit_file(self, filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        lines = content.splitlines()
        modified = False
        new_lines = []

        for idx, line in enumerate(lines, start=1):
            line_modified = False

            # 1. Enforce em-dash suppression
            if self.dash_pattern.search(line):
                line = self.dash_pattern.sub('--', line)
                line_modified = True
                self.violations.append({
                    "file": filepath,
                    "line": idx,
                    "type": "EM_DASH",
                    "detail": self.messages.get("EM_DASH", "Em-dash detected.")
                })

            # 2. Enforce file link backtick removal
            if self.backtick_link_pattern.search(line):
                line = self.backtick_link_pattern.sub(r'[\1](\2)', line)
                line_modified = True
                self.violations.append({
                    "file": filepath,
                    "line": idx,
                    "type": "BACKTICK_LINK",
                    "detail": self.messages.get("BACKTICK_LINK", "Backticks stripped.")
                })

            # 3. Enforce file link basename readability
            matches = list(self.file_link_pattern.finditer(line))
            for match in matches:
                link_text = match.group(1)
                full_path = match.group(3)
                anchor = match.group(4) or ''
                basename = os.path.basename(full_path)
                
                if link_text != basename:
                    self.violations.append({
                        "file": filepath,
                        "line": idx,
                        "type": "LINK_BASENAME_MISMATCH",
                        "detail": self.messages.get("LINK_BASENAME_MISMATCH", "Basename mismatch.") + f" Found '{link_text}', expected '{basename}'."
                    })
                    if self.autofix:
                        old_link = match.group(0)
                        new_link = f"[{basename}](file:///{full_path}{anchor})"
                        line = line.replace(old_link, new_link)
                        line_modified = True

            # 4. Warn about overly long bullet point lines
            trimmed = line.strip()
            if (trimmed.startswith('-') or trimmed.startswith('*')) and len(line) > self.max_bullet_length:
                self.violations.append({
                    "file": filepath,
                    "line": idx,
                    "type": "LONG_BULLET_POINT",
                    "detail": self.messages.get("LONG_BULLET_POINT", "Length exceeded.") + f" ({len(line)} chars)"
                })

            if line_modified:
                modified = True

            new_lines.append(line)

        if modified and self.autofix:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write('\n'.join(new_lines) + '\n')
            return True
        return False

    def scan_directory(self, directory):
        for root, _, files in os.walk(directory):
            if any(part.startswith('.') for part in root.split(os.sep)):
                continue
            for file in files:
                if file.endswith('.md'):
                    filepath = os.path.join(root, file)
                    self.audit_file(filepath)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Enforce Gemini Markdown Style Guidelines.")
    parser.add_argument("path", help="Directory or file path to scan")
    parser.add_argument("--config", required=True, help="Path to rules.json config file")
    parser.add_argument("--fix", action="store_true", help="Automatically correct violations where possible")
    args = parser.parse_args()

    enforcer = MarkdownRuleEnforcer(config_path=args.config, autofix=args.fix)
    
    if os.path.isdir(args.path):
        enforcer.scan_directory(args.path)
    elif os.path.isfile(args.path):
        enforcer.audit_file(args.path)
    else:
        print(f"Error: Path '{args.path}' not found.", file=sys.stderr)
        sys.exit(1)

    if enforcer.violations:
        print(f"--- Markdown Style Guide Audit Results (Found {len(enforcer.violations)} issues) ---")
        for v in enforcer.violations:
            status = "[FIXED]" if (args.fix and v["type"] in ["EM_DASH", "BACKTICK_LINK", "LINK_BASENAME_MISMATCH"]) else "[VIOLATION]"
            print(f"{status} {v['file']}:{v['line']} -> {v['type']}: {v['detail']}")
        sys.exit(1)  # Exit with error code if violations are found (for CI/CD hooks)
    else:
        print("All analyzed markdown documents comply with the style guidelines.")
        sys.exit(0)
