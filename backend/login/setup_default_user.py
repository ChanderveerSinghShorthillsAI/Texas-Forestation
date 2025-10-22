#!/usr/bin/env python3
"""
Setup Default User Script for Texas Forestation Authentication System

This script creates the default user with proper password hashing
in the spatial_data.db database. Run this once after upgrading
from hardcoded to database authentication.
"""

import os
import sys
import logging
from pathlib import Path

# Add the backend directory to the path so we can import our modules
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Change to backend directory to ensure correct relative paths
import os
os.chdir(str(backend_dir))

from login.user_database import user_db_service
from login.user_models import User
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_default_user():
    """
    Create the default user account in the database
    
    Credentials must be set in backend/.env:
    - DEFAULT_USERNAME
    - DEFAULT_PASSWORD
    
    The password is stored securely with proper hashing.
    """
    
    # Default user credentials - MUST be set in .env file
    DEFAULT_USERNAME = os.getenv("DEFAULT_USERNAME")
    DEFAULT_PASSWORD = os.getenv("DEFAULT_PASSWORD")
    
    # Validate required credentials
    if not all([DEFAULT_USERNAME, DEFAULT_PASSWORD]):
        logger.error("❌ Missing default user credentials!")
        logger.error("💡 Please set the following in your backend/.env file:")
        if not DEFAULT_USERNAME: logger.error("   - DEFAULT_USERNAME")
        if not DEFAULT_PASSWORD: logger.error("   - DEFAULT_PASSWORD")
        return False
    
    try:
        logger.info("🔧 Setting up default user for Texas Forestation System...")
        
        # Check if user already exists
        existing_user = user_db_service.get_user_by_username(DEFAULT_USERNAME)
        if existing_user:
            logger.info(f"✅ User '{DEFAULT_USERNAME}' already exists in database")
            logger.info(f"   - User ID: {existing_user.id}")
            logger.info(f"   - Created: {existing_user.created_at}")
            logger.info(f"   - Login Count: {existing_user.login_count}")
            logger.info(f"   - Last Login: {existing_user.last_login}")
            logger.info(f"   - Active: {existing_user.is_active}")
            
            # Verify password still works
            if existing_user.verify_password(DEFAULT_PASSWORD):
                logger.info("✅ Password verification successful")
            else:
                logger.warning("⚠️ Password verification failed - may need to reset")
            
            return True
        
        # Create new user with hashed password
        logger.info(f"Creating new user: {DEFAULT_USERNAME}")
        new_user = user_db_service.create_user(DEFAULT_USERNAME, DEFAULT_PASSWORD)
        
        if new_user:
            logger.info("✅ Default user created successfully!")
            logger.info(f"   - Username: {DEFAULT_USERNAME}")
            logger.info(f"   - User ID: {new_user.id}")
            logger.info(f"   - Password: Securely hashed with salt")
            logger.info(f"   - Created: {new_user.created_at}")
            logger.info(f"   - Active: {new_user.is_active}")
            
            # Verify the password works by re-fetching the user
            verification_user = user_db_service.get_user_by_username(DEFAULT_USERNAME)
            if verification_user and verification_user.verify_password(DEFAULT_PASSWORD):
                logger.info("✅ Password verification test passed")
            else:
                logger.error("❌ Password verification test failed!")
                return False
                
            return True
        else:
            logger.error("❌ Failed to create default user")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error setting up default user: {e}")
        return False

def verify_database_setup():
    """Verify that the database and user tables are properly set up"""
    try:
        logger.info("🔍 Verifying database setup...")
        
        # Test database connection
        if not user_db_service.health_check():
            logger.error("❌ Database health check failed")
            return False
        
        logger.info("✅ Database connection successful")
        
        # Get user count
        user_count = user_db_service.get_user_count()
        logger.info(f"📊 Total users in database: {user_count}")
        
        # List all users (for admin purposes)
        users = user_db_service.get_all_users()
        for user in users:
            logger.info(f"   - {user.username} (ID: {user.id}, Active: {user.is_active})")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error verifying database setup: {e}")
        return False

def test_authentication():
    """Test the authentication flow with the default user"""
    try:
        logger.info("🧪 Testing authentication flow...")
        
        DEFAULT_USERNAME = os.getenv("DEFAULT_USERNAME")
        DEFAULT_PASSWORD = os.getenv("DEFAULT_PASSWORD")
        
        if not all([DEFAULT_USERNAME, DEFAULT_PASSWORD]):
            logger.error("❌ Missing default user credentials for testing!")
            return False
        
        # Test successful authentication
        user = user_db_service.authenticate_user(DEFAULT_USERNAME, DEFAULT_PASSWORD)
        if user:
            logger.info("✅ Authentication test passed")
            logger.info(f"   - Login count: {user.login_count}")
            logger.info(f"   - Failed attempts: {user.failed_login_attempts}")
            return True
        else:
            logger.error("❌ Authentication test failed")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error testing authentication: {e}")
        return False

def main():
    """Main setup function"""
    logger.info("🚀 Texas Forestation User Setup Starting...")
    logger.info("=" * 60)
    
    # Step 1: Verify database setup
    if not verify_database_setup():
        logger.error("❌ Database setup verification failed")
        sys.exit(1)
    
    # Step 2: Setup default user
    if not setup_default_user():
        logger.error("❌ Default user setup failed")
        sys.exit(1)
    
    # Step 3: Test authentication
    if not test_authentication():
        logger.error("❌ Authentication test failed")
        sys.exit(1)
    
    logger.info("=" * 60)
    logger.info("🎉 User setup completed successfully!")
    logger.info("")
    logger.info("📝 Summary:")
    logger.info(f"   - Default user created/verified: {os.getenv('DEFAULT_USERNAME', 'from .env')}")
    logger.info(f"   - Password: {os.getenv('DEFAULT_PASSWORD', 'from .env')} (securely hashed)")
    logger.info("   - Database: spatial_data.db")
    logger.info("   - Authentication: Production-ready")
    logger.info("")
    logger.info("🔐 Your authentication system is now database-backed!")
    logger.info("✅ No more hardcoded credentials!")

if __name__ == "__main__":
    main() 