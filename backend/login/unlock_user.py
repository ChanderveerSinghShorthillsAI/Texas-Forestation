#!/usr/bin/env python3
"""
Unlock User Account Script for Texas Forestation Authentication System

This script unlocks a user account by resetting the failed login attempts counter.
Use this when an account gets locked due to multiple failed login attempts.
"""

import os
import sys
import logging
from pathlib import Path

# Add the backend directory to the path so we can import our modules
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Change to backend directory to ensure correct relative paths
os.chdir(str(backend_dir))

from login.user_database import user_db_service
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_user_status(username: str):
    """
    Check and display the current status of a user account
    
    Args:
        username: Username to check
    """
    try:
        logger.info(f"🔍 Checking status for user: {username}")
        
        user = user_db_service.get_user_by_username(username)
        if not user:
            logger.error(f"❌ User '{username}' not found in database")
            return None
        
        logger.info(f"\n📊 User Account Status:")
        logger.info(f"   - Username: {user.username}")
        logger.info(f"   - User ID: {user.id}")
        logger.info(f"   - Active: {user.is_active}")
        logger.info(f"   - Created: {user.created_at}")
        logger.info(f"   - Last Login: {user.last_login}")
        logger.info(f"   - Login Count: {user.login_count}")
        logger.info(f"   - Failed Login Attempts: {user.failed_login_attempts}")
        logger.info(f"   - Last Failed Login: {user.last_failed_login}")
        logger.info(f"   - Account Locked: {'🔒 YES' if user.is_account_locked() else '✅ NO'}")
        
        return user
        
    except Exception as e:
        logger.error(f"❌ Error checking user status: {e}")
        return None

def unlock_user(username: str):
    """
    Unlock a user account by resetting failed login attempts
    
    Args:
        username: Username to unlock
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        logger.info(f"\n🔓 Attempting to unlock user: {username}")
        
        # Get user from database
        user = user_db_service.get_user_by_username(username)
        if not user:
            logger.error(f"❌ User '{username}' not found in database")
            return False
        
        # Check if account is actually locked
        if not user.is_account_locked():
            logger.info(f"ℹ️ Account '{username}' is not locked (failed attempts: {user.failed_login_attempts})")
            return True
        
        # Reset failed login attempts using database service
        from login.user_models import User
        from sqlalchemy import update
        
        with user_db_service.get_session() as session:
            # Update the user directly
            stmt = update(User).where(User.username == username).values(
                failed_login_attempts=0,
                last_failed_login=None
            )
            session.execute(stmt)
        
        logger.info(f"✅ Successfully unlocked account: {username}")
        logger.info(f"   - Failed login attempts reset to: 0")
        
        # Verify the unlock
        updated_user = user_db_service.get_user_by_username(username)
        if updated_user and not updated_user.is_account_locked():
            logger.info(f"✅ Verification successful - account is now unlocked")
            return True
        else:
            logger.error(f"❌ Verification failed - account may still be locked")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error unlocking user: {e}")
        import traceback
        traceback.print_exc()
        return False

def unlock_all_users():
    """Unlock all locked user accounts"""
    try:
        logger.info("🔓 Unlocking all locked accounts...")
        
        users = user_db_service.get_all_users()
        locked_count = 0
        unlocked_count = 0
        
        for user in users:
            if user.is_account_locked():
                locked_count += 1
                logger.info(f"   - Found locked account: {user.username} ({user.failed_login_attempts} failed attempts)")
                if unlock_user(user.username):
                    unlocked_count += 1
        
        if locked_count == 0:
            logger.info("✅ No locked accounts found")
        else:
            logger.info(f"✅ Unlocked {unlocked_count}/{locked_count} accounts")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error unlocking all users: {e}")
        return False

def main():
    """Main unlock function"""
    logger.info("🚀 Texas Forestation User Account Unlock Tool")
    logger.info("=" * 60)
    
    # Default username (from environment variable or default)
    DEFAULT_USERNAME = os.getenv("DEFAULT_USERNAME", "user1234")
    
    # Step 1: Check current status
    user = check_user_status(DEFAULT_USERNAME)
    if not user:
        logger.error("❌ Cannot proceed - user not found")
        sys.exit(1)
    
    # Step 2: Unlock if needed
    if user.is_account_locked():
        logger.info(f"\n🔒 Account is locked with {user.failed_login_attempts} failed attempts")
        logger.info("   Proceeding to unlock...")
        
        if unlock_user(DEFAULT_USERNAME):
            logger.info("\n" + "=" * 60)
            logger.info("🎉 Account unlocked successfully!")
            logger.info(f"   You can now login with username: {DEFAULT_USERNAME}")
            logger.info("=" * 60)
        else:
            logger.error("\n❌ Failed to unlock account")
            sys.exit(1)
    else:
        logger.info(f"\n✅ Account is not locked - no action needed")
        logger.info("   If you still can't login, the issue may be:")
        logger.info("   - Incorrect password")
        logger.info("   - Account deactivated")
        logger.info("   - Backend server not running")

if __name__ == "__main__":
    main()

