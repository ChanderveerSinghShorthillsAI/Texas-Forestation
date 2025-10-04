from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging
from encroachment_service import EncroachmentService

# Setup logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/encroachment", tags=["encroachment"])

# Initialize service
encroachment_service = EncroachmentService()

# Pydantic models
class EncroachmentAlert(BaseModel):
    """Model for encroachment alert data"""
    latitude: float
    longitude: float
    date: str
    confidence: str
    alert_id: Optional[str] = None

class EncroachmentRequest(BaseModel):
    """Request model for encroachment data"""
    start_date: Optional[str] = Field(None, description="Start date in YYYY-MM-DD format")
    end_date: Optional[str] = Field(None, description="End date in YYYY-MM-DD format")
    confidence_level: Optional[str] = Field("all", description="Confidence level: 'high', 'nominal', 'low', or 'all'")
    limit: Optional[int] = Field(100000, description="Maximum number of alerts to return", ge=1, le=1000000)
    offset: Optional[int] = Field(0, description="Number of alerts to skip", ge=0)

class EncroachmentResponse(BaseModel):
    """Response model for encroachment data"""
    alerts: List[EncroachmentAlert]
    total_count: int
    latest_data_date: Optional[str] = None
    confidence_breakdown: Dict[str, int]
    last_updated: datetime
    query_duration_ms: float
    message: Optional[str] = None

class EncroachmentStats(BaseModel):
    """Statistics for encroachment data"""
    total_alerts: int
    alerts_by_confidence: Dict[str, int]
    alerts_by_date: Dict[str, int]
    recent_alerts_count: int
    high_confidence_count: int
    last_alert_date: Optional[str]

class EncroachmentHealth(BaseModel):
    """Health check for encroachment service"""
    status: str
    api_accessible: bool
    last_successful_fetch: Optional[datetime]
    total_cached_alerts: int
    cache_age_hours: Optional[float]

@router.get("/health", response_model=EncroachmentHealth)
async def health_check():
    """Health check for encroachment service"""
    try:
        health_data = await encroachment_service.health_check()
        return EncroachmentHealth(**health_data)
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@router.get("/texas", response_model=EncroachmentResponse)
async def get_texas_encroachment(
    confidence_level: str = "all",
    limit: int = 100000,  # Increased limit to handle all data
    offset: int = 0
):
    """
    Get ALL encroachment alerts for the latest available date in Texas region
    """
    try:
        logger.info(f"Fetching ALL Texas encroachment data for latest date: {confidence_level} confidence")
        
        # Fetch ALL latest data from service (no date parameters needed)
        result = await encroachment_service.get_texas_encroachment(
            confidence_level=confidence_level,
            limit=limit,
            offset=offset
        )
        
        return EncroachmentResponse(**result)
        
    except Exception as e:
        logger.error(f"Failed to fetch Texas encroachment data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch encroachment data: {str(e)}")

@router.get("/statistics", response_model=EncroachmentStats)
async def get_encroachment_statistics():
    """
    Get statistics for encroachment data
    """
    try:
        logger.info("Fetching encroachment statistics")
        
        stats = await encroachment_service.get_statistics()
        return EncroachmentStats(**stats)
        
    except Exception as e:
        logger.error(f"Failed to fetch encroachment statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch statistics: {str(e)}")

@router.get("/recent", response_model=EncroachmentResponse)
async def get_recent_encroachment(days: int = 7, limit: int = 5000):
    """
    Get recent encroachment alerts (last N days)
    """
    try:
        logger.info(f"Fetching recent encroachment data: last {days} days")
        
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        
        result = await encroachment_service.get_texas_encroachment(
            start_date=start_date,
            end_date=end_date,
            confidence_level="all",
            limit=limit,
            offset=0
        )
        
        return EncroachmentResponse(**result)
        
    except Exception as e:
        logger.error(f"Failed to fetch recent encroachment data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch recent data: {str(e)}")

@router.get("/high-confidence", response_model=EncroachmentResponse)
async def get_high_confidence_encroachment(
    days: int = 30,
    limit: int = 10000
):
    """
    Get high confidence encroachment alerts
    """
    try:
        logger.info(f"Fetching high confidence encroachment data: last {days} days")
        
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        
        result = await encroachment_service.get_texas_encroachment(
            start_date=start_date,
            end_date=end_date,
            confidence_level="high",
            limit=limit,
            offset=0
        )
        
        return EncroachmentResponse(**result)
        
    except Exception as e:
        logger.error(f"Failed to fetch high confidence encroachment data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch high confidence data: {str(e)}")

@router.post("/refresh")
async def refresh_encroachment_data():
    """
    Refresh endpoint (no-op since data is always fetched live from API)
    """
    try:
        logger.info("Refresh requested - using live API data")
        
        result = await encroachment_service.refresh_data()
        
        return {
            "success": True,
            "message": result.get("message", "Data is always fresh from live API"),
            "alerts_fetched": result.get("alerts_fetched", 0),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to refresh encroachment data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh data: {str(e)}")

@router.get("/export/csv")
async def export_encroachment_csv(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    confidence_level: str = "all"
):
    """
    Export encroachment data as CSV
    """
    try:
        logger.info("Exporting encroachment data as CSV")
        
        # Parse dates
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
        
        csv_data = await encroachment_service.export_csv(
            start_date=start_date,
            end_date=end_date,
            confidence_level=confidence_level
        )
        
        return JSONResponse(
            content={"csv_data": csv_data},
            headers={"Content-Type": "application/json"}
        )
        
    except Exception as e:
        logger.error(f"Failed to export encroachment CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export CSV: {str(e)}")
