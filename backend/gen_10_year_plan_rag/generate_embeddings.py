# import json
# import time

# import weaviate
# from weaviate.classes.init import Auth


# # Connect to Weaviate
# client = weaviate.connect_to_weaviate_cloud(
#     cluster_url=WEAVIATE_URL,
#     auth_credentials=Auth.api_key(WEAVIATE_API_KEY),
# )

# collection = client.collections.get("vanrakshak")

# def gemini_embed(text):
#     import requests
#     url = "https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedText?key=" + GEMINI_API_KEY
#     body = {"text": text}
#     resp = requests.post(url, json=body)
#     print("API response:", resp.text)  # Print raw response
#     data = resp.json()
#     return data['embedding']


# # Read chunked data
# chunks = []
# with open("kb_chunks.jsonl", "r") as f:
#     for line in f:
#         chunk = json.loads(line)
#         # You may add chunk['metadata']['source'] and chunk['metadata']['page'] to properties as well
#         chunks.append(chunk)

# print(f"Loaded {len(chunks)} chunks.")

# for idx, chunk in enumerate(chunks, 1):
#     text = chunk["content"]
#     source = chunk["metadata"]["source"]
#     page = chunk["metadata"].get("page", -1)
#     chunk_id = idx

#     # --- Embedding ---
#     try:
#         embedding = gemini_embed(text)
#     except Exception as e:
#         print(f"Error embedding chunk {idx}: {e}")
#         continue

#     # --- Upload to Weaviate ---
#     try:
#         collection.data.insert(
#             properties={
#                 "content": text,
#                 "source": f"{source} (Page {page})",
#                 "chunk_id": chunk_id,
#             },
#             vector=embedding
#         )
#         print(f"[{idx}/{len(chunks)}] Uploaded: {source} (Page {page})")
#     except Exception as e:
#         print(f"Error inserting chunk {idx} ({source} Page {page}): {e}")

#     # (Optional) To avoid hitting rate limits
#     time.sleep(0.3)  # 300ms pause between calls

# print("Upload complete!")

from sentence_transformers import SentenceTransformer
import weaviate
from weaviate.classes.init import Auth
from weaviate.collections.classes.config import Property, DataType
import os
from tqdm import tqdm
import json
from dotenv import load_dotenv

load_dotenv()
weaviate_url = os.getenv("WEAVIATE_URL")
weaviate_api_key = os.getenv("WEAVIATE_API")


# --- Load your chunked data ---
with open("kb_chunks.jsonl", "r") as f:
    chunks = [json.loads(line) for line in f]

print(f"Loaded {len(chunks)} chunks.")

# --- Connect to Weaviate Cloud ---
client = weaviate.connect_to_weaviate_cloud(
    cluster_url=weaviate_url,
    auth_credentials=Auth.api_key(weaviate_api_key),
)

# --- Initialize embedding model ---
model = SentenceTransformer("all-MiniLM-L6-v2")

# --- Create Weaviate collection (if not exists) ---
CLASS_NAME = "texas_10_year_plan_embeddings"
if not client.collections.exists(CLASS_NAME):
    client.collections.create(
        name=CLASS_NAME,
        properties=[
            Property(name="content", data_type=DataType.TEXT),
            Property(name="source", data_type=DataType.TEXT),
            Property(name="page", data_type=DataType.INT),
        ],
        vectorizer_config=None,   # <--- This is the fix!
    )
    print("Weaviate collection created.")
else:
    print("Weaviate collection already exists.")

collection = client.collections.get(CLASS_NAME)

# --- Upload embeddings and chunks ---
for idx, chunk in enumerate(tqdm(chunks, desc="Uploading chunks")):
    content = chunk["content"]
    meta = chunk.get("metadata", {})
    emb = model.encode(content, show_progress_bar=False).tolist()
    obj = {
        "content": content,
        "source": meta.get("source", "unknown"),
        "page": meta.get("page", -1),
    }
    try:
        collection.data.insert(properties=obj, vector=emb)
        if (idx + 1) % 100 == 0 or (idx + 1) == len(chunks):
            print(f"Uploaded {idx+1}/{len(chunks)} chunks.")
    except Exception as e:
        print(f"Error uploading chunk {idx+1}: {e}")

client.close()
print("All chunks uploaded to Weaviate!")
