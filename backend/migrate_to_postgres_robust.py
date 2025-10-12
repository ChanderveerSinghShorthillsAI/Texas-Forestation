"""
SQLite to PostgreSQL Migration Script (Robust Version)
======================================================

This script handles connection timeouts, can resume interrupted migrations,
and includes connection keep-alive mechanisms.

Features:
- Automatic connection recovery
- Resume from interrupted migration
- Connection keep-alive
- Progress tracking and save points
"""

import sqlite3
import psycopg2
from psycopg2 import sql, extras
import logging
import sys
import os
import json
from typing import List, Dict, Any, Tuple
from datetime import datetime
import time

from postgres_config import get_connection_params

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False
    print("⚠️ Install tqdm for progress bars: pip install tqdm")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

PROGRESS_FILE = "migration_progress.json"


class RobustDatabaseMigrator:
    """Migration with connection recovery and resume capability"""
    
    def __init__(self):
        self.pg_conn = None
        self.sqlite_dbs = {
            'spatial_data.db': [
                'layer_metadata',      # Small table first
                'users',               # Small table
                'county_carbon',       # Medium table
                'point_features',      # Large table
                'polygon_features',    # Very large table
            ],
            'texas_chatbot.db': [
                'chat_sessions',
                'chat_cache',
                'confidential_queries',
                'chat_messages',
            ],
            'texas_grid_fire.db': [
                'grid_fire_risk'
            ]
        }
        self.batch_size = 500  # Smaller batches for better control
        self.progress = self.load_progress()
        
    def load_progress(self):
        """Load progress from previous run"""
        if os.path.exists(PROGRESS_FILE):
            try:
                with open(PROGRESS_FILE, 'r') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def save_progress(self, table_name, rows_migrated):
        """Save current progress"""
        self.progress[table_name] = {
            'rows': rows_migrated,
            'timestamp': datetime.now().isoformat()
        }
        with open(PROGRESS_FILE, 'w') as f:
            json.dump(self.progress, f, indent=2)
    
    def connect_postgres(self, retry=3):
        """Connect to PostgreSQL with retry logic"""
        for attempt in range(retry):
            try:
                logger.info(f"🔌 Connecting to PostgreSQL (attempt {attempt + 1}/{retry})...")
                
                # Add keepalive parameters
                params = get_connection_params()
                self.pg_conn = psycopg2.connect(
                    **params,
                    keepalives=1,
                    keepalives_idle=30,
                    keepalives_interval=10,
                    keepalives_count=5,
                    connect_timeout=10
                )
                self.pg_conn.autocommit = False
                
                # Test connection
                cursor = self.pg_conn.cursor()
                cursor.execute("SELECT 1")
                cursor.close()
                
                logger.info("✅ Connected to PostgreSQL database")
                return True
            except Exception as e:
                logger.error(f"❌ Connection attempt {attempt + 1} failed: {e}")
                if attempt < retry - 1:
                    time.sleep(5)
                else:
                    return False
        return False
    
    def ensure_connection(self):
        """Ensure PostgreSQL connection is alive"""
        try:
            cursor = self.pg_conn.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            return True
        except:
            logger.warning("⚠️ Connection lost, reconnecting...")
            return self.connect_postgres()
    
    def create_postgres_tables_simple(self):
        """Create tables one at a time with progress indication"""
        try:
            if not self.ensure_connection():
                return False
            
            cursor = self.pg_conn.cursor()
            
            logger.info("\n📋 Creating database tables...")
            logger.info("=" * 60)
            
            tables_created = 0
            
            # Define minimal table creation (without indexes first)
            tables = {
                'polygon_features': "CREATE TABLE IF NOT EXISTS polygon_features (id SERIAL PRIMARY KEY, layer_id TEXT, layer_name TEXT, properties TEXT, geometry_wkt TEXT, min_lon REAL, min_lat REAL, max_lon REAL, max_lat REAL)",
                'point_features': "CREATE TABLE IF NOT EXISTS point_features (id SERIAL PRIMARY KEY, layer_id TEXT, layer_name TEXT, properties TEXT, longitude REAL, latitude REAL)",
                'layer_metadata': "CREATE TABLE IF NOT EXISTS layer_metadata (layer_id TEXT PRIMARY KEY, layer_name TEXT, layer_type TEXT, feature_count INTEGER, file_size_mb REAL, bounds_json TEXT)",
                'users': "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE, password_hash VARCHAR(256), salt VARCHAR(64), is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_login TIMESTAMP, login_count INTEGER DEFAULT 0, failed_login_attempts INTEGER DEFAULT 0, last_failed_login TIMESTAMP, password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
                'county_carbon': "CREATE TABLE IF NOT EXISTS county_carbon (county_name TEXT PRIMARY KEY, county_fips TEXT, total_carbon_tons REAL, total_co2_equivalent_tons REAL, biomass_carbon_tons REAL, soil_carbon_potential_tons REAL, wetland_carbon_potential_tons REAL, wood_biomass_tons REAL, crop_residue_tons REAL, secondary_residue_tons REAL, wetland_acres REAL, calculation_timestamp TEXT)",
                'chat_sessions': "CREATE TABLE IF NOT EXISTS chat_sessions (id VARCHAR(50) PRIMARY KEY, session_id VARCHAR(100) UNIQUE, user_ip VARCHAR(50), user_agent VARCHAR(500), started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_active BOOLEAN DEFAULT TRUE, message_count INTEGER DEFAULT 0, total_tokens_used INTEGER DEFAULT 0)",
                'chat_messages': "CREATE TABLE IF NOT EXISTS chat_messages (id SERIAL PRIMARY KEY, session_id VARCHAR(50), role VARCHAR(20), content TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, tokens_used INTEGER DEFAULT 0, response_time_ms REAL, was_cached BOOLEAN DEFAULT FALSE, is_confidential BOOLEAN DEFAULT FALSE, user_query_hash VARCHAR(64), confidence_score REAL, sources_count INTEGER DEFAULT 0)",
                'chat_cache': "CREATE TABLE IF NOT EXISTS chat_cache (id SERIAL PRIMARY KEY, query_hash VARCHAR(64), session_id VARCHAR(100), query_text TEXT, response_text TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP, access_count INTEGER DEFAULT 1, ttl_hours INTEGER DEFAULT 24, is_active BOOLEAN DEFAULT TRUE, original_response_time_ms REAL, sources_count INTEGER DEFAULT 0)",
                'confidential_queries': "CREATE TABLE IF NOT EXISTS confidential_queries (id SERIAL PRIMARY KEY, session_id VARCHAR(50), query_text TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, user_ip VARCHAR(50))",
                'grid_fire_risk': "CREATE TABLE IF NOT EXISTS grid_fire_risk (grid_index INTEGER PRIMARY KEY, lat REAL, lng REAL, fire_risk_score REAL, risk_category TEXT, risk_color TEXT, max_risk_24h REAL, avg_risk_24h REAL, forecast_timestamp TEXT, weather_data TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
            }
            
            for table_name, create_sql in tables.items():
                logger.info(f"  → {table_name}...")
                cursor.execute(create_sql)
                self.pg_conn.commit()
                tables_created += 1
            
            logger.info(f"✅ Created {tables_created} tables")
            logger.info("=" * 60)
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to create tables: {e}")
            self.pg_conn.rollback()
            return False
    
    def migrate_table_chunked(self, sqlite_db: str, table_name: str) -> Tuple[bool, int]:
        """
        Migrate table in small chunks with connection recovery
        """
        try:
            # Check if already completed
            if table_name in self.progress:
                logger.info(f"✓ {table_name} already migrated ({self.progress[table_name]['rows']:,} rows)")
                return True, self.progress[table_name]['rows']
            
            # Check if SQLite database exists
            if not os.path.exists(sqlite_db):
                logger.info(f"ℹ️ {sqlite_db} not found, skipping")
                return True, 0
            
            # Connect to SQLite
            sqlite_conn = sqlite3.connect(sqlite_db)
            sqlite_conn.row_factory = sqlite3.Row
            sqlite_cursor = sqlite_conn.cursor()
            
            # Check if table exists
            sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
            if not sqlite_cursor.fetchone():
                logger.info(f"ℹ️ {table_name} not found in {sqlite_db}")
                sqlite_conn.close()
                return True, 0
            
            # Count rows
            sqlite_cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            total_rows = sqlite_cursor.fetchone()[0]
            
            if total_rows == 0:
                logger.info(f"ℹ️ {table_name} is empty")
                sqlite_conn.close()
                self.save_progress(table_name, 0)
                return True, 0
            
            # Get columns
            sqlite_cursor.execute(f"SELECT * FROM {table_name} LIMIT 1")
            columns = [desc[0] for desc in sqlite_cursor.description]
            
            logger.info(f"\n📥 Migrating {table_name} ({total_rows:,} rows)")
            
            # Ensure connection
            if not self.ensure_connection():
                logger.error("❌ Cannot establish PostgreSQL connection")
                return False, 0
            
            pg_cursor = self.pg_conn.cursor()
            
            # Clear existing data
            pg_cursor.execute(f"DELETE FROM {table_name}")
            self.pg_conn.commit()
            
            # Prepare insert
            placeholders = ', '.join(['%s'] * len(columns))
            columns_str = ', '.join(columns)
            insert_query = f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})"
            
            # Migrate in chunks
            rows_migrated = 0
            chunk_size = self.batch_size
            offset = 0
            
            if HAS_TQDM:
                pbar = tqdm(total=total_rows, desc=f"  {table_name}", unit=" rows")
            
            start_time = time.time()
            last_commit_time = start_time
            
            while offset < total_rows:
                # Ensure connection every 30 seconds
                current_time = time.time()
                if current_time - last_commit_time > 30:
                    if not self.ensure_connection():
                        logger.error("❌ Lost connection, stopping migration")
                        break
                    pg_cursor = self.pg_conn.cursor()
                    last_commit_time = current_time
                
                # Fetch chunk
                sqlite_cursor.execute(f"SELECT * FROM {table_name} LIMIT {chunk_size} OFFSET {offset}")
                rows = sqlite_cursor.fetchall()
                
                if not rows:
                    break
                
                # Insert chunk
                batch = [tuple(row[col] for col in columns) for row in rows]
                
                try:
                    extras.execute_batch(pg_cursor, insert_query, batch, page_size=100)
                    self.pg_conn.commit()
                    
                    rows_migrated += len(batch)
                    offset += chunk_size
                    
                    if HAS_TQDM:
                        pbar.update(len(batch))
                    
                    # Save progress every 5000 rows
                    if rows_migrated % 5000 == 0:
                        self.save_progress(table_name, rows_migrated)
                    
                except Exception as e:
                    logger.warning(f"⚠️ Batch failed at offset {offset}: {e}")
                    # Try reconnecting
                    if not self.ensure_connection():
                        logger.error("❌ Cannot recover connection")
                        break
                    pg_cursor = self.pg_conn.cursor()
                    # Skip this batch and continue
                    offset += chunk_size
            
            if HAS_TQDM:
                pbar.close()
            
            elapsed = time.time() - start_time
            logger.info(f"  ✅ Migrated {rows_migrated:,}/{total_rows:,} rows in {elapsed:.1f}s ({rows_migrated/elapsed:.0f} rows/s)")
            
            sqlite_conn.close()
            self.save_progress(table_name, rows_migrated)
            
            return True, rows_migrated
            
        except Exception as e:
            logger.error(f"❌ Failed to migrate {table_name}: {e}")
            return False, 0
    
    def migrate_all(self):
        """Migrate all databases"""
        logger.info("\n" + "=" * 70)
        logger.info("🚀 Starting Robust SQLite to PostgreSQL Migration")
        logger.info("=" * 70)
        
        if not self.connect_postgres():
            logger.error("❌ Cannot connect to PostgreSQL")
            return False
        
        if not self.create_postgres_tables_simple():
            logger.error("❌ Cannot create tables")
            return False
        
        total_rows = 0
        total_tables = 0
        
        start_time = time.time()
        
        for db_file, tables in self.sqlite_dbs.items():
            logger.info(f"\n📦 Database: {db_file}")
            logger.info("-" * 70)
            
            for table in tables:
                success, rows = self.migrate_table_chunked(db_file, table)
                if success:
                    total_rows += rows
                    total_tables += 1
        
        elapsed = time.time() - start_time
        
        logger.info("\n" + "=" * 70)
        logger.info("📊 Migration Summary")
        logger.info("=" * 70)
        logger.info(f"✅ Tables: {total_tables}")
        logger.info(f"📈 Rows: {total_rows:,}")
        logger.info(f"⏱️ Time: {elapsed/60:.1f} minutes")
        logger.info(f"🚀 Speed: {total_rows/elapsed:.0f} rows/s")
        logger.info("=" * 70)
        
        # Clean up progress file
        if os.path.exists(PROGRESS_FILE):
            os.remove(PROGRESS_FILE)
            logger.info("🧹 Cleaned up progress file")
        
        return True
    
    def close(self):
        """Close connection"""
        if self.pg_conn:
            try:
                self.pg_conn.close()
            except:
                pass


def main():
    """Main function"""
    
    if not HAS_TQDM:
        print("\n💡 For progress bars: pip install tqdm\n")
        time.sleep(1)
    
    migrator = RobustDatabaseMigrator()
    
    try:
        success = migrator.migrate_all()
        
        if success:
            logger.info("\n🎉 Migration completed!")
            logger.info("\n📝 Next steps:")
            logger.info("   1. Run: python verify_postgres_migration.py")
            logger.info("   2. Start: python main.py")
            return 0
        else:
            logger.error("\n❌ Migration incomplete")
            logger.info("💡 You can re-run this script to resume")
            return 1
            
    except KeyboardInterrupt:
        logger.warning("\n⚠️ Interrupted - progress saved")
        logger.info("💡 Re-run to resume from where you left off")
        return 1
    except Exception as e:
        logger.error(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        migrator.close()


if __name__ == "__main__":
    sys.exit(main())

