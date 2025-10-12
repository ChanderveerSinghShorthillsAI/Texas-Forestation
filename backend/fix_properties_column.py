#!/usr/bin/env python3
"""
Fix the properties column data type from TEXT to JSONB
This is required for PostgreSQL JSON operators to work correctly.
"""

import logging
import sys
import psycopg2
from postgres_config import get_connection, release_connection

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

def fix_properties_columns():
    """Alter properties columns from TEXT to JSONB"""
    conn = None
    try:
        logger.info("=" * 70)
        logger.info("🔧 Fixing PostgreSQL properties column data types")
        logger.info("=" * 70)
        
        conn = get_connection()
        cursor = conn.cursor()
        
        # Check current data types
        logger.info("\n📋 Checking current column types...")
        cursor.execute("""
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('polygon_features', 'point_features') 
            AND column_name = 'properties'
        """)
        
        for row in cursor.fetchall():
            logger.info(f"  {row[0]}.{row[1]}: {row[2]}")
        
        # Fix polygon_features.properties
        logger.info("\n🔄 Converting polygon_features.properties to JSONB...")
        cursor.execute("""
            ALTER TABLE polygon_features 
            ALTER COLUMN properties TYPE JSONB USING properties::jsonb
        """)
        conn.commit()
        logger.info("  ✅ polygon_features.properties converted to JSONB")
        
        # Fix point_features.properties
        logger.info("\n🔄 Converting point_features.properties to JSONB...")
        cursor.execute("""
            ALTER TABLE point_features 
            ALTER COLUMN properties TYPE JSONB USING properties::jsonb
        """)
        conn.commit()
        logger.info("  ✅ point_features.properties converted to JSONB")
        
        # Create indexes on commonly queried JSON fields
        logger.info("\n📊 Creating JSON indexes for performance...")
        
        # Index for county name queries
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_polygon_properties_name 
                ON polygon_features ((properties->>'Name'))
            """)
            conn.commit()
            logger.info("  ✅ Created index on polygon_features(properties->>'Name')")
        except Exception as e:
            logger.warning(f"  ⚠️ Could not create Name index: {e}")
            conn.rollback()
        
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_polygon_properties_countyname 
                ON polygon_features ((properties->>'Countyname'))
            """)
            conn.commit()
            logger.info("  ✅ Created index on polygon_features(properties->>'Countyname')")
        except Exception as e:
            logger.warning(f"  ⚠️ Could not create Countyname index: {e}")
            conn.rollback()
        
        # Verify the changes
        logger.info("\n✅ Verifying changes...")
        cursor.execute("""
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('polygon_features', 'point_features') 
            AND column_name = 'properties'
        """)
        
        for row in cursor.fetchall():
            logger.info(f"  {row[0]}.{row[1]}: {row[2]}")
        
        # Test JSON query
        logger.info("\n🧪 Testing JSON query...")
        cursor.execute("""
            SELECT COUNT(*) FROM polygon_features 
            WHERE layer_id = 'biomass-woodmill-residue-biomass' 
            AND properties->>'Name' IS NOT NULL
        """)
        count = cursor.fetchone()[0]
        logger.info(f"  ✅ Found {count} biomass features with Name property")
        
        cursor.close()
        
        logger.info("\n" + "=" * 70)
        logger.info("🎉 Successfully fixed properties column data types!")
        logger.info("=" * 70)
        logger.info("\n📝 Next step: Restart your application (python main.py)")
        
        return True
        
    except Exception as e:
        logger.error(f"\n❌ Error fixing properties columns: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if conn:
            release_connection(conn)

if __name__ == "__main__":
    success = fix_properties_columns()
    sys.exit(0 if success else 1)

