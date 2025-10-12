"""
PostgreSQL Migration Verification Script
=========================================

This script verifies that all data has been successfully migrated
from SQLite to PostgreSQL and that all tables are accessible.
"""

import logging
from postgres_config import get_connection, release_connection

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def verify_table(conn, table_name, expected_min_rows=0):
    """
    Verify a table exists and has data
    
    Args:
        conn: PostgreSQL connection
        table_name: Name of table to verify
        expected_min_rows: Minimum expected number of rows
        
    Returns:
        Tuple of (success: bool, row_count: int)
    """
    try:
        cursor = conn.cursor()
        
        # Check if table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = %s
            )
        """, (table_name,))
        
        exists = cursor.fetchone()[0]
        if not exists:
            logger.error(f"❌ Table {table_name} does not exist")
            return False, 0
        
        # Count rows
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cursor.fetchone()[0]
        
        if count >= expected_min_rows:
            logger.info(f"✅ {table_name}: {count} rows (≥ {expected_min_rows} expected)")
            return True, count
        else:
            logger.warning(f"⚠️ {table_name}: {count} rows (< {expected_min_rows} expected)")
            return False, count
            
    except Exception as e:
        logger.error(f"❌ Error verifying {table_name}: {e}")
        return False, 0


def verify_migration():
    """Verify the complete migration"""
    logger.info("=" * 70)
    logger.info("🔍 PostgreSQL Migration Verification")
    logger.info("=" * 70)
    
    try:
        conn = get_connection()
        logger.info("✅ Successfully connected to PostgreSQL")
        
        # Define tables to verify with expected minimum row counts
        tables_to_verify = {
            # Spatial data tables
            'polygon_features': 100,  # Should have many polygon features
            'point_features': 10,      # Should have some point features
            'layer_metadata': 5,       # Should have multiple layers
            
            # User authentication
            'users': 0,                # May or may not have users
            
            # Carbon estimation
            'county_carbon': 200,      # Should have data for most Texas counties
            
            # Chatbot tables
            'chat_sessions': 0,        # May be empty initially
            'chat_messages': 0,        # May be empty initially
            'chat_cache': 0,           # May be empty initially
            'confidential_queries': 0, # May be empty initially
            
            # Grid fire risk
            'grid_fire_risk': 0        # May be empty initially
        }
        
        logger.info("\n📋 Verifying Tables")
        logger.info("-" * 70)
        
        results = {}
        for table, min_rows in tables_to_verify.items():
            success, count = verify_table(conn, table, min_rows)
            results[table] = (success, count)
        
        # Summary
        logger.info("\n" + "=" * 70)
        logger.info("📊 Verification Summary")
        logger.info("=" * 70)
        
        total_tables = len(results)
        verified_tables = sum(1 for success, _ in results.values() if success)
        failed_tables = total_tables - verified_tables
        
        total_rows = sum(count for _, count in results.values())
        
        logger.info(f"Tables verified: {verified_tables}/{total_tables}")
        logger.info(f"Total rows: {total_rows:,}")
        
        if failed_tables > 0:
            logger.warning(f"\n⚠️ {failed_tables} table(s) failed verification:")
            for table, (success, count) in results.items():
                if not success:
                    logger.warning(f"  - {table} ({count} rows)")
        
        # Test some key queries
        logger.info("\n🔍 Testing Key Queries")
        logger.info("-" * 70)
        
        cursor = conn.cursor()
        
        # Test spatial query
        try:
            cursor.execute("SELECT COUNT(*) FROM polygon_features WHERE layer_id LIKE 'biomass%'")
            biomass_count = cursor.fetchone()[0]
            logger.info(f"✅ Biomass features: {biomass_count}")
        except Exception as e:
            logger.error(f"❌ Biomass query failed: {e}")
        
        # Test carbon query
        try:
            cursor.execute("SELECT COUNT(*) FROM county_carbon WHERE total_carbon_tons > 0")
            carbon_count = cursor.fetchone()[0]
            logger.info(f"✅ Counties with carbon data: {carbon_count}")
        except Exception as e:
            logger.error(f"❌ Carbon query failed: {e}")
        
        # Test user query
        try:
            cursor.execute("SELECT COUNT(*) FROM users WHERE is_active = TRUE")
            user_count = cursor.fetchone()[0]
            logger.info(f"✅ Active users: {user_count}")
        except Exception as e:
            logger.error(f"❌ User query failed: {e}")
        
        release_connection(conn)
        
        logger.info("\n" + "=" * 70)
        if failed_tables == 0:
            logger.info("🎉 All verifications passed!")
            logger.info("✅ Migration successful - database is ready to use")
            return True
        else:
            logger.warning("⚠️ Some verifications failed")
            logger.warning("Please check the failed tables and re-run migration if needed")
            return False
        logger.info("=" * 70)
        
    except Exception as e:
        logger.error(f"\n❌ Verification failed: {e}")
        return False


def verify_connection_only():
    """Quick connection test"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT version()")
        version = cursor.fetchone()[0]
        release_connection(conn)
        
        logger.info("✅ PostgreSQL connection successful")
        logger.info(f"📌 Database version: {version[:50]}...")
        return True
    except Exception as e:
        logger.error(f"❌ Connection failed: {e}")
        return False


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--connection-only":
        # Quick connection test
        success = verify_connection_only()
    else:
        # Full verification
        success = verify_migration()
    
    sys.exit(0 if success else 1)

