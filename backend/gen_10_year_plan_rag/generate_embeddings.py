from pinecone import Pinecone, ServerlessSpec
from sentence_transformers import SentenceTransformer
import os
from tqdm import tqdm
import json
from dotenv import load_dotenv

# Load .env from parent directory (backend)
load_dotenv("../.env")
pinecone_api_key = os.getenv("PINECONE_API_KEY")
pinecone_environment = os.getenv("PINECONE_ENVIRONMENT", "us-east-1")
pinecone_cloud = os.getenv("PINECONE_CLOUD", "aws")
index_name = os.getenv("PINECONE_INDEX_NAME", "texas-plantation-kb")
embed_model = os.getenv("PINECONE_EMBED_MODEL", "llama-text-embed-v2")
namespace = os.getenv("PINECONE_NAMESPACE", "texas-kb")

# Check if environment variables are loaded
if not pinecone_api_key:
    print("❌ Error: Missing Pinecone API key!")
    print("Please update your .env file or config.py with:")
    print("PINECONE_API_KEY=your_api_key")
    exit(1)

print(f"✅ Using Pinecone API key: {'***' + pinecone_api_key[-8:] if pinecone_api_key else 'None'}")

# --- Load your chunked data ---
chunks = []
try:
    with open("kb_chunks.jsonl", "r", encoding="utf-8") as f:
        content = f.read().strip()
        if not content:
            print("📁 Empty kb_chunks.jsonl file - will create empty index for testing")
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

# --- Connect to Pinecone ---
print("🔗 Connecting to Pinecone...")
try:
    pc = Pinecone(api_key=pinecone_api_key)
    print("✅ Connected to Pinecone!")
except Exception as e:
    print(f"❌ Failed to connect to Pinecone: {e}")
    exit(1)

# --- Initialize embedding model ---
print("🤖 Loading embedding model (all-MiniLM-L6-v2)...")
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
embedding_dim = 384  # all-MiniLM-L6-v2 produces 384-dim embeddings
print(f"✅ Embedding model loaded! Dimension: {embedding_dim}")

# --- Create index if not exists ---
print(f"🏗️  Checking index: {index_name}")

existing_indexes = [idx.name for idx in pc.list_indexes()]

if index_name not in existing_indexes:
    print(f"🆕 Creating new serverless index...")
    try:
        pc.create_index(
            name=index_name,
            dimension=embedding_dim,  # 384 for all-MiniLM-L6-v2
            metric="cosine",
            spec=ServerlessSpec(
                cloud=pinecone_cloud,
                region=pinecone_environment
            )
        )
        print("✅ Pinecone serverless index created.")
    except Exception as e:
        print(f"❌ Failed to create index: {e}")
        exit(1)
else:
    print("✅ Index already exists.")

# Get the index
index = pc.Index(index_name)

# --- Upload chunks to Pinecone ---
if len(chunks) == 0:
    print("⚠️  No chunks to upload. Index ready for future use.")
else:
    print(f"📤 Uploading {len(chunks)} chunks to namespace '{namespace}'...")
    
    # Prepare vectors for upsert
    vectors_to_upsert = []
    for idx, chunk in enumerate(tqdm(chunks, desc="Generating embeddings")):
        try:
            content = chunk.get("content", "")
            meta = chunk.get("metadata", {})
            
            if not content.strip():
                continue
            
            # Generate embedding using SentenceTransformer
            embedding = embedding_model.encode(content).tolist()
            
            # Prepare vector in Pinecone format: (id, vector, metadata)
            vector_data = (
                f"chunk_{idx}",  # id
                embedding,  # vector
                {
                    "content": content,
                    "source": meta.get("source", "unknown"),
                    "page": meta.get("page", -1)
                }  # metadata
            )
            
            vectors_to_upsert.append(vector_data)
            
        except Exception as e:
            print(f"❌ Error preparing chunk {idx+1}: {e}")
            continue
    
    # Upsert vectors in batches
    batch_size = 100
    total_batches = (len(vectors_to_upsert) - 1) // batch_size + 1
    
    for i in range(0, len(vectors_to_upsert), batch_size):
        batch = vectors_to_upsert[i:i+batch_size]
        try:
            index.upsert(vectors=batch, namespace=namespace)
            print(f"📤 Uploaded batch {i//batch_size + 1}/{total_batches}")
        except Exception as e:
            print(f"❌ Error uploading batch: {e}")
            continue
    
    print("✅ All chunks uploaded to Pinecone!")

# --- Verify index ---
try:
    stats = index.describe_index_stats()
    print(f"📊 Index stats: {stats}")
except Exception as e:
    print(f"⚠️  Could not get index stats: {e}")

print("🎉 Complete! Your Pinecone knowledge base is ready!")
