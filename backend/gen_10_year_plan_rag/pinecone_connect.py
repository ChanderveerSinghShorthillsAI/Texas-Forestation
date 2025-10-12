from pinecone import Pinecone, ServerlessSpec
import os
from dotenv import load_dotenv

# Load .env from parent directory (backend)
load_dotenv("../.env")

pinecone_api_key = os.getenv("PINECONE_API_KEY")

if not pinecone_api_key:
    print("❌ Error: Missing Pinecone API key!")
    exit(1)

print(f"🔗 Connecting to Pinecone...")

# Initialize Pinecone client
pc = Pinecone(api_key=pinecone_api_key)

# Test connection by listing indexes
try:
    indexes = pc.list_indexes()
    print(f"✅ Connected to Pinecone!")
    print(f"📊 Available indexes: {[idx.name for idx in indexes]}")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    exit(1)

