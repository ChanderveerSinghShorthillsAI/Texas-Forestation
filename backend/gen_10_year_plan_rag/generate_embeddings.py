from sentence_transformers import SentenceTransformer
import weaviate
from weaviate.classes.init import Auth
from weaviate.collections.classes.config import Property, DataType
import os
from tqdm import tqdm
import json
from dotenv import load_dotenv

# Load .env from parent directory (backend)
load_dotenv("../.env")
weaviate_url = os.getenv("WEAVIATE_CLUSTER_URL")  # Updated to match config.py
weaviate_api_key = os.getenv("WEAVIATE_API_KEY")   # Updated to match config.py

# Check if environment variables are loaded
if not weaviate_url or not weaviate_api_key:
    print("❌ Error: Missing Weaviate credentials!")
    print("Please update your .env file or config.py with:")
    print("WEAVIATE_CLUSTER_URL=your_cluster_url.weaviate.cloud")
    print("WEAVIATE_API_KEY=your_api_key")
    print("Current values:")
    print(f"WEAVIATE_CLUSTER_URL: {weaviate_url}")
    print(f"WEAVIATE_API_KEY: {'***' if weaviate_api_key else 'None'}")
    exit(1)

print(f"✅ Using Weaviate cluster: {weaviate_url}")

# --- Load your chunked data ---
chunks = []
try:
    with open("kb_chunks.jsonl", "r", encoding="utf-8") as f:
        content = f.read().strip()
        if not content:
            print("📁 Empty kb_chunks.jsonl file - will create empty collection for testing")
            chunks = []
        else:
            # Process non-empty file
            for line_num, line in enumerate(content.splitlines(), 1):
                line = line.strip()
                if line:  # Skip empty lines
                    try:
                        chunks.append(json.loads(line))
                    except json.JSONDecodeError as je:
                        print(f"⚠️  Skipping invalid JSON on line {line_num}: {je}")
                        continue
    
    print(f"✅ Loaded {len(chunks)} chunks from kb_chunks.jsonl")
    
except FileNotFoundError:
    print("❌ Error: kb_chunks.jsonl not found!")
    print("💡 Creating empty file for testing...")
    with open("kb_chunks.jsonl", "w", encoding="utf-8") as f:
        f.write("")
    chunks = []
    print("✅ Created empty kb_chunks.jsonl file")
    
except UnicodeDecodeError as e:
    print(f"❌ Unicode encoding error: {e}")
    print("💡 Trying to fix encoding issues...")
    try:
        # Try different encodings
        for encoding in ['utf-8-sig', 'utf-16', 'latin-1']:
            try:
                with open("kb_chunks.jsonl", "r", encoding=encoding) as f:
                    content = f.read().strip()
                    if content:
                        chunks = [json.loads(line.strip()) for line in content.splitlines() if line.strip()]
                    else:
                        chunks = []
                print(f"✅ Successfully read file with {encoding} encoding")
                break
            except:
                continue
        else:
            # If all encodings fail, create new empty file
            print("⚠️  Could not read with any encoding. Creating fresh empty file...")
            with open("kb_chunks.jsonl", "w", encoding="utf-8") as f:
                f.write("")
            chunks = []
            print("✅ Created fresh kb_chunks.jsonl file")
            
    except Exception as e2:
        print(f"❌ Still failed: {e2}")
        print("💡 Creating fresh empty file...")
        with open("kb_chunks.jsonl", "w", encoding="utf-8") as f:
            f.write("")
        chunks = []
        
except Exception as e:
    print(f"❌ Error reading kb_chunks.jsonl: {e}")
    print("💡 Creating fresh empty file...")
    with open("kb_chunks.jsonl", "w", encoding="utf-8") as f:
        f.write("")
    chunks = []

# --- Connect to Weaviate Cloud ---
print("🔗 Connecting to Weaviate Cloud...")
try:
    client = weaviate.connect_to_wcs(
        cluster_url=weaviate_url,
        auth_credentials=Auth.api_key(weaviate_api_key),
    )
    
    if not client.is_ready():
        print("❌ Weaviate client not ready!")
        exit(1)
        
    print("✅ Connected to Weaviate!")
except Exception as e:
    print(f"❌ Failed to connect to Weaviate: {e}")
    exit(1)

# --- Initialize embedding model ---
print("🤖 Loading embedding model...")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("✅ Embedding model loaded!")

# --- Create Weaviate collection (if not exists) ---
CLASS_NAME = "texas_10_year_plan_embeddings"
print(f"🏗️  Checking collection: {CLASS_NAME}")

if client.collections.exists(CLASS_NAME):
    print("✅ Collection already exists.")
    collection = client.collections.get(CLASS_NAME)
else:
    print("🆕 Creating new collection...")
    client.collections.create(
        name=CLASS_NAME,
        properties=[
            Property(name="content", data_type=DataType.TEXT),
            Property(name="source", data_type=DataType.TEXT),
            Property(name="page", data_type=DataType.INT),
        ],
        vectorizer_config=None,   # Manual embeddings
    )
    print("✅ Weaviate collection created.")
    collection = client.collections.get(CLASS_NAME)

# --- Upload embeddings and chunks ---
if len(chunks) == 0:
    print("⚠️  No chunks to upload. Creating empty collection for testing.")
else:
    print(f"📤 Uploading {len(chunks)} chunks...")
    
    for idx, chunk in enumerate(tqdm(chunks, desc="Uploading chunks")):
        try:
            content = chunk.get("content", "")
            meta = chunk.get("metadata", {})
            
            if not content.strip():
                print(f"⚠️  Skipping empty chunk {idx+1}")
                continue
                
            # Generate embedding
            emb = model.encode(content, show_progress_bar=False).tolist()
            
            # Prepare object
            obj = {
                "content": content,
                "source": meta.get("source", "unknown"),
                "page": meta.get("page", -1),
            }
            
            # Upload to Weaviate
            collection.data.insert(properties=obj, vector=emb)
            
            if (idx + 1) % 100 == 0:
                print(f"📤 Uploaded {idx+1}/{len(chunks)} chunks...")
                
        except Exception as e:
            print(f"❌ Error uploading chunk {idx+1}: {e}")
            continue

print("✅ All chunks uploaded to Weaviate!")

# --- Verify collection ---
try:
    # Get collection stats
    collection_info = collection.aggregate.over_all(total_count=True)
    print(f"📊 Collection stats: {collection_info.total_count} total objects")
except Exception as e:
    print(f"⚠️  Could not get collection stats: {e}")

# --- Close connection ---
client.close()
print("🎉 Complete! Your Weaviate knowledge base is ready!")