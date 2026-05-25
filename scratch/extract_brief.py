import fitz # PyMuPDF
import os

pdf_path = r"C:\Users\SkyDr\Downloads\sales_process_technical_brief.pdf"
output_path = r"c:\Users\SkyDr\OneDrive\Desktop\PROJECTS\Anthony\scratch\technical_brief_text.txt"

if not os.path.exists(pdf_path):
    print(f"Error: PDF not found at {pdf_path}")
    exit(1)

doc = fitz.open(pdf_path)
text_content = []

for i, page in enumerate(doc):
    page_text = page.get_text()
    text_content.append(f"--- PAGE {i + 1} ---")
    text_content.append(page_text)

with open(output_path, "w", encoding="utf-8") as f:
    f.write("\n".join(text_content))

print(f"Successfully extracted {doc.page_count} pages of text to {output_path}")
