import os
import pandas as pd
import fitz  # PyMuPDF
import json

knowledge_chunks = []

# --------- Extract from PDFs -----------
def extract_pdf_chunks(pdf_path):
    doc = fitz.open(pdf_path)
    chunks = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text().strip()
        if text:
            # Break page into paragraphs for better searchability
            for para in text.split('\n\n'):
                para = para.strip()
                # if len(para) > 100:  # Only meaningful chunks
                chunks.append({
                    "content": para,
                    "metadata": {
                        "source": os.path.basename(pdf_path),
                        "page": page_num + 1
                    }
                })
    return chunks

# ---------- Progress for PDFs ----------
pdf_dir = "../rag_texas_knowledge_base_detailed"
pdf_files = [f for f in os.listdir(pdf_dir) if f.endswith(".pdf")]
total_pdfs = len(pdf_files)

print(f"\nTotal PDF files found: {total_pdfs}\n")

for i, pdf_file in enumerate(pdf_files, 1):
    path = os.path.join(pdf_dir, pdf_file)
    print(f"[{i}/{total_pdfs}] Processing PDF: {pdf_file} ...", end="")
    try:
        chunks = extract_pdf_chunks(path)
        knowledge_chunks.extend(chunks)
        print(f" ✔️ {len(chunks)} chunks extracted.")
    except Exception as e:
        print(f" ❌ Error: {e}")

print(f"All PDFs processed. Total PDF chunks: {len(knowledge_chunks)}\n")

# --------- Extract from CSVs (NO CSVs DAtA IS PRESENT FOR texas ) -----------
# csv_dir = "../knowledge_csvs/"
# csv_files = [f for f in os.listdir(csv_dir) if f.endswith(".csv")]
# total_csvs = len(csv_files)

# print(f"\nTotal CSV files found: {total_csvs}\n")

# csv_chunk_count = 0
# for i, csv_file in enumerate(csv_files, 1):
#     path = os.path.join(csv_dir, csv_file)
#     print(f"[{i}/{total_csvs}] Processing CSV: {csv_file} ...", end="")
#     try:
#         df = pd.read_csv(path)
#         before = len(knowledge_chunks)
#         for idx, row in df.iterrows():
#             row_text = " | ".join(f"{col}: {val}" for col, val in row.items())
#             knowledge_chunks.append({
#                 "content": row_text,
#                 "metadata": {
#                     "source": csv_file,
#                     "row": int(idx) + 1
#                 }
#             })
#         added = len(knowledge_chunks) - before
#         csv_chunk_count += added
#         print(f" ✔️ {added} rows added.")
#     except Exception as e:
#         print(f" ❌ Error: {e}")

# print(f"All CSVs processed. Total CSV chunks: {csv_chunk_count}\n")

# --------- Save as JSONL -----------
with open("kb_chunks.jsonl", "w", encoding="utf-8") as f:
    for doc in knowledge_chunks:
        f.write(json.dumps(doc, ensure_ascii=False) + "\n")

print(f"\n==== PROCESS COMPLETE ====")
print(f"Total knowledge chunks extracted: {len(knowledge_chunks)}")
print(f"JSONL file written: kb_chunks.jsonl\n")
