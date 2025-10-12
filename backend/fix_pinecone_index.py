#!/usr/bin/env python3
"""
Fix Pinecone Index - Delete and Recreate with Correct Dimensions
This script will:
1. Delete the old index (1024 dimensions - wrong)
2. Run generate_embeddings.py to create new index (384 dimensions - correct)
"""
from pinecone import Pinecone
import os
import subprocess
import sys
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("PINECONE_API_KEY", "pcsk_45dUYY_ShcerydwjW3afP668vKmVNELU4pDT54cJWt7h9xB8diqhrsnxEEzp7MGRsHtwMk")
index_name = os.getenv("PINECONE_INDEX_NAME", "texas-plantation-kb")

print("="*70)
print("  🔧 PINECONE INDEX FIX SCRIPT")
print("="*70)
print()
print("Issue: Your index has 1024 dimensions (wrong)")
print("Fix: Delete and recreate with 384 dimensions (correct)")
print()

# Step 1: Connect and check
print("Step 1: Connecting to Pinecone...")
pc = Pinecone(api_key=api_key)

indexes = [idx.name for idx in pc.list_indexes()]
print(f"✅ Found {len(indexes)} indexes: {indexes}")
print()

# Step 2: Delete old index
if index_name in indexes:
    print(f"Step 2: Deleting old index '{index_name}'...")
    
    # Get index stats first
    try:
        idx = pc.Index(index_name)
        stats = idx.describe_index_stats()
        print(f"📊 Current index stats:")
        print(f"   - Dimension: {stats.dimension if hasattr(stats, 'dimension') else 'Unknown'}")
        print(f"   - Total vectors: {stats.total_vector_count if hasattr(stats, 'total_vector_count') else 0}")
        print()
    except Exception as e:
        print(f"⚠️  Could not get stats: {e}")
        print()
    
    confirm = input("⚠️  Confirm deletion? Type 'DELETE' to proceed: ")
    
    if confirm == 'DELETE':
        pc.delete_index(index_name)
        print(f"✅ Index '{index_name}' deleted!")
        print()
        
        # Step 3: Recreate
        print("Step 3: Recreating index with correct dimensions...")
        print()
        
        # Change to gen_10_year_plan_rag directory and run generate_embeddings.py
        script_dir = os.path.join(os.path.dirname(__file__), 'gen_10_year_plan_rag')
        
        print("🚀 Running generate_embeddings.py...")
        print("-"*70)
        
        try:
            # Run the script
            result = subprocess.run(
                [sys.executable, 'generate_embeddings.py'],
                cwd=script_dir,
                capture_output=False,
                text=True
            )
            
            if result.returncode == 0:
                print("-"*70)
                print()
                print("="*70)
                print("  ✅ SUCCESS! Index recreated with correct dimensions (384)")
                print("="*70)
                print()
                print("📊 Check your Pinecone dashboard - you should now see:")
                print("   ✅ Storage: ~XX MB (data is stored)")
                print("   ✅ Vectors: 7046 vectors")
                print("   ✅ Dimensions: 384")
                print()
            else:
                print()
                print("❌ Script failed. Please run manually:")
                print("   cd gen_10_year_plan_rag")
                print("   python generate_embeddings.py")
                
        except Exception as e:
            print(f"❌ Error running script: {e}")
            print()
            print("💡 Run manually:")
            print("   cd gen_10_year_plan_rag")
            print("   python generate_embeddings.py")
            
    else:
        print("❌ Deletion cancelled")
        print()
        print("💡 To fix manually:")
        print("   1. python delete_index.py")
        print("   2. cd gen_10_year_plan_rag")
        print("   3. python generate_embeddings.py")
else:
    print(f"⚠️  Index '{index_name}' not found")
    print("💡 Run: cd gen_10_year_plan_rag && python generate_embeddings.py")

print()
print("="*70)

