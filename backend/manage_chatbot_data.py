#!/usr/bin/env python3
"""
Database Management Script for Texas Citizen Chatbot
Provides commands to check storage stats and clean up old data
"""
import asyncio
import argparse
import sys
import os

# Add the current directory to path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from citizen_chatbot.citizen_chatbot_service import chat_service

async def show_stats():
    """Show database storage statistics"""
    print("📊 Checking database storage statistics...")
    
    try:
        stats = await chat_service.get_storage_stats()
        
        print("\n" + "="*50)
        print("DATABASE STORAGE STATISTICS")
        print("="*50)
        print(f"Total Sessions: {stats.get('total_sessions', 0)}")
        print(f"Active Sessions: {stats.get('active_sessions', 0)}")
        print(f"Inactive Sessions: {stats.get('inactive_sessions', 0)}")
        print(f"Total Messages: {stats.get('total_messages', 0)}")
        print(f"Total Confidential Queries: {stats.get('total_confidential_queries', 0)}")
        print(f"Average Messages per Session: {stats.get('average_messages_per_session', 0)}")
        
        if stats.get('oldest_session_date'):
            print(f"Oldest Session: {stats['oldest_session_date']}")
        if stats.get('newest_session_date'):
            print(f"Newest Session: {stats['newest_session_date']}")
        
        print("="*50)
        
        # Estimate storage impact
        total_records = stats.get('total_sessions', 0) + stats.get('total_messages', 0)
        print(f"\n💾 Estimated database records: {total_records}")
        
        if stats.get('total_sessions', 0) > 1000:
            print("⚠️  Large number of sessions detected - consider cleanup")
        
    except Exception as e:
        print(f"❌ Error getting stats: {e}")

async def cleanup_old(days: int):
    """Clean up sessions older than specified days"""
    print(f"🧹 Cleaning up sessions older than {days} days...")
    
    try:
        stats = await chat_service.cleanup_old_sessions(older_than_days=days)
        
        print("\n" + "="*50)
        print("CLEANUP RESULTS")
        print("="*50)
        print(f"Sessions Deleted: {stats.get('sessions_deleted', 0)}")
        print(f"Messages Deleted: {stats.get('messages_deleted', 0)}")
        print(f"Cutoff Date: {stats.get('cutoff_date', 'Unknown')}")
        print("="*50)
        
        if stats.get('sessions_deleted', 0) > 0:
            print(f"✅ Successfully cleaned up {stats['sessions_deleted']} old sessions")
        else:
            print("ℹ️  No old sessions found to clean up")
            
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")

async def mark_inactive(hours: int):
    """Mark sessions as inactive after specified hours"""
    print(f"🔒 Marking sessions inactive after {hours} hours...")
    
    try:
        stats = await chat_service.cleanup_inactive_sessions(inactive_hours=hours)
        
        print("\n" + "="*50)
        print("INACTIVE CLEANUP RESULTS")
        print("="*50)
        print(f"Sessions Marked Inactive: {stats.get('sessions_marked_inactive', 0)}")
        print(f"Cutoff Date: {stats.get('cutoff_date', 'Unknown')}")
        print("="*50)
        
        if stats.get('sessions_marked_inactive', 0) > 0:
            print(f"✅ Successfully marked {stats['sessions_marked_inactive']} sessions as inactive")
        else:
            print("ℹ️  No sessions found to mark inactive")
            
    except Exception as e:
        print(f"❌ Error marking sessions inactive: {e}")

async def main():
    parser = argparse.ArgumentParser(description='Manage Texas Citizen Chatbot Database')
    parser.add_argument('command', choices=['stats', 'cleanup', 'inactive'], 
                       help='Command to run')
    parser.add_argument('--days', type=int, default=1, 
                       help='Days for cleanup command (default: 1 day = 24 hours)')
    parser.add_argument('--hours', type=int, default=24, 
                       help='Hours for inactive command (default: 24)')
    
    args = parser.parse_args()
    
    print("🤖 Texas Citizen Chatbot Database Manager")
    print("-" * 40)
    
    try:
        # Initialize the service
        await chat_service.initialize()
        
        if args.command == 'stats':
            await show_stats()
        elif args.command == 'cleanup':
            await cleanup_old(args.days)
        elif args.command == 'inactive':
            await mark_inactive(args.hours)
        
    except KeyboardInterrupt:
        print("\n⚠️  Operation cancelled by user")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        # Cleanup
        await chat_service.cleanup()

if __name__ == "__main__":
    asyncio.run(main()) 