import json
import asyncio
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .citizen_chatbot_service import chat_service
from .citizen_chatbot_models import get_db, init_database, ChatSession
from .citizen_chatbot_cache import cache_service
from .citizen_chatbot_confidential import confidential_detector

logger = logging.getLogger(__name__)

# Pydantic models for API requests/responses
class ChatMessage(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = []

class ChatResponse(BaseModel):
    answer: str
    response_time_ms: float
    sources_count: int
    was_cached: bool
    session_id: str

class ChatHistoryResponse(BaseModel):
    messages: List[Dict[str, str]]
    session_id: str
    message_count: int

class ClearHistoryResponse(BaseModel):
    success: bool
    message: str
    session_id: str

class ChatStatsResponse(BaseModel):
    total_sessions: int
    active_sessions: int
    total_messages: int
    cache_stats: Dict[str, Any]
    confidential_attempts: Dict[str, Any]

# Create router for chatbot endpoints
router = APIRouter(prefix="/api/citizen_chatbot", tags=["Citizen Chatbot"])

def get_client_info(request: Request) -> tuple[str, str]:
    """Extract client IP and user agent from request"""
    # Get real IP considering proxies
    client_ip = request.headers.get("x-forwarded-for")
    if client_ip:
        client_ip = client_ip.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"
    
    user_agent = request.headers.get("user-agent", "")
    return client_ip, user_agent

async def get_chat_session(request: Request) -> str:
    """Get or create a chat session for the request"""
    client_ip, user_agent = get_client_info(request)
    return await chat_service.get_or_create_session(client_ip, user_agent)

# Note: Chatbot initialization is handled in main.py lifespan context manager
# This avoids the deprecated @router.on_event("startup") decorator

@router.post("/chat/", response_model=ChatResponse)
async def chat_endpoint(
    chat_request: ChatMessage,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Send a chat message and get a complete response (non-streaming)
    Use this endpoint when WebSocket is not available
    """
    try:
        if not chat_service.is_initialized:
            raise HTTPException(status_code=503, detail="Chat service not initialized")
        
        user_message = chat_request.message.strip()
        if not user_message:
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        # Get session
        session_id = await get_chat_session(request)
        client_ip, _ = get_client_info(request)
        
        # Collect all response chunks
        response_chunks = []
        sources_count = 0
        was_cached = False
        
        async for chunk in chat_service.process_user_message(user_message, session_id, client_ip):
            if chunk.get("type") == "text":
                response_chunks.append(chunk.get("content", ""))
            elif chunk.get("type") == "citation":
                response_chunks.append(chunk.get("content", ""))
                sources_count += 1
            elif chunk.get("type") == "message":
                response_chunks.append(chunk.get("content", ""))
            
            # Check if response was cached
            if chunk.get("metadata", {}).get("is_cached"):
                was_cached = True
        
        # Combine all chunks
        full_response = "".join(response_chunks)
        
        if not full_response:
            raise HTTPException(status_code=500, detail="No response generated")
        
        return ChatResponse(
            answer=full_response,
            response_time_ms=0,  # Will be calculated in service
            sources_count=sources_count,
            was_cached=was_cached,
            session_id=session_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/chat/new/")
async def new_chat_endpoint(request: Request):
    """
    Start a new chat - creates fresh session (no caching)
    Call this when user clicks "New Chat" button
    """
    try:
        # Create or get session (will create new one)
        client_ip, user_agent = get_client_info(request)
        session_id = await chat_service.get_or_create_session(client_ip, user_agent)
        
        logger.info(f"🆕 New chat started, session: {session_id[:8]}...")
        
        return {
            "status": "success",
            "message": "New chat started",
            "session_id": session_id
        }
        
    except Exception as e:
        logger.error(f"❌ New chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Error starting new chat: {str(e)}")

@router.post("/chat/stream/")
async def chat_stream_endpoint(
    chat_request: ChatMessage,
    request: Request
):
    """
    Stream chat response in real-time (HTTP fallback for WebSocket)
    Returns a streaming response with JSON chunks
    """
    try:
        if not chat_service.is_initialized:
            raise HTTPException(status_code=503, detail="Chat service not initialized")
        
        user_message = chat_request.message.strip()
        if not user_message:
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        # Get session
        session_id = await get_chat_session(request)
        client_ip, _ = get_client_info(request)
        
        async def generate_stream():
            """Generate streaming JSON responses"""
            try:
                async for chunk in chat_service.process_user_message(user_message, session_id, client_ip):
                    # Send each chunk as a separate JSON line
                    json_chunk = json.dumps(chunk) + "\n"
                    yield json_chunk
                    
                    # Small delay to prevent overwhelming
                    await asyncio.sleep(0.01)
                    
            except Exception as e:
                logger.error(f"❌ Stream generation error: {e}")
                error_chunk = {
                    "type": "error",
                    "content": f"Stream error: {str(e)}",
                    "metadata": {}
                }
                yield json.dumps(error_chunk) + "\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="application/x-ndjson",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"  # Disable nginx buffering
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Chat stream endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/chat/async/start/")
async def chat_async_start(chat_request: ChatMessage, request: Request):
    """Start a chat request asynchronously; returns a request_id for polling."""
    try:
        if not chat_service.is_initialized:
            raise HTTPException(status_code=503, detail="Chat service not initialized")

        user_message = chat_request.message.strip()
        if not user_message:
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        session_id = await get_chat_session(request)
        client_ip, _ = get_client_info(request)
        request_id = await chat_service.start_async_request(user_message, session_id, client_ip)
        return {"request_id": request_id, "session_id": session_id, "status": "in_progress"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Async start error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start async chat: {str(e)}")

@router.get("/chat/async/status/{request_id}")
async def chat_async_status(request_id: str):
    """Get status for an async chat request."""
    try:
        status = await chat_service.get_request_status(request_id)
        if status.get("status") == "not_found":
            raise HTTPException(status_code=404, detail="Request not found")
        return status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Async status error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get async status: {str(e)}")

@router.get("/chat/async/result/{request_id}")
async def chat_async_result(request_id: str):
    """Get result for an async chat request (when completed)."""
    try:
        result = await chat_service.get_request_result(request_id)
        if result.get("status") == "not_found":
            raise HTTPException(status_code=404, detail="Request not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Async result error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get async result: {str(e)}")

@router.get("/history/", response_model=ChatHistoryResponse)
async def get_chat_history(
    request: Request,
    limit: int = 20
):
    """Get chat history for the current session"""
    try:
        session_id = await get_chat_session(request)
        
        # Get history from service
        history = await chat_service.get_chat_history(session_id, limit=limit)
        
        return ChatHistoryResponse(
            messages=history,
            session_id=session_id,
            message_count=len(history)
        )
        
    except Exception as e:
        logger.error(f"❌ Get history error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get history: {str(e)}")

@router.post("/clear/", response_model=ClearHistoryResponse)
async def clear_chat_history(request: Request):
    """Clear chat history for the current session"""
    try:
        session_id = await get_chat_session(request)
        
        success = await chat_service.clear_chat_history(session_id)
        
        return ClearHistoryResponse(
            success=success,
            message="Chat history cleared successfully" if success else "Failed to clear history",
            session_id=session_id
        )
        
    except Exception as e:
        logger.error(f"❌ Clear history error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear history: {str(e)}")

@router.get("/stats/", response_model=ChatStatsResponse)
async def get_chat_stats(request: Request):
    """Get chatbot statistics (admin endpoint)"""
    try:
        logger.info("📊 Getting chat statistics...")
        
        # Get basic session stats from service
        history = await chat_service.get_chat_history("stats_query", limit=1)
        
        return ChatStatsResponse(
            total_sessions=len(history),
            active_sessions=len([h for h in history if h.get("role") == "user"]),
            message="Chat statistics retrieved",
            success=True
        )
        
    except Exception as e:
        logger.error(f"❌ Stats error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")

@router.post("/admin/cleanup-old-sessions/")
async def cleanup_old_sessions_admin(
    days: int = 1,
    request: Request = None
):
    """Admin endpoint: Clean up sessions older than specified days (default: 1 day = 24 hours)"""
    try:
        logger.info(f"🧹 Admin cleanup: removing sessions older than {days} days")
        
        stats = await chat_service.cleanup_old_sessions(older_than_days=days)
        
        return {
            "success": True,
            "message": f"Cleanup completed: {stats.get('sessions_deleted', 0)} sessions deleted",
            "statistics": stats
        }
        
    except Exception as e:
        logger.error(f"❌ Cleanup error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cleanup: {str(e)}")

@router.post("/admin/cleanup-inactive-sessions/")
async def cleanup_inactive_sessions_admin(
    hours: int = 24,
    request: Request = None
):
    """Admin endpoint: Mark sessions inactive after specified hours"""
    try:
        logger.info(f"🔒 Admin cleanup: marking sessions inactive after {hours} hours")
        
        stats = await chat_service.cleanup_inactive_sessions(inactive_hours=hours)
        
        return {
            "success": True,
            "message": f"Cleanup completed: {stats.get('sessions_marked_inactive', 0)} sessions marked inactive",
            "statistics": stats
        }
        
    except Exception as e:
        logger.error(f"❌ Cleanup error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cleanup: {str(e)}")

@router.get("/admin/storage-stats/")
async def get_storage_stats_admin(request: Request = None):
    """Admin endpoint: Get detailed database storage statistics"""
    try:
        logger.info("📊 Getting detailed storage statistics...")
        
        stats = await chat_service.get_storage_stats()
        
        return {
            "success": True,
            "message": "Storage statistics retrieved",
            "statistics": stats
        }
        
    except Exception as e:
        logger.error(f"❌ Storage stats error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get storage stats: {str(e)}")

@router.delete("/admin/clear-cache/")
async def clear_cache_admin(hours: Optional[int] = None):
    """Admin endpoint: Clear cache entries"""
    try:
        cleared_count = await cache_service.clear_cache(older_than_hours=hours)
        return {
            "success": True,
            "message": f"Cleared {cleared_count} cache entries",
            "cleared_count": cleared_count
        }
    except Exception as e:
        logger.error(f"❌ Clear cache error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")

@router.get("/health/")
async def health_check():
    """Health check endpoint for the chatbot service"""
    try:
        is_initialized = chat_service.is_initialized
        
        # Test database connection
        db_healthy = True
        try:
            db = SessionLocal()
            db.execute("SELECT 1")
            db.close()
        except Exception:
            db_healthy = False
        
        # Test cache service
        cache_healthy = True
        try:
            await cache_service.get_cache_stats()
        except Exception:
            cache_healthy = False
        
        status = "healthy" if (is_initialized and db_healthy and cache_healthy) else "unhealthy"
        
        return {
            "status": status,
            "chat_service_initialized": is_initialized,
            "database_healthy": db_healthy,
            "cache_service_healthy": cache_healthy,
            "timestamp": "2024-01-20T00:00:00Z"  # Would be datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Health check error: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

# Additional utility endpoints

@router.post("/test/")
async def test_chatbot(message: str = "Hello, how are you?"):
    """Test endpoint for development purposes"""
    try:
        # Create a temporary session for testing
        test_session_id = await chat_service.get_or_create_session("127.0.0.1", "test-agent")
        
        response_chunks = []
        async for chunk in chat_service.process_user_message(message, test_session_id):
            if chunk.get("type") in ["text", "message"]:
                response_chunks.append(chunk.get("content", ""))
        
        full_response = "".join(response_chunks)
        
        return {
            "test_message": message,
            "response": full_response,
            "session_id": test_session_id,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"❌ Test endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")

# Export the router
__all__ = ["router"] 