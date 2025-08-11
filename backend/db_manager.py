#!/usr/bin/env python3
"""
Database Management Utility for Texas Spatial Query Service
"""

import os
import sys
import argparse
import sqlite3
from pathlib import Path
from datetime import datetime

def get_db_info():
    """Get information about the current database"""
    db_path = "spatial_data.db"
    
    if not os.path.exists(db_path):
        print("❌ No database file found")
        return
    
    file_size = os.path.getsize(db_path) / (1024 * 1024)  # MB
    modified_time = datetime.fromtimestamp(os.path.getmtime(db_path))
    
    print(f"📄 Database file: {db_path}")
    print(f"💾 Size: {file_size:.1f} MB")
    print(f"🕒 Last modified: {modified_time}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get layer count
        cursor.execute("SELECT COUNT(*) FROM layer_metadata")
        layer_count = cursor.fetchone()[0]
        
        # Get feature counts
        cursor.execute("SELECT COUNT(*) FROM polygon_features")
        polygon_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM point_features")
        point_count = cursor.fetchone()[0]
        
        # Get checksum info
        cursor.execute("SELECT checksum, created_at FROM database_checksum LIMIT 1")
        checksum_info = cursor.fetchone()
        
        print(f"📊 Layers: {layer_count}")
        print(f"🔺 Polygon features: {polygon_count:,}")
        print(f"📍 Point features: {point_count:,}")
        
        if checksum_info:
            print(f"🔐 Checksum: {checksum_info[0][:8]}...")
            print(f"📅 Created: {checksum_info[1]}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error reading database: {e}")

def delete_database():
    """Delete the database file"""
    db_path = "spatial_data.db"
    
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"🗑️ Deleted database: {db_path}")
    else:
        print("❌ No database file to delete")

def main():
    parser = argparse.ArgumentParser(description='Database Management Utility')
    parser.add_argument('--info', action='store_true', help='Show database information')
    parser.add_argument('--delete', action='store_true', help='Delete database file')
    
    args = parser.parse_args()
    
    if args.info:
        get_db_info()
    elif args.delete:
        confirm = input("Are you sure you want to delete the database? (y/N): ")
        if confirm.lower() == 'y':
            delete_database()
        else:
            print("❌ Operation cancelled")
    else:
        parser.print_help()

if __name__ == "__main__":
    main() 