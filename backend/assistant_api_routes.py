from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
import json
import asyncio

from chatbot_vanna import process_user_query, process_user_query_stream
from chat_history_store import get_last_interactions, clear_user_history, get_user_context


router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class AssistantQueryRequest(BaseModel):
    county_name: str = Field(..., description="County name, e.g., 'Travis County'")
    longitude: float = Field(..., ge=-180, le=180)
    latitude: float = Field(..., ge=-90, le=90)
    user_query: str = Field(..., description="User's question or instruction")
    username: Optional[str] = Field(None, description="Username to bind chat history")


@router.post("/query")
async def assistant_query(req: AssistantQueryRequest) -> Dict[str, Any]:
    try:
        result = process_user_query(
            county_name=req.county_name,
            longitude=req.longitude,
            latitude=req.latitude,
            user_query=req.user_query,
            username=req.username,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assistant query failed: {str(e)}")


@router.post("/query-stream")
async def assistant_query_stream(req: AssistantQueryRequest):
    """
    Streaming endpoint that returns response token by token using Server-Sent Events.
    """
    async def event_generator():
        try:
            # Process query with streaming
            async for chunk in process_user_query_stream(
                county_name=req.county_name,
                longitude=req.longitude,
                latitude=req.latitude,
                user_query=req.user_query,
                username=req.username,
            ):
                # Send each chunk as SSE event
                yield f"data: {json.dumps(chunk)}\n\n"
                await asyncio.sleep(0.01)  # Small delay for smooth rendering
            
            # Send completion event
            yield f"data: {json.dumps({'done': True})}\n\n"
            
        except Exception as e:
            error_data = {"error": str(e), "done": True}
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


class HistoryResponse(BaseModel):
    username: str
    history: List[Dict[str, str]]
    county_name: Optional[str] = None
    longitude: Optional[float] = None
    latitude: Optional[float] = None


@router.get("/history/{username}", response_model=HistoryResponse)
async def get_history(username: str):
    try:
        ctx = get_user_context(username)
        # Return only last 5 interactions
        all_history = ctx.get("history", [])
        last_5_history = all_history[-5:] if len(all_history) > 5 else all_history
        return {
            "username": username,
            "history": last_5_history,
            "county_name": ctx.get("county_name"),
            "longitude": ctx.get("longitude"),
            "latitude": ctx.get("latitude"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


@router.delete("/history/{username}")
async def delete_history(username: str) -> Dict[str, Any]:
    try:
        clear_user_history(username)
        return {"success": True, "username": username}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear history: {str(e)}")


