#!/usr/bin/env python3
"""
Database migration script to add checksum table to existing database
"""

import sqlite3
import sys
from datetime import datetime
from pathlib import Path
import hashlib

def migrate_database():
    """Add missing checksum table to existing database"""
    db_path = "spatial_data.db"
    
    if not Path(db_path).exists():
        print("❌ No database file found")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if checksum table already exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='database_checksum'")
        if cursor.fetchone():
            print("✅ Checksum table already exists")
            conn.close()
            return True
        
        # Create checksum table
        cursor.execute("""
            CREATE TABLE database_checksum (
                id INTEGER PRIMARY KEY,
                checksum TEXT,
                created_at TEXT
            )
        """)
        
        # Calculate checksum for current GeoJSON files
        geojson_dir = Path("../frontend/public/Texas_Geojsons")
        if geojson_dir.exists():
            checksum = calculate_directory_checksum(geojson_dir)
            cursor.execute("""
                INSERT INTO database_checksum (checksum, created_at)
                VALUES (?, ?)
            """, (checksum, datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
        
        print("✅ Database migration completed successfully")
        print("📋 Added checksum table")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

def calculate_directory_checksum(geojson_dir: Path) -> str:
    """Calculate checksum of all GeoJSON files in directory"""
    hash_md5 = hashlib.md5()
    
    geojson_files = sorted(geojson_dir.glob("*.geojson"))
    for geojson_file in geojson_files:
        # Include filename and modification time in checksum
        file_info = f"{geojson_file.name}:{geojson_file.stat().st_mtime}:{geojson_file.stat().st_size}"
        hash_md5.update(file_info.encode())
    
    return hash_md5.hexdigest()

if __name__ == "__main__":
    print("🔧 Migrating database...")
    success = migrate_database()
    
    if success:
        print("\n🚀 You can now start the server normally:")
        print("   python3 main.py")
    else:
        print("\n🔄 Migration failed. Try rebuilding:")
        print("   python3 main.py --rebuild-db") 