import hashlib
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
import logging

from .citizen_chatbot_models import ChatCache, SessionLocal

logger = logging.getLogger(__name__)

class ChatCacheService:
    """Enhanced cache service using database storage for better performance and analytics"""
    
    def __init__(self, default_ttl_hours: int = 24):
        self.default_ttl_hours = default_ttl_hours
        self._cleanup_task = None
        
    async def start_cleanup_task(self):
        """Start background task to clean expired cache entries"""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
            logger.info("🧹 Started cache cleanup task")
    
    async def stop_cleanup_task(self):
        """Stop background cleanup task"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None
            logger.info("🛑 Stopped cache cleanup task")
    
    def _hash_query(self, query: str) -> str:
        """Create a hash for the query to use as cache key"""
        normalized_query = query.lower().strip()
        return hashlib.sha256(normalized_query.encode()).hexdigest()
    
    async def get_cached_response(self, query: str) -> Optional[str]:
        """
        Get cached response for a query
        Returns None if not found or expired
        """
        query_hash = self._hash_query(query)
        
        db = SessionLocal()
        try:
            cache_entry = db.query(ChatCache).filter(
                and_(
                    ChatCache.query_hash == query_hash,
                    ChatCache.is_active == True
                )
            ).first()
            
            if not cache_entry:
                logger.debug(f"🔍 Cache MISS for query hash: {query_hash[:8]}...")
                return None
            
            # Check if expired
            if cache_entry.is_expired():
                logger.debug(f"⏰ Cache EXPIRED for query hash: {query_hash[:8]}...")
                # Mark as inactive instead of deleting immediately
                cache_entry.is_active = False
                db.commit()
                return None
            
            # Update access statistics
            cache_entry.update_access()
            db.commit()
            
            logger.info(f"🎯 Cache HIT for query hash: {query_hash[:8]}... (accessed {cache_entry.access_count} times)")
            return cache_entry.response_text
            
        except Exception as e:
            logger.error(f"❌ Error retrieving cache: {e}")
            db.rollback()
            return None
        finally:
            db.close()
    
    async def set_cached_response(
        self, 
        query: str, 
        response: str, 
        response_time_ms: float = 0,
        sources_count: int = 0,
        ttl_hours: Optional[int] = None
    ) -> bool:
        """
        Cache a response for a query
        Returns True if successful
        """
        query_hash = self._hash_query(query)
        ttl = ttl_hours or self.default_ttl_hours
        
        db = SessionLocal()
        try:
            # Check if entry already exists
            existing = db.query(ChatCache).filter(ChatCache.query_hash == query_hash).first()
            
            if existing:
                # Update existing entry
                existing.response_text = response
                existing.created_at = datetime.utcnow()
                existing.last_accessed = datetime.utcnow()
                existing.access_count = 1
                existing.ttl_hours = ttl
                existing.is_active = True
                existing.original_response_time_ms = response_time_ms
                existing.sources_count = sources_count
                logger.info(f"🔄 Updated cache entry for query hash: {query_hash[:8]}...")
            else:
                # Create new entry
                cache_entry = ChatCache(
                    query_hash=query_hash,
                    session_id=None,  # No session scoping
                    query_text=query[:1000],  # Limit query text length
                    response_text=response,
                    ttl_hours=ttl,
                    original_response_time_ms=response_time_ms,
                    sources_count=sources_count
                )
                db.add(cache_entry)
                logger.info(f"💾 Created new cache entry for query hash: {query_hash[:8]}...")
            
            db.commit()
            return True
            
        except Exception as e:
            logger.error(f"❌ Error setting cache: {e}")
            db.rollback()
            return False
        finally:
            db.close()
    
    async def clear_session_cache(self, session_id: str) -> int:
        """
        Clear all cache entries for a specific session
        Returns number of entries cleared
        """
        db = SessionLocal()
        try:
            count = db.query(ChatCache).filter(
                ChatCache.session_id == session_id
            ).count()
            
            db.query(ChatCache).filter(
                ChatCache.session_id == session_id
            ).delete(synchronize_session=False)
            
            db.commit()
            
            logger.info(f"🧹 Cleared {count} cache entries for session: {session_id[:8]}...")
            return count
            
        except Exception as e:
            logger.error(f"❌ Error clearing session cache: {e}")
            db.rollback()
            return 0
        finally:
            db.close()
    
    async def clear_cache(self, older_than_hours: Optional[int] = None) -> int:
        """
        Clear cache entries
        If older_than_hours is specified, only clear entries older than that
        Returns number of entries cleared
        """
        db = SessionLocal()
        try:
            query = db.query(ChatCache)
            
            if older_than_hours:
                cutoff_time = datetime.utcnow() - timedelta(hours=older_than_hours)
                query = query.filter(ChatCache.created_at < cutoff_time)
            
            count = query.count()
            query.delete(synchronize_session=False)
            db.commit()
            
            logger.info(f"🧹 Cleared {count} cache entries")
            return count
            
        except Exception as e:
            logger.error(f"❌ Error clearing cache: {e}")
            db.rollback()
            return 0
        finally:
            db.close()
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics for monitoring"""
        db = SessionLocal()
        try:
            total_entries = db.query(ChatCache).count()
            active_entries = db.query(ChatCache).filter(ChatCache.is_active == True).count()
            
            # Most accessed entries
            top_entries = db.query(ChatCache).filter(
                ChatCache.is_active == True
            ).order_by(desc(ChatCache.access_count)).limit(5).all()
            
            # Recent entries
            recent_entries = db.query(ChatCache).filter(
                ChatCache.is_active == True
            ).order_by(desc(ChatCache.created_at)).limit(5).all()
            
            # Calculate average response time
            avg_response_time = db.query(ChatCache).filter(
                and_(
                    ChatCache.is_active == True,
                    ChatCache.original_response_time_ms.isnot(None)
                )
            ).with_entities(ChatCache.original_response_time_ms).all()
            
            avg_time = 0
            if avg_response_time:
                avg_time = sum(row[0] for row in avg_response_time) / len(avg_response_time)
            
            return {
                "total_entries": total_entries,
                "active_entries": active_entries,
                "inactive_entries": total_entries - active_entries,
                "cache_hit_rate": "N/A",  # Would need more detailed tracking
                "average_response_time_ms": round(avg_time, 2),
                "most_accessed": [
                    {
                        "query_snippet": entry.query_text[:50] + "..." if len(entry.query_text) > 50 else entry.query_text,
                        "access_count": entry.access_count,
                        "last_accessed": entry.last_accessed.isoformat()
                    }
                    for entry in top_entries
                ],
                "recent_entries": [
                    {
                        "query_snippet": entry.query_text[:50] + "..." if len(entry.query_text) > 50 else entry.query_text,
                        "created_at": entry.created_at.isoformat(),
                        "access_count": entry.access_count
                    }
                    for entry in recent_entries
                ]
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting cache stats: {e}")
            return {"error": str(e)}
        finally:
            db.close()
    
    async def _periodic_cleanup(self):
        """Background task to periodically clean expired cache entries"""
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour
                
                db = SessionLocal()
                try:
                    # Delete inactive entries older than 7 days
                    cutoff_time = datetime.utcnow() - timedelta(days=7)
                    deleted = db.query(ChatCache).filter(
                        and_(
                            ChatCache.is_active == False,
                            ChatCache.created_at < cutoff_time
                        )
                    ).delete(synchronize_session=False)
                    
                    # Mark expired active entries as inactive
                    expired_entries = db.query(ChatCache).filter(
                        ChatCache.is_active == True
                    ).all()
                    
                    marked_inactive = 0
                    for entry in expired_entries:
                        if entry.is_expired():
                            entry.is_active = False
                            marked_inactive += 1
                    
                    db.commit()
                    
                    if deleted > 0 or marked_inactive > 0:
                        logger.info(f"🧹 Cleanup: deleted {deleted} old entries, marked {marked_inactive} as inactive")
                        
                except Exception as e:
                    logger.error(f"❌ Error in cleanup task: {e}")
                    db.rollback()
                finally:
                    db.close()
                    
            except asyncio.CancelledError:
                logger.info("🛑 Cache cleanup task cancelled")
                break
            except Exception as e:
                logger.error(f"❌ Unexpected error in cleanup task: {e}")

# Global cache service instance
cache_service = ChatCacheService()

# Convenience functions for simple global caching
async def get_cached_answer(query: str) -> Optional[str]:
    """Get cached answer"""
    return await cache_service.get_cached_response(query)

async def set_cached_answer(query: str, answer: str, response_time_ms: float = 0, sources_count: int = 0):
    """Set cached answer"""
    return await cache_service.set_cached_response(query, answer, response_time_ms, sources_count)

async def clear_all_cache():
    """Clear all cache - called on new chat"""
    return await cache_service.clear_cache()

async def clear_cache():
    """Clear all cache - global function"""
    return await cache_service.clear_cache() 