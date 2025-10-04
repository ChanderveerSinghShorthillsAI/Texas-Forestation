#!/usr/bin/env python3
"""
User Management Script for Texas Forestation System
Usage: python3 manage_users.py [command] [args]
"""

import sys
import argparse
from login import user_db_service
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def list_users():
    """List all users in the system"""
    print("👥 Users in Texas Forestation System:")
    print("=" * 50)
    
    users = user_db_service.get_all_users()
    if not users:
        print("No users found in the system.")
        return
    
    for user in users:
        status = "🟢 Active" if user.is_active else "🔴 Inactive"
        locked = "🔒 LOCKED" if user.is_account_locked() else ""
        
        print(f"Username: {user.username}")
        print(f"  Status: {status} {locked}")
        print(f"  ID: {user.id}")
        print(f"  Created: {user.created_at}")
        print(f"  Last Login: {user.last_login or 'Never'}")
        print(f"  Login Count: {user.login_count}")
        print(f"  Failed Attempts: {user.failed_login_attempts}")
        print("-" * 30)
    
    print(f"Total users: {len(users)}")

def create_user(username: str, password: str):
    """Create a new user"""
    print(f"🆕 Creating new user: {username}")
    
    try:
        user = user_db_service.create_user(username, password)
        if user:
            print(f"✅ User '{username}' created successfully!")
            print(f"   User ID: {user.id}")
            print(f"   Created: {user.created_at}")
        else:
            print(f"❌ Failed to create user '{username}' (may already exist)")
    except Exception as e:
        print(f"❌ Error creating user: {e}")

def test_login(username: str, password: str):
    """Test user authentication"""
    print(f"🔐 Testing login for user: {username}")
    
    user = user_db_service.authenticate_user(username, password)
    if user:
        print(f"✅ Login successful!")
        print(f"   Welcome, {user.username}!")
        print(f"   Login count: {user.login_count}")
    else:
        print(f"❌ Login failed for user '{username}'")

def reset_password(username: str, new_password: str):
    """Reset user password"""
    print(f"🔄 Resetting password for user: {username}")
    
    success = user_db_service.update_user_password(username, new_password)
    if success:
        print(f"✅ Password reset successful for '{username}'!")
    else:
        print(f"❌ Failed to reset password for '{username}' (user may not exist)")

def unlock_user(username: str):
    """Unlock user account by resetting failed login attempts"""
    print(f"🔓 Unlocking account for user: {username}")
    
    try:
        from login.user_models import User
        with user_db_service.get_session() as session:
            user = session.query(User).filter_by(username=username).first()
            if not user:
                print(f"❌ User '{username}' not found")
                return False
            
            if not user.is_account_locked():
                print(f"ℹ️ Account '{username}' is not locked")
                return True
            
            user.failed_login_attempts = 0
            print(f"✅ Account '{username}' unlocked successfully!")
            print(f"   Failed attempts reset to 0")
            return True
            
    except Exception as e:
        print(f"❌ Error unlocking account: {e}")
        return False

def show_stats():
    """Show system statistics"""
    print("📊 Texas Forestation System Statistics:")
    print("=" * 40)
    
    user_count = user_db_service.get_user_count()
    health = user_db_service.health_check()
    
    print(f"Total Users: {user_count}")
    print(f"Database Health: {'✅ Healthy' if health else '❌ Unhealthy'}")
    print(f"Database File: spatial_data.db")

def main():
    parser = argparse.ArgumentParser(description='Texas Forestation User Management')
    parser.add_argument('command', choices=['list', 'create', 'test', 'reset', 'unlock', 'stats'], 
                       help='Command to execute')
    parser.add_argument('--username', '-u', help='Username')
    parser.add_argument('--password', '-p', help='Password')
    parser.add_argument('--new-password', '-np', help='New password for reset')
    
    args = parser.parse_args()
    
    print("🌲 Texas Forestation User Management System")
    print("=" * 50)
    
    if args.command == 'list':
        list_users()
    
    elif args.command == 'create':
        if not args.username or not args.password:
            print("❌ Error: --username and --password required for create command")
            sys.exit(1)
        create_user(args.username, args.password)
    
    elif args.command == 'test':
        if not args.username or not args.password:
            print("❌ Error: --username and --password required for test command")
            sys.exit(1)
        test_login(args.username, args.password)
    
    elif args.command == 'reset':
        if not args.username or not args.new_password:
            print("❌ Error: --username and --new-password required for reset command")
            sys.exit(1)
        reset_password(args.username, args.new_password)
    
    elif args.command == 'unlock':
        if not args.username:
            print("❌ Error: --username required for unlock command")
            sys.exit(1)
        unlock_user(args.username)
    
    elif args.command == 'stats':
        show_stats()

if __name__ == "__main__":
    main() 