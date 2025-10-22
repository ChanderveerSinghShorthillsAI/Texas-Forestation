"""
PostgreSQL Database Configuration for Texas Vanrakshak
======================================================

This module provides centralized configuration for connecting to the
Azure PostgreSQL database hosted on the virtual machine.
"""

import os
import logging
from typing import Optional
import psycopg2
from psycopg2 import pool
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Database connection details - All credentials must be set in .env file
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_SSLMODE = os.getenv("DB_SSLMODE", "require")

# Validate required credentials
if not all([DB_HOST, DB_NAME, DB_USER, DB_PASS]):
    missing = []
    if not DB_HOST: missing.append("DB_HOST")
    if not DB_NAME: missing.append("DB_NAME")
    if not DB_USER: missing.append("DB_USER")
    if not DB_PASS: missing.append("DB_PASS")
    
    logger.error(f"❌ Missing required database credentials: {', '.join(missing)}")
    logger.error("💡 Please set these variables in your backend/.env file")
    raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

# Connection string for psycopg2
def get_connection_params():
    """Get PostgreSQL connection parameters"""
    return {
        "host": DB_HOST,
        "dbname": DB_NAME,
        "user": DB_USER,
        "password": DB_PASS,
        "port": DB_PORT,
        "sslmode": DB_SSLMODE
    }

# SQLAlchemy database URL
def get_database_url():
    """Get SQLAlchemy database URL for PostgreSQL"""
    return f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}?sslmode={DB_SSLMODE}"

# Connection pool for psycopg2
_connection_pool: Optional[pool.ThreadedConnectionPool] = None

def get_connection_pool(min_conn=2, max_conn=10):
    """
    Get or create a connection pool for PostgreSQL
    
    Args:
        min_conn: Minimum number of connections in pool
        max_conn: Maximum number of connections in pool
    
    Returns:
        ThreadedConnectionPool instance
    """
    global _connection_pool
    
    if _connection_pool is None:
        try:
            _connection_pool = pool.ThreadedConnectionPool(
                min_conn,
                max_conn,
                **get_connection_params()
            )
            logger.info(f"✅ PostgreSQL connection pool created ({min_conn}-{max_conn} connections)")
        except Exception as e:
            logger.error(f"❌ Failed to create connection pool: {e}")
            raise
    
    return _connection_pool

def get_connection():
    """
    Get a connection from the pool
    
    Returns:
        psycopg2 connection object
    """
    pool_instance = get_connection_pool()
    return pool_instance.getconn()

def release_connection(conn):
    """
    Release a connection back to the pool
    
    Args:
        conn: Connection to release
    """
    pool_instance = get_connection_pool()
    pool_instance.putconn(conn)

def close_all_connections():
    """Close all connections in the pool"""
    global _connection_pool
    if _connection_pool is not None:
        _connection_pool.closeall()
        _connection_pool = None
        logger.info("✅ All PostgreSQL connections closed")

def test_connection():
    """
    Test PostgreSQL connection
    
    Returns:
        bool: True if connection successful, False otherwise
    """
    try:
        conn = psycopg2.connect(**get_connection_params())
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        cursor.close()
        conn.close()
        logger.info(f"✅ PostgreSQL connection successful: {version[0][:50]}...")
        return True
    except Exception as e:
        logger.error(f"❌ PostgreSQL connection failed: {e}")
        return False

def create_sqlalchemy_engine(**kwargs):
    """
    Create SQLAlchemy engine for PostgreSQL
    
    Args:
        **kwargs: Additional arguments to pass to create_engine
    
    Returns:
        SQLAlchemy Engine instance
    """
    default_args = {
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "echo": False
    }
    default_args.update(kwargs)
    
    database_url = get_database_url()
    engine = create_engine(database_url, **default_args)
    logger.info("✅ SQLAlchemy engine created for PostgreSQL")
    return engine

def get_sqlalchemy_session(engine=None):
    """
    Get SQLAlchemy session factory
    
    Args:
        engine: SQLAlchemy engine (creates one if not provided)
    
    Returns:
        sessionmaker instance
    """
    if engine is None:
        engine = create_sqlalchemy_engine()
    
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Database info for logging
def get_db_info():
    """Get database connection information for logging"""
    return {
        "host": DB_HOST,
        "database": DB_NAME,
        "user": DB_USER,
        "port": DB_PORT,
        "ssl": DB_SSLMODE
    }

if __name__ == "__main__":
    # Test connection when run directly
    print("=" * 70)
    print("🔍 Testing PostgreSQL Connection")
    print("=" * 70)
    info = get_db_info()
    for key, value in info.items():
        print(f"{key}: {value}")
    print("-" * 70)
    
    if test_connection():
        print("✅ Connection test passed!")
    else:
        print("❌ Connection test failed!")

