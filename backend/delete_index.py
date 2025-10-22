#!/usr/bin/env python3
"""
Quick script to delete the Pinecone index
Run this to delete the old index before recreating it
"""
from pinecone import Pinecone
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("PINECONE_API_KEY")
index_name = os.getenv("PINECONE_INDEX_NAME", "texas-plantation-kb")

if not api_key:
    print("❌ Error: PINECONE_API_KEY not found in environment variables!")
    print("💡 Please set PINECONE_API_KEY in your backend/.env file")
    exit(1)

print(f"🔗 Connecting to Pinecone...")
pc = Pinecone(api_key=api_key)

# List existing indexes
indexes = [idx.name for idx in pc.list_indexes()]
print(f"📊 Found {len(indexes)} indexes: {indexes}")

if index_name in indexes:
    confirm = input(f"\n⚠️  Delete index '{index_name}'? (yes/no): ")
    if confirm.lower() == 'yes':
        pc.delete_index(index_name)
        print(f"✅ Index '{index_name}' deleted successfully!")
        print("\n💡 Now run: python generate_embeddings.py")
    else:
        print("❌ Cancelled")
else:
    print(f"⚠️  Index '{index_name}' not found. Nothing to delete.")
    print("💡 Run: python generate_embeddings.py to create it")

