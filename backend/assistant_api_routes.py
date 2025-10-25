from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

from chatbot_vanna import process_user_query
from chat_history_store import get_last_interactions, clear_user_history


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


class HistoryResponse(BaseModel):
    username: str
    interactions: List[Dict[str, str]]


@router.get("/history/{username}", response_model=HistoryResponse)
async def get_history(username: str):
    try:
        interactions = get_last_interactions(username, n=100)
        return {"username": username, "interactions": interactions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


@router.delete("/history/{username}")
async def delete_history(username: str) -> Dict[str, Any]:
    try:
        clear_user_history(username)
        return {"success": True, "username": username}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear history: {str(e)}")


